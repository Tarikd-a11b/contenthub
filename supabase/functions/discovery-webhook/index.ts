/// <reference lib="deno.ns" />
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SHARED_SECRET = Deno.env.get('N8N_WEBHOOK_SECRET') ?? '';

type DiscoveryPayload = {
  user_id: string;
  interest_id: string;
  candidates: Array<{ type: string; name: string; url_or_handle: string; platform?: string }>;
};

export async function handleDiscoveryPayload(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  payload: DiscoveryPayload
) {
  const results: Array<{ candidate: unknown; error: string | null }> = [];

  for (const candidate of payload.candidates) {
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .upsert(
        {
          type: candidate.type,
          name: candidate.name,
          url_or_handle: candidate.url_or_handle,
          platform: candidate.platform ?? null,
          discovered_via_interest_id: payload.interest_id,
        },
        { onConflict: 'url_or_handle', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (sourceError) {
      results.push({ candidate, error: sourceError.message });
      continue;
    }

    const { error: suggestionError } = await supabase.from('discovery_suggestions').upsert(
      { user_id: payload.user_id, source_id: source.id, interest_id: payload.interest_id, status: 'pending' },
      { onConflict: 'user_id,source_id', ignoreDuplicates: true }
    );

    results.push({ candidate, error: suggestionError?.message ?? null });
  }

  return results;
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.headers.get('x-webhook-secret') !== SHARED_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload: DiscoveryPayload = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const results = await handleDiscoveryPayload(supabase, payload);

    return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
  });
}
