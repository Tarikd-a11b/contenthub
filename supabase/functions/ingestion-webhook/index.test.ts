/// <reference lib="deno.ns" />
import { assertEquals } from 'jsr:@std/assert';
import { handleIngestionPayload } from './index.ts';

function fakeSupabase(insertedCount: number, existingFailCount = 0) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  return {
    calls,
    from(table: string) {
      return {
        upsert(payload: unknown) {
          calls.push({ table, op: 'upsert', payload });
          return { select: async () => ({ data: Array(insertedCount).fill({}), error: null }) };
        },
        select() {
          return {
            eq: () => ({
              single: async () => ({ data: { fail_count: existingFailCount }, error: null }),
            }),
          };
        },
        update(payload: unknown) {
          calls.push({ table, op: 'update', payload });
          return { eq: async () => ({ error: null }) };
        },
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test('inserts new content items and reports the inserted count', async () => {
  const supabase = fakeSupabase(2);

  const result = await handleIngestionPayload(supabase, {
    items: [
      { source_id: 's1', title: 'A', url: 'https://a.example', published_at: '2026-08-01T00:00:00Z', content_type: 'blog' },
      { source_id: 's1', title: 'B', url: 'https://b.example', published_at: '2026-08-02T00:00:00Z', content_type: 'blog' },
    ],
  });

  assertEquals(result.inserted, 2);
});

Deno.test('marks a source broken after 3 failures', async () => {
  const supabase = fakeSupabase(0, 2);

  await handleIngestionPayload(supabase, { items: [], failed_source_ids: ['s1'] });

  const updateCall = supabase.calls.find((c: { table: string; op: string }) => c.table === 'sources' && c.op === 'update');
  assertEquals((updateCall!.payload as { status: string }).status, 'broken');
});

Deno.test('resets fail_count and reactivates a source on success', async () => {
  const supabase = fakeSupabase(0, 2);

  await handleIngestionPayload(supabase, { items: [], succeeded_source_ids: ['s1'] });

  const updateCall = supabase.calls.find((c: { table: string; op: string }) => c.table === 'sources' && c.op === 'update');
  assertEquals(updateCall!.payload, { fail_count: 0, status: 'active' });
});
