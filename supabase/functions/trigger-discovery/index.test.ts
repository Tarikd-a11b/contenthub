/// <reference lib="deno.ns" />
import { assertEquals } from 'jsr:@std/assert';
import { triggerDiscovery } from './index.ts';

Deno.test('forwards user_id and interest_id to the n8n webhook', async () => {
  let capturedBody: unknown;
  const fakeFetch = async (_url: string, init: RequestInit) => {
    capturedBody = JSON.parse(init.body as string);
    return new Response(null, { status: 200 });
  };

  const result = await triggerDiscovery(fakeFetch as typeof fetch, {
    record: { user_id: 'user-1', interest_id: 'interest-1' },
  });

  assertEquals(result.forwarded, true);
  assertEquals(capturedBody, { user_id: 'user-1', interest_id: 'interest-1' });
});
