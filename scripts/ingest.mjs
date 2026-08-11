/**
 * ContentHub ingestion — takip edilen kaynakları tarar, yeni içerikleri
 * ingestion-webhook'a postalar.
 *
 * Eskiden bu iş n8n'in "ContentHub Ingestion" workflow'undaydı (id FQmp9aVAB6A8icnX)
 * ve n8n yalnızca kullanıcının bilgisayarında çalıştığı için zamanlanmış çalıştırma
 * hiç gerçekleşmiyordu. Mantık buraya birebir taşındı; ingestion-webhook'a giden
 * payload sözleşmesi (items / failed_source_ids / succeeded_source_ids) aynı kaldı.
 *
 * Bağımlılık yok: Node 20+'ın global fetch'i yeterli.
 *
 * Kullanım:
 *   node scripts/ingest.mjs            # gerçek çalıştırma
 *   node scripts/ingest.mjs --dry-run  # webhook'a POST etmez, ne göndereceğini yazar
 */

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const WEBHOOK_SECRET = requireEnv('INGESTION_WEBHOOK_SECRET');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`HATA: ${name} tanımlı değil.`);
    process.exit(1);
  }
  return value;
}

// --- feed ayrıştırma (n8n "Fetch & parse source" node'undan birebir) ---------

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTag(block, tag) {
  const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i');
  const m = block.match(re);
  if (!m) return null;
  let val = m[1].trim();
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) val = cdata[1].trim();
  return decodeEntities(val);
}

function extractLink(block) {
  let m = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  if (m) return m[1];
  m = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
  if (m) return m[1].trim();
  return null;
}

function parseFeed(xml) {
  const entries = [];
  const blockRegex = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blockRegex.exec(xml)) !== null) {
    const block = m[2];
    const title = extractTag(block, 'title');
    const link = extractLink(block);
    const date =
      extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    if (title && link) entries.push({ title, link, date });
  }
  return entries;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      // Çıplak fetch'e YouTube bazen farklı/eksik HTML döndürüyor.
      'User-Agent': 'Mozilla/5.0 (compatible; ContentHubBot/1.0)',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return { text: await res.text(), contentType: res.headers.get('content-type') ?? '' };
}

// --- feed keşfi (blog / academic) -------------------------------------------

const COMMON_FEED_PATHS = ['/feed', '/feed/', '/rss', '/rss.xml', '/feed.xml', '/atom.xml', '/index.xml'];

function looksLikeFeed(text, contentType) {
  if (/xml/i.test(contentType)) return true;
  const head = text.slice(0, 800).toLowerCase();
  return head.includes('<rss') || head.includes('<feed') || head.includes('<rdf:rdf');
}

async function tryFeed(url) {
  try {
    const { text, contentType } = await fetchText(url);
    return looksLikeFeed(text, contentType) ? { url, text } : null;
  } catch {
    return null;
  }
}

/**
 * `url_or_handle` bloglarda çoğunlukla çıplak alan adı ("yanisvaroufakis.eu"),
 * feed adresi değil — n8n sürümü bunu doğrudan fetch'e verdiği için tüm blog
 * kaynakları sessizce başarısız oluyordu.
 *
 * Dönüş: {url, text} feed bulundu | null site ayakta ama feed'i yok
 * Fırlatır: siteye hiç ulaşılamadıysa (ölü alan adı) — bu gerçek bir hatadır.
 */
async function discoverFeed(rawUrl) {
  const base = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  // Adresin kendisi zaten bir feed olabilir.
  const direct = await tryFeed(base);
  if (direct) return direct;

  // Ana sayfaya hiç ulaşılamıyorsa kaynak gerçekten ölü demektir.
  const { text: html } = await fetchText(base);

  // 1) <link rel="alternate" type="application/rss+xml" href="...">
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel=["']?alternate/i.test(tag)) continue;
    if (!/application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i);
    if (!href) continue;
    const found = await tryFeed(new URL(href[1], base).href);
    if (found) return found;
  }

  // 2) yaygın yollar
  for (const path of COMMON_FEED_PATHS) {
    const found = await tryFeed(new URL(path, base).href);
    if (found) return found;
  }

  return null;
}

/**
 * Kanal sayfası HTML'inde ilk "channelId":"UC..." eşleşmesini almak YANLIŞ — o ilk
 * eşleşme genelde sayfada önerilen BAŞKA bir kanaldır (@pbsspacetime -> PBS
 * Documentaries, @veritasium -> Veritasium en Français). Kanalın kendi id'si
 * externalId / canonical / rssUrl alanlarında durur ve üçü tutarlıdır.
 */
