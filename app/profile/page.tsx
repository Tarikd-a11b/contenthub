'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updateProfileName, unfollowSource, type FollowedSource } from '@/lib/profile';
import NavBar from '@/app/components/NavBar';

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [sources, setSources] = useState<FollowedSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? '');
    });
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    supabase
      .from('profiles')
      .select('name')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setName(data?.name ?? '');
        setSavedName(data?.name ?? '');
      });

    supabase
      .from('user_interests')
      .select('interests(label)')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setInterests((data ?? []).map((row: any) => row.interests?.label).filter(Boolean));
      });

    supabase
      .from('follows')
      .select('source_id, sources(id, name, type, url_or_handle)')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSources((data ?? []).map((row: any) => row.sources).filter(Boolean));
      });
  }, [supabase, userId]);

  async function handleSaveName() {
    if (!userId) return;
    setSaving(true);
    try {
      await updateProfileName(supabase, userId, name);
      setSavedName(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnfollow(sourceId: string) {
    if (!userId) return;
    try {
      await unfollowSource(supabase, userId, sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div>
      <NavBar />
      <div className="mx-auto mt-8 max-w-lg space-y-8">
        <h1 className="text-2xl font-semibold">Profil</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <section className="space-y-2">
          <p className="text-sm text-gray-500">{email}</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Adın"
              className="flex-1 rounded border px-3 py-2"
            />
            <button
              onClick={handleSaveName}
              disabled={saving || name === savedName}
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
            >
              Kaydet
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">İlgi alanların</h2>
          {interests.length === 0 && <p className="text-gray-500">Henüz ilgi alanı seçmedin.</p>}
          <div className="flex flex-wrap gap-2">
            {interests.map((label) => (
              <span key={label} className="rounded-full border px-3 py-1 text-sm">
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Takip ettiklerin</h2>
          {sources.length === 0 && <p className="text-gray-500">Henüz kimseyi takip etmiyorsun.</p>}
          {sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">{source.name}</p>
                <p className="text-sm text-gray-500">{source.type} · {source.url_or_handle}</p>
              </div>
              <button onClick={() => handleUnfollow(source.id)} className="rounded border px-3 py-1 text-sm">
                Takibi bırak
              </button>
            </div>
          ))}
        </section>

        <button onClick={handleSignOut} className="rounded border px-4 py-2 text-sm">
          Çıkış yap
        </button>
      </div>
    </div>
  );
}
