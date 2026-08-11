/// <reference lib="deno.ns" />
import { assertEquals } from 'jsr:@std/assert';
import { parseCandidates, runDiscovery } from './index.ts';

const ENV = {
  supabaseUrl: 'https://example.supabase.co',
  serviceRoleKey: 'service-role',
  anthropicKey: 'anthropic-key',
  webhookSecret: 'secret',
};

const CANDIDATES = [
  { type: 'youtube', name: 'PBS Space Time', url_or_handle: '@pbsspacetime', platform: 'YouTube' },
];

/** interests -> anthropic -> discovery-webhook sırasını taklit eden sahte fetch. */
function fakeFetchFactory(anthropicResponses: unknown[]) {
  const calls: Array<{ url: string; body: unknown }> = [];
  let anthropicCall = 0;

  const fetcher = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });

    if (url.includes('/rest/v1/interests')) {
      return new Response(JSON.stringify([{ label: 'kuantum fiziği' }]), { status: 200 });
    }
    if (url.includes('api.anthropic.com')) {
      return new Response(JSON.stringify(anthropicResponses[anthropicCall++]), { status: 200 });
    }
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  };

  return { fetcher, calls };
}

Deno.test('adayları çıkarır ve discovery-webhook e yollar', async () => {
  const { fetcher, calls } = fakeFetchFactory([
    { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(CANDIDATES) }] },
  ]);

  const result = await runDiscovery(fetcher as typeof fetch, ENV, {
    record: { user_id: 'user-1', interest_id: 'interest-1' },
  });

  assertEquals(result, { forwarded: true, candidate_count: 1, stop_reason: 'end_turn' });

  const webhookCall = calls.find((c) => c.url.includes('discovery-webhook'));
  assertEquals(webhookCall?.body, {
    user_id: 'user-1',
    interest_id: 'interest-1',
    candidates: CANDIDATES,
  });
});

Deno.test('pause_turn gelirse asistan turunu geri gönderip devam eder', async () => {
  const { fetcher, calls } = fakeFetchFactory([
    { stop_reason: 'pause_turn', content: [{ type: 'text', text: 'arıyorum...' }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(CANDIDATES) }] },
  ]);

  const result = await runDiscovery(fetcher as typeof fetch, ENV, {
    record: { user_id: 'user-1', interest_id: 'interest-1' },
  });

  assertEquals(result.candidate_count, 1);

  // İki Anthropic çağrısı olmalı; ikincisi asistan turunu taşımalı ve
  // ARAYA EK BİR KULLANICI MESAJI EKLENMEMELİ.
  const anthropicCalls = calls.filter((c) => c.url.includes('api.anthropic.com'));
  assertEquals(anthropicCalls.length, 2);
  // deno-lint-ignore no-explicit-any
  const secondTurns = (anthropicCalls[1].body as any).messages;
  assertEquals(secondTurns.length, 2);
  assertEquals(secondTurns[1].role, 'assistant');
});

Deno.test('bozuk JSON gelirse boş aday listesi döner', () => {
  assertEquals(parseCandidates([{ type: 'text', text: 'bu JSON değil' }]), []);
});

Deno.test('markdown kod bloğu içindeki JSON u ayrıştırır', () => {
  const fenced = '```json\n' + JSON.stringify(CANDIDATES) + '\n```';
  assertEquals(parseCandidates([{ type: 'text', text: fenced }]), CANDIDATES);
});

// Aşağıdakiler gerçek bir boş dönüşten sonra eklendi: model her seferinde
// aynı biçimde cevap vermiyor ve tek biçime bel bağlamak kırılgandı.

Deno.test('JSON dan önce açıklama cümlesi olsa da bulur', () => {
  const text = 'İşte astrofizik alanında öne çıkan 5 kaynak:\n\n```json\n' +
    JSON.stringify(CANDIDATES) + '\n```\n\nUmarım işine yarar.';
  assertEquals(parseCandidates([{ type: 'text', text }]), CANDIDATES);
});

Deno.test('etiketsiz kod bloğunu da ayrıştırır', () => {
  const text = '```\n' + JSON.stringify(CANDIDATES) + '\n```';
  assertEquals(parseCandidates([{ type: 'text', text }]), CANDIDATES);
});

Deno.test('kod bloğu hiç yoksa çıplak diziyi bulur', () => {
  const text = 'Buyur: ' + JSON.stringify(CANDIDATES) + ' — hepsi aktif.';
  assertEquals(parseCandidates([{ type: 'text', text }]), CANDIDATES);
});

Deno.test('JSON son blokta değilse önceki bloklara bakar', () => {
  assertEquals(
    parseCandidates([
      { type: 'text', text: '```json\n' + JSON.stringify(CANDIDATES) + '\n```' },
      { type: 'text', text: 'Aramayı tamamladım.' },
    ]),
    CANDIDATES
  );
});

Deno.test('hiçbir blokta JSON yoksa boş liste döner', () => {
  assertEquals(
    parseCandidates([
      { type: 'text', text: 'Bu konuda kaynak bulamadım.' },
      { type: 'text', text: 'Başka bir şey deneyelim mi?' },
    ]),
    []
  );
});
