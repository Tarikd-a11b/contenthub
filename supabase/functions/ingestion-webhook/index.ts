/// <reference lib="deno.ns" />
import { createClient } from 'jsr:@supabase/supabase-js@2';

type IngestionPayload = {
  items: Array<{ source_id: string; title: string; url: string; published_at: string; content_type: string; summary?: string }>;
  failed_source_ids?: string[];
  succeeded_source_ids?: string[];
};

export async function handleIngestionPayload(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  payload: IngestionPayload
) {
  let inserted = 0;

  if (payload.items.length > 0) {
    const { data, error } = await supabase
      .from('content_items')
      .upsert(payload.items, { onConflict: 'url', ignoreDuplicates: true })
      .select();
    if (error) throw error;
    inserted = data?.length ?? 0;
  }

  for (const sourceId of payload.succeeded_source_ids ?? []) {
    await supabase.from('sources').update({ fail_count: 0, status: 'active' }).eq('id', sourceId);
  }

  for (const sourceId of payload.failed_source_ids ?? []) {
    const { data: source } = await supabase.from('sources').select('fail_count').eq('id', sourceId).single();
    const failCount = (source?.fail_count ?? 0) + 1;
    await supabase
      .from('sources')
      .update({ fail_count: failCount, status: failCount >= 3 ? 'broken' : 'active' })
      .eq('id', sourceId);
  }

  return { inserted };
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    const payload: IngestionPayload = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const result = await handleIngestionPayload(supabase, payload);

    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  });
}
