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

const SHARED_SECRET = Deno.env.get('N8N_WEBHOOK_SECRET') ?? '';

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

/** Claude'un son metin bloğundan JSON adaylarını çıkarır; bozuksa boş liste. */
export function parseCandidates(content: Array<{ type: string; text?: string }>): Candidate[] {
  const textBlocks = (content ?? []).filter((b) => b.type === 'text');
  const lastText = textBlocks.length > 0 ? (textBlocks[textBlocks.length - 1].text ?? '[]') : '[]';
  const cleaned = lastText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function runDiscovery(
  fetcher: typeof fetch,
  env: { supabaseUrl: string; serviceRoleKey: string; anthropicKey: string; webhookSecret: string },
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
        max_tokens: 1024,
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
  const webhookRes = await fetcher(`${env.supabaseUrl}/functions/v1/discovery-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': env.webhookSecret },
    body: JSON.stringify({ user_id, interest_id, candidates }),
  });

  return { forwarded: webhookRes.ok, candidate_count: candidates.length };
}

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.headers.get('x-webhook-secret') !== SHARED_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = await req.json();
    try {
      const result = await runDiscovery(fetch, {
        supabaseUrl: Deno.env.get('SUPABASE_URL')!,
        serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        anthropicKey: Deno.env.get('ANTHROPIC_API_KEY')!,
        webhookSecret: SHARED_SECRET,
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
