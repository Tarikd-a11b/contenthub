/// <reference lib="deno.ns" />

/**
 * Yeni bir ilgi alanı eklenince (pg_net trigger'ı buraya POST ediyor) o konuda
 * takip edilebilir kaynak önerileri üretir ve discovery-webhook'a yollar.
 *
 * Eskiden bu iş n8n'in "ContentHub Discovery" workflow'undaydı ve n8n'in
 * internetten erişilebilir olmasını gerektiriyordu — tünel derdinin tek sebebi
 * buydu. Mantık buraya taşındığı için artık n8n'e hiç ihtiyaç yok.
 *
 * Anthropic çağrısı ham fetch ile: repodaki diğer iki çağrı noktası da
 * (app/api/discover-agent/route.ts) böyle, SDK'yı yalnızca burada kullanmak
 * tutarsızlık olurdu.
 */

// Haiku 4.5, ölçülmüş tercih: aynı sorguda 8sn/~$0.02, Sonnet 5 ise 28sn/~$0.07.
// DİKKAT: web_search_20260209 (dinamik filtreleme) Haiku 4.5'te YOK — daha
// güçlü bir modele geçilmeden bu sürüm yükseltilemez.
const MODEL = 'claude-haiku-4-5';
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search' };

// Sunucu taraflı web_search döngüsü 10 turda durup pause_turn dönebiliyor.
// n8n sürümü bunu ele almıyordu: cevap sessizce yarım kalıyor, hata da dönmüyordu.
const MAX_CONTINUATIONS = 3;

function buildPrompt(label: string): string {
  return `"${label}" konusunda dünya çapında tanınmış, alanında uzman kişilerin veya kurumların aktif, takip edilebilir 5 kaynağını öner (kişisel blog, YouTube kanalı veya akademik kaynak). Hacker News, Reddit gibi genel haber/link toplama sitelerini ÖNERME — doğrudan o uzmanın/kişinin kendi yayın kanalını seç. Sadece şu JSON formatında cevap ver, başka metin ekleme: [{"type":"blog|youtube|academic","name":"...","url_or_handle":"...","platform":"..."}]`;
}

export type Candidate = { type: string; name: string; url_or_handle: string; platform?: string };

/** Bir metin bloğundan JSON dizisi çıkarmayı birkaç biçimde dener. */
function extractArray(text: string): Candidate[] | null {
  const attempts: string[] = [];

  // ```json ... ``` (veya etiketsiz) kod blokları — en olası biçim
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) attempts.push(m[1]);
  // Açıklama metninin arasına gömülmüş çıplak [ ... ]
  const bare = text.match(/\[[\s\S]*\]/);
  if (bare) attempts.push(bare[0]);
  // Blok baştan sona sadece JSON
  attempts.push(text);

  for (const raw of attempts) {
    try {
      const parsed = JSON.parse(raw.trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // sıradaki biçimi dene
    }
  }
  return null;
}

/**
 * Claude'un cevabından aday listesini çıkarır.
 *
 * Sadece SON metin bloğunu alıp "kod bloğu işaretlerini sil, JSON.parse et"
 * demek kırılgan: gözlemlenen iki çalıştırmadan biri boş döndü. Model bazen
 * JSON'dan önce bir cümle yazıyor, bazen JSON'u daha erken bir blokta
 * bırakıyor, bazen kod bloğunu etiketsiz açıyor. Bloklara sondan başa bak ve
 * her birinde birkaç biçimi dene.
 */
export function parseCandidates(content: Array<{ type: string; text?: string }>): Candidate[] {
  const texts = (content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '');

  for (let i = texts.length - 1; i >= 0; i--) {
    const found = extractArray(texts[i]);
    if (found) return found;
  }
  return [];
}

export async function runDiscovery(
  fetcher: typeof fetch,
  env: { supabaseUrl: string; serviceRoleKey: string; anthropicKey: string },
  payload: { record: { user_id: string; interest_id: string } }
) {
  const { user_id, interest_id } = payload.record;

  // 1) İlgi alanının etiketini al
  const interestRes = await fetcher(
    `${env.supabaseUrl}/rest/v1/interests?id=eq.${interest_id}&select=label`,
    { headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` } }
  );
  if (!interestRes.ok) throw new Error(`interests sorgusu başarısız: HTTP ${interestRes.status}`);
  const rows = await interestRes.json();
  const label = Array.isArray(rows) ? rows[0]?.label : rows?.label;
  if (!label) throw new Error(`ilgi alanı bulunamadı: ${interest_id}`);

  // 2) Claude'a sor (pause_turn olursa asistan turunu geri gönderip devam ettir)
  // deno-lint-ignore no-explicit-any
  const turns: any[] = [{ role: 'user', content: buildPrompt(label) }];
  // deno-lint-ignore no-explicit-any
  let data: any = null;

  for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
    const res = await fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        // 1024 ölçülen çıktıya (~400 token) yakın duruyordu; arama sonuçları
        // uzayınca JSON ortasından kesilip ayrıştırılamaz hale gelebilir.
        // Yalnızca üretilen token kadar ödeniyor, pay bırakmak bedava.
        max_tokens: 2048,
        tools: [WEB_SEARCH_TOOL],
        messages: turns,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic isteği başarısız: HTTP ${res.status} ${await res.text()}`);

    data = await res.json();

    // pause_turn: ek KULLANICI mesajı eklenmemeli, sadece asistan turu geri gider.
    if (data.stop_reason === 'pause_turn') {
      turns.push({ role: 'assistant', content: data.content });
      continue;
    }
    break;
  }

  // 3) Adayları çıkar ve discovery-webhook'a yolla
  const candidates = parseCandidates(data?.content ?? []);

  // Sıfır aday "başarı" değil. Sessiz geçerse Keşfet tünelinin neden ölü
  // olduğunu anlamanın hiçbir yolu kalmıyor — nedenini görünür yap.
  if (candidates.length === 0) {
    const blocks = (data?.content ?? []).map((b: { type: string }) => b.type);
    const lastText = (data?.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text?: string }) => b.text ?? '')
      .pop() ?? '';
    console.error(
      `discovery: "${label}" için aday çıkmadı | stop_reason=${data?.stop_reason} | ` +
        `bloklar=${JSON.stringify(blocks)} | metin(${lastText.length})=${JSON.stringify(lastText.slice(0, 300))}`
    );
  }

  const webhookRes = await fetcher(`${env.supabaseUrl}/functions/v1/discovery-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, interest_id, candidates }),
  });

  return {
    forwarded: webhookRes.ok,
    candidate_count: candidates.length,
    stop_reason: data?.stop_reason ?? null,
  };
}

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    const payload = await req.json();

    if (Deno.env.get('DISCOVERY_ENABLED')?.toLowerCase() === 'false') {
      return new Response(JSON.stringify({ skipped: 'discovery disabled', payload }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const result = await runDiscovery(fetch, {
        supabaseUrl: Deno.env.get('SUPABASE_URL')!,
        serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        anthropicKey: Deno.env.get('ANTHROPIC_API_KEY')!,
      }, payload);

      return new Response(JSON.stringify(result), {
        status: result.forwarded ? 200 : 502,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });
}