async function resolveYoutubeFeedUrl(urlOrHandle) {
  const handle = urlOrHandle.trim();

  if (/^UC[\w-]{22}$/.test(handle)) {
    return 'https://www.youtube.com/feeds/videos.xml?channel_id=' + handle;
  }

  const channelMatch = handle.match(/\/channel\/(UC[\w-]{22})/);
  if (channelMatch) {
    return 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelMatch[1];
  }

  let handlePart = handle;
  const hm = handle.match(/youtube\.com\/(@[\w.\-À-ɏ]+)/i);
  if (hm) handlePart = hm[1];
  if (!handlePart.startsWith('@')) handlePart = '@' + handlePart;

  // @MoxoTürkiye gibi ASCII olmayan handle'lar için yüzde kodlaması şart.
  const pageUrl = 'https://www.youtube.com/' + encodeURI(handlePart);
  const { text: html } = await fetchText(pageUrl);

  const cm =
    html.match(/"externalId":"(UC[\w-]{22})"/) ||
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})">/) ||
    html.match(/"rssUrl":"[^"]*channel_id=(UC[\w-]{22})"/);

  if (!cm) throw new Error('Kanal id çözülemedi: ' + handlePart);
  return 'https://www.youtube.com/feeds/videos.xml?channel_id=' + cm[1];
}

// --- adımlar ----------------------------------------------------------------

async function getFollowedSources() {
  const params = new URLSearchParams({
    select: 'source_id,sources(id,type,name,url_or_handle,status)',
    'sources.status': 'eq.active',
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/follows?${params}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`follows sorgusu başarısız: HTTP ${res.status} ${await res.text()}`);
  const rows = await res.json();

  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const s = row.sources;
    if (!s || s.status !== 'active') continue;
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    unique.push({ source_id: s.id, type: s.type, name: s.name, url_or_handle: s.url_or_handle });
  }
  return unique;
}

async function postToWebhook(payload) {
  const url = `${SUPABASE_URL}/functions/v1/ingestion-webhook`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${text}`);
      return text;
    } catch (err) {
      lastError = err;
      console.warn(`  webhook denemesi ${attempt}/3 başarısız: ${err.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastError;
}

async function main() {
  if (DRY_RUN) console.log('*** DRY RUN — webhook çağrılmayacak ***\n');

  const sources = await getFollowedSources();
  console.log(`${sources.length} aktif kaynak taranacak\n`);

  const items = [];
  const succeeded = [];
  const failed = [];
  const skipped = [];

  for (const src of sources) {
    try {
      // X'in herkese açık bir feed'i yok ve API'si ücretli. Bunu "başarısız"
      // saymak yanlış: kaynak sağlam, çekemeyen biziz. failed listesine
      // koyarsak fail_count 3'e ulaşıp status=broken oluyor ve kaynak
      // kullanıcıya hiç görünmeden sessizce ölüyor.
      if (src.type === 'x') {
        skipped.push(src.source_id);
        console.log(`  --  [${src.type}] ${src.name} — bu tür için feed yok, atlandı`);
        continue;
      }

      let feedXml;
      if (src.type === 'youtube') {
        feedXml = (await fetchText(await resolveYoutubeFeedUrl(src.url_or_handle))).text;
      } else {
        const found = await discoverFeed(src.url_or_handle);
        if (!found) {
          // Site ayakta, sadece feed yayınlamıyor — yine "başarısız" değil.
          skipped.push(src.source_id);
          console.log(`  --  [${src.type}] ${src.name} — site ayakta ama feed yayınlamıyor, atlandı`);
          continue;
        }
        feedXml = found.text;
      }

      const entries = parseFeed(feedXml);
      for (const e of entries) {
        const d = e.date ? new Date(e.date) : null;
        items.push({
          source_id: src.source_id,
          title: e.title,
          url: e.link,
          published_at: d && !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString(),
          content_type: src.type,
          summary: null,
        });
      }
      succeeded.push(src.source_id);
      console.log(`  OK  [${src.type}] ${src.name} — ${entries.length} içerik`);
    } catch (err) {
      // Buraya sadece gerçek hatalar düşer: siteye hiç ulaşılamadı, feed
      // adresi patladı. Bunlar fail_count'u hak ediyor.
      failed.push(src.source_id);
      console.log(`  !!  [${src.type}] ${src.name} — ${err.message}`);
    }
  }

  const payload = { items, failed_source_ids: failed, succeeded_source_ids: succeeded };
  console.log(
    `\ntoplam: ${items.length} içerik | başarılı ${succeeded.length} | atlandı ${skipped.length} | başarısız ${failed.length}`
  );

  if (DRY_RUN) {
    console.log('\ndry-run: webhook çağrılmadı.');
    return;
  }

  const result = await postToWebhook(payload);
  console.log(`webhook cevabı: ${result}`);
}

main().catch((err) => {
  console.error(`\nINGESTION BAŞARISIZ: ${err.stack || err.message}`);
  process.exit(1);
});
