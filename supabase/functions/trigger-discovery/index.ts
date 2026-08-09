/// <reference lib="deno.ns" />

const N8N_DISCOVERY_WEBHOOK_URL = Deno.env.get('N8N_DISCOVERY_WEBHOOK_URL') ?? '';
const SHARED_SECRET = Deno.env.get('N8N_WEBHOOK_SECRET') ?? '';

export async function triggerDiscovery(
  fetcher: typeof fetch,
  payload: { record: { user_id: string; interest_id: string } }
) {
  const response = await fetcher(N8N_DISCOVERY_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: payload.record.user_id, interest_id: payload.record.interest_id }),
  });
  return { forwarded: response.ok };
}

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.headers.get('x-webhook-secret') !== SHARED_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = await req.json();
    const result = await triggerDiscovery(fetch, payload);
    return new Response(JSON.stringify(result), {
      status: result.forwarded ? 200 : 502,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}
