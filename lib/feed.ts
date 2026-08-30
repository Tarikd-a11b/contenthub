import type { SupabaseClient } from '@supabase/supabase-js';

export type FeedItem = {
  id: string;
  title: string;
  url: string;
  published_at: string;
  content_type: string;
  source_name: string;
  is_read: boolean;
  summary: string | null;
  is_saved: boolean;
};

/**
 * RSS ve YouTube beslemelerinden gelen başlıklar HTML varlıklarıyla geliyor:
 * canlıda "Mr Burnham &#8211; Unherd op-ed" ve "24&#124;7 News" harfi harfine
 * böyle görünüyordu. React metni kaçırdığı için tarayıcı bunları kendiliğinden
 * çözmüyor — çözmek bizim işimiz.
 *
 * innerHTML KULLANILMIYOR: başlık dış kaynaktan geliyor, DOM'a HTML olarak
 * vermek script enjeksiyonuna kapı açardı. Burada yalnızca varlık kaçışları
 * metin olarak çözülüyor, etiketler metin olarak kalıyor.
 */
const ADLI_VARLIKLAR: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
};

export function decodeEntities(raw: string): string {
  if (!raw || raw.indexOf('&') === -1) return raw;   // yaygın durum: hiç varlık yok
  return raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tam, kod: string) => {
    if (kod[0] === '#') {
      const sayi = kod[1] === 'x' || kod[1] === 'X'
        ? parseInt(kod.slice(2), 16)
        : parseInt(kod.slice(1), 10);
      // Geçersiz veya kullanılamaz kod noktalarında ORİJİNALİ koru: yarım
      // çözülmüş bir başlık, hiç çözülmemiş olandan daha kafa karıştırıcı.
      if (!Number.isFinite(sayi) || sayi < 1 || sayi > 0x10ffff) return tam;
      try { return String.fromCodePoint(sayi); } catch { return tam; }
    }
    const ad = kod.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ADLI_VARLIKLAR, ad) ? ADLI_VARLIKLAR[ad] : tam;
  });
}

/**
 * Besleme ozetini ekranda gosterilebilir hale getirir.
 *
 * Ozet HAM saklaniyor: RSS <description> icinde <p>, <a>, hatta tam bir HTML
 * govdesi olabiliyor. Burada etiketler SOYULUYOR, metin olarak birakilmiyor —
 * cunku amac metni gostermek, isaretlemeyi degil. Soyma isi decode'dan ONCE
 * yapilmali: once cozup sonra soysaydik, '&lt;b&gt;' once '<b>' olur, sonra
 * etiket sanilip silinirdi; yani kaynaktaki gorunur metni kaybederdik.
 *
 * Sonuc React tarafindan METIN olarak basiliyor, innerHTML'e verilmiyor.
 */
export function cleanSummary(raw: string | null | undefined, max = 180): string | null {
  if (!raw) return null;
  const metin = decodeEntities(
    raw
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')  // govdeleriyle birlikte
      .replace(/<[^>]*>/g, ' ')                              // kalan etiketler
  )
    .replace(/\s+/g, ' ')
    .trim();

  if (!metin) return null;
  if (metin.length <= max) return metin;

  // Kelime ortasindan kesme: son bosluga kadar geri sar. Bosluk yoksa (tek uzun
  // kelime) sert kes, aksi halde hic gostermemis oluruz.
  const kirpik = metin.slice(0, max);
  const bosluk = kirpik.lastIndexOf(' ');
  return (bosluk > max * 0.6 ? kirpik.slice(0, bosluk) : kirpik).trimEnd() + '…';
}

/**
 * Blog kartlarında "N dk okuma" rozeti için kaba bir tahmin. Backend'de gerçek
 * bir okuma süresi/kelime sayısı yok — tek elimizdeki metin `summary`, o da
 * genelde tam içeriğin yalnızca ilk birkaç cümlesi. Bu yüzden bu bir TAHMİN,
 * gerçek makale uzunluğunu değil özet uzunluğunu ölçüyor; en az 1 dk gösterir.
 */
export function estimateReadingMinutes(summary: string | null): number | null {
  const clean = cleanSummary(summary, 4000);
  if (!clean) return null;
  const kelime = clean.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(kelime / 200));
}

export function sortFeedByRecency(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
}

/**
 * Akış filtresi. `types` BOŞ olduğunda "hepsi" demektir, "hiçbiri" değil —
 * kullanıcı son tür rozetini de kapattığında akışın boşalması değil, filtrenin
 * kalkması bekleniyor. Bu ayrım burada, tek yerde tanımlı.
 */
export type FeedFilter = { unreadOnly: boolean; savedOnly: boolean; types: string[] };

export const FILTRE_YOK: FeedFilter = { unreadOnly: false, savedOnly: false, types: [] };

export function filterFeed(items: FeedItem[], f: FeedFilter): FeedItem[] {
  const turSeti = new Set(f.types);
  return items.filter(
    (i) =>
      (!f.unreadOnly || !i.is_read) &&
      (!f.savedOnly || i.is_saved) &&
      (turSeti.size === 0 || turSeti.has(i.content_type)),
  );
}

/** Tür rozetlerinin sayıları. Rozet YALNIZCA içeriği olan türler için gösterilir:
 *  akışında hiç akademik içerik yokken "akademik (0)" rozeti göstermek boş bir
 *  vaat olurdu (bkz. x/academic beslemeleri henüz içerik getirmiyor). */
export function typeCounts(items: FeedItem[]): Record<string, number> {
  const sayim: Record<string, number> = {};
  for (const i of items) sayim[i.content_type] = (sayim[i.content_type] ?? 0) + 1;
  return sayim;
}

