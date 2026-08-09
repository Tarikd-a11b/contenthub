import { describe, it, expect, vi } from 'vitest';

describe('createClient (browser)', () => {
  it('creates a client without throwing when env vars are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const { createClient } = await import('@/lib/supabase/client');
    expect(() => createClient()).not.toThrow();
  });
});
