/// <reference lib="deno.ns" />
import { assertEquals } from 'jsr:@std/assert';
import { handleDiscoveryPayload } from './index.ts';

function fakeSupabase(sourceId: string) {
  const calls: Array<{ table: string; payload: unknown }> = [];
  return {
    calls,
    from(table: string) {
      return {
        upsert(payload: unknown) {
          calls.push({ table, payload });
          if (table === 'sources') {
            return { select: () => ({ single: async () => ({ data: { id: sourceId }, error: null }) }) };
          }
          return Promise.resolve({ error: null });
        },
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test('inserts a pending suggestion for each candidate', async () => {
  const supabase = fakeSupabase('source-1');

  const results = await handleDiscoveryPayload(supabase, {
    user_id: 'user-1',
    interest_id: 'interest-1',
    candidates: [{ type: 'blog', name: 'Test Blog', url_or_handle: 'https://example.com' }],
  });

  assertEquals(results.length, 1);
  assertEquals(results[0].error, null);
  assertEquals(supabase.calls[0].table, 'sources');
  assertEquals(supabase.calls[1].table, 'discovery_suggestions');
});
