import { config } from 'dotenv';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = 'test-password-123';

/**
 * Testler jsdom ortamında koşuyor ve orada BÜTÜN Supabase istemcileri aynı
 * localStorage anahtarını paylaşıyor ("Multiple GoTrueClient instances"
 * uyarısı bunu söylüyor). signIn() bir kullanıcı oturumunu o paylaşılan
 * depoya yazınca service-role istemcisi de sonraki isteklerde kendi anahtarı
 * yerine O kullanıcının token'ını göndermeye başlıyor — istekler sıradan bir
 * kullanıcı olarak çalışıp RLS'e takılıyor, üstelik hata dönmüyor, sadece
 * 0 satır etkileniyor. Temizliğin sessizce başarısız olmasının sebebi buydu.
 *
 * persistSession: false ile her istemci kendi oturumunu bellekte tutar,
 * paylaşılan depoya hiç dokunmaz.
 */
function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createTestUser(email: string) {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!;
}

async function signIn(email: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe('follows RLS', () => {
  it("blocks a user from reading another user's follows", async () => {
    const admin = adminClient();
    const stamp = Date.now();
    const emailA = `a-${stamp}@test.local`;
    const emailB = `b-${stamp}@test.local`;

    // Bu test canlı Supabase'e yazıyor; temizlenmezse her çalıştırma DB'de bir
    // "Test Blog" kaynağı ve iki auth kullanıcısı bırakır. Biriken sahte
    // kaynaklar ingestion'da fail_count yiyip gerçek veriyi kirletiyordu.
    const userIds: string[] = [];
    let sourceId: string | undefined;

    try {
      const userA = await createTestUser(emailA);
      const userB = await createTestUser(emailB);
      userIds.push(userA.id, userB.id);

      const { data: source, error: sourceError } = await admin
        .from('sources')
        .insert({ type: 'blog', name: 'Test Blog', url_or_handle: `https://example.com/${stamp}` })
        .select()
        .single();
      if (sourceError) throw sourceError;
      sourceId = source!.id;

      const { error: followError } = await admin
        .from('follows')
        .insert({ user_id: userA.id, source_id: sourceId });
      if (followError) throw followError;

      const clientB = await signIn(emailB);
      const { data, error } = await clientB.from('follows').select('*').eq('user_id', userA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    } finally {
      // finally: iddia başarısız olsa da temizlik çalışsın.
      if (sourceId) {
        await admin.from('follows').delete().eq('source_id', sourceId);
        const { error } = await admin.from('sources').delete().eq('id', sourceId);
        // Sessiz başarısızlığa bir daha düşmemek için gürültü çıkar.
        if (error) console.error('rls.test temizliği başarısız (sources):', error.message);
      }
      for (const id of userIds) {
        await admin.auth.admin.deleteUser(id);
      }
    }
  });
});