/**
 * Tek sorguda çekilen içerik sayısı. 100'dü ve iki şeyi birden bozuyordu:
 * veritabanındaki 237 içeriğin 137'si HİÇBİR ŞEKİLDE görülemiyordu, ve en yeni
 * 100 kayıt tamamen YouTube olduğu için tür filtresi tek seçenek gösteriyordu.
 *
 * Kalıcı çözüm sunucu tarafı sayfalama; bu değer o gelene kadarki dürüst sınır.
 * Yükseltirken özetlerin de taşındığını unutma — satır başına yük arttı.
 */
export const FEED_FETCH_LIMIT = 300;

export const FEED_PAGE_SIZE = 20;

export function feedPageCount(total: number, size: number = FEED_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

export function feedPage<T>(items: T[], page: number, size: number = FEED_PAGE_SIZE): T[] {
  const last = feedPageCount(items.length, size);
  const safe = Math.min(Math.max(1, Math.trunc(page) || 1), last);
  return items.slice((safe - 1) * size, safe * size);
}

const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export type FeedDayGroup = { key: string; label: string; items: FeedItem[] };

/** Yerel takvim gününe göre anahtar — gruplama kullanıcının gördüğü tarihe göre olmalı, UTC'ye göre değil. */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date, now: Date): string {
  const key = localDayKey(d);
  if (key === localDayKey(now)) return 'Bugün';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === localDayKey(yesterday)) return 'Dün';
  const base = `${d.getDate()} ${AY_ADLARI[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/**
 * Girdi sırasını koruyarak içerikleri yayın gününe göre gruplar; çağırmadan önce
 * sortFeedByRecency uygulanmış olmalı. Geçersiz published_at değerleri atılmaz,
 * sonda "Tarihsiz" grubunda toplanır.
 */
export function groupFeedByDay(items: FeedItem[], now: Date = new Date()): FeedDayGroup[] {
  const groups = new Map<string, FeedDayGroup>();
  const undated: FeedItem[] = [];

  for (const item of items) {
    const d = new Date(item.published_at);
    if (isNaN(d.getTime())) {
      undated.push(item);
      continue;
    }
    const key = localDayKey(d);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(d, now), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  // Array.from, spread değil: tsconfig hedefi Map iterator'ünü spread etmeye izin vermiyor.
  const result = Array.from(groups.values());
  if (undated.length > 0) result.push({ key: 'undated', label: 'Tarihsiz', items: undated });
  return result;
}

export type FeedThumbnail = { src: string; fallback: string | null };

/**
 * İçerik URL'sinden YouTube kapak görseli üretir; YouTube değilse null.
 *
 * Shorts için mqdefault.jpg gri kenarlıkları görselin İÇİNE gömülü döndürüyor
 * (object-fit bunu düzeltmiyor), o yüzden orijinal en-boy oranlı oardefault.jpg
 * kullanılıp 16:9'a kırpılıyor. oardefault normal videolarda 404 verdiği için
 * tür URL'den ayırt ediliyor — kör deneme her normal video başına bir 404 demek.
 */
export function youtubeThumbnail(url: string): FeedThumbnail | null {
  const shorts = url.match(/youtube\.com\/shorts\/([\w-]{11})/);
  if (shorts) {
    return {
      src: `https://i.ytimg.com/vi/${shorts[1]}/oardefault.jpg`,
      fallback: `https://i.ytimg.com/vi/${shorts[1]}/mqdefault.jpg`,
    };
  }
  const watch = url.match(/[?&]v=([\w-]{11})/);
  if (watch) {
    return { src: `https://i.ytimg.com/vi/${watch[1]}/mqdefault.jpg`, fallback: null };
  }
  return null;
}

/**
 * Kaydetmeyi açar/kapatır. read_at ile AYNI satırda yaşıyor (bkz. göç 0003):
 * user_content_status zaten "bu kullanıcı bu içerikle ne yaptı" tablosu.
 *
 * upsert kullanılıyor çünkü kullanıcı okumadığı bir içeriği de kaydedebilir —
 * o durumda satır henüz yok. onConflict ile var olan satırın read_at'i
 * korunuyor: yalnızca saved_at yazılıyor.
 */
export async function toggleSaved(
  supabase: SupabaseClient,
  userId: string,
  contentItemId: string,
  saved: boolean,
) {
  const { error } = await supabase
    .from('user_content_status')
    .upsert(
      { user_id: userId, content_item_id: contentItemId, saved_at: saved ? new Date().toISOString() : null },
      { onConflict: 'user_id,content_item_id' }
    );
  if (error) throw error;
}

/**
 * Birden çok içeriği TEK istekte okundu işaretler.
 *
 * Kaydırarak okundu işaretleme, sayfada 20 karta kadar aynı anda tetiklenebilir;
 * her biri için ayrı upsert atmak 20 ağ isteği demekti. Tek `upsert` hepsini
 * kapsıyor. markAsRead ile aynı çakışma kuralı: yalnızca read_at yazılıyor,
 * satırdaki saved_at korunuyor.
 *
 * Boş dizide hiç istek atmıyor — çağıran taraf her kaydırma olayında
 * çağırabilsin diye.
 */
export async function markManyAsRead(
  supabase: SupabaseClient,
  userId: string,
  contentItemIds: string[],
) {
  if (contentItemIds.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('user_content_status')
    .upsert(
      contentItemIds.map((id) => ({ user_id: userId, content_item_id: id, read_at: now })),
      { onConflict: 'user_id,content_item_id' },
    );
  if (error) throw error;
}

export async function markAsRead(supabase: SupabaseClient, userId: string, contentItemId: string) {
  const { error } = await supabase
    .from('user_content_status')
    .upsert(
      { user_id: userId, content_item_id: contentItemId, read_at: new Date().toISOString() },
      { onConflict: 'user_id,content_item_id' }
    );
  if (error) throw error;
}
