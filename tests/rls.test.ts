import { config } from 'dotenv';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = 'test-password-123';

async function createTestUser(email: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!;
}

async function signIn(email: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe('follows RLS', () => {
  it("blocks a user from reading another user's follows", async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const stamp = Date.now();
    const emailA = `a-${stamp}@test.local`;
    const emailB = `b-${stamp}@test.local`;

    const userA = await createTestUser(emailA);
    await createTestUser(emailB);

    const { data: source } = await admin
      .from('sources')
      .insert({ type: 'blog', name: 'Test Blog', url_or_handle: `https://example.com/${stamp}` })
      .select()
      .single();

    await admin.from('follows').insert({ user_id: userA.id, source_id: source!.id });

    const clientB = await signIn(emailB);
    const { data, error } = await clientB.from('follows').select('*').eq('user_id', userA.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
