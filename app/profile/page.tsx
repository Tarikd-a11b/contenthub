'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  updateProfileName,
  unfollowSource,
  sourceProfileUrl,
  groupFollowedSources,
  groupPeopleByCategory,
  type FollowedSource,
} from '@/lib/profile';
import { toggleUserInterest, findOrCreateInterest } from '@/lib/interests';
import NavBar from '@/app/components/NavBar';
import SourceTypeDot from '@/app/components/SourceTypeDot';

type Interest = { id: string; label: string; is_preset: boolean };

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedInterestIds, setSelectedInterestIds] = useState<Set<string>>(new Set());
  const [customLabel, setCustomLabel] = useState('');
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
      // `id`, `user_id` değil: tablo FocusAid ile ortak, sütun orada yeniden
      // adlandırıldı (bkz. lib/profile.ts'teki not).
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setName(data?.name ?? '');
        setSavedName(data?.name ?? '');
      });

    supabase
      .from('interests')
      .select('id, label, is_preset')
      .order('is_preset', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setInterests(data ?? []);
      });

    supabase
      .from('user_interests')
      .select('interest_id')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setSelectedInterestIds(new Set((data ?? []).map((row) => row.interest_id)));
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

  async function handleToggleInterest(interestId: string) {
    if (!userId) return;
    try {
      const isSelected = selectedInterestIds.has(interestId);
      await toggleUserInterest(supabase, userId, interestId, isSelected);
      setSelectedInterestIds((prev) => {
        const next = new Set(prev);
        if (isSelected) {
          next.delete(interestId);
        } else {
          next.add(interestId);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    }
  }

  async function handleAddCustomInterest() {
    if (!userId) return;
    try {
      const found = await findOrCreateInterest(supabase, customLabel);
      if (found) {
        setInterests((prev) => (prev.some((i) => i.id === found.id) ? prev : [...prev, { id: found.id, label: found.label, is_preset: false }]));
        await handleToggleInterest(found.id);
      }
      setCustomLabel('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    }
  }

  async function handleUnfollowPerson(sourceIds: string[]) {
    if (!userId) return;
    try {
      await Promise.all(sourceIds.map((sourceId) => unfollowSource(supabase, userId, sourceId)));
      setSources((prev) => prev.filter((s) => !sourceIds.includes(s.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const categoryGroups = groupPeopleByCategory(groupFollowedSources(sources));

  return (
    <div>
      <NavBar />
      <div className="mx-auto mt-8 max-w-lg space-y-8 px-4">
        <h1 className="text-xl font-semibold">Profil</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}

        <section className="space-y-2">
          <p className="font-mono text-xs tracking-wide text-muted">{email}</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Adın"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              onClick={handleSaveName}
              disabled={saving || name === savedName}
              className="rounded-lg bg-accent px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Kaydet
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">İlgi alanların</h2>
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <button
                key={interest.id}
                onClick={() => handleToggleInterest(interest.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selectedInterestIds.has(interest.id)
                    ? 'border-accent bg-accent text-white'
                    : 'border-border text-muted hover:border-accent hover:text-foreground'
                }`}
              >
                {interest.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Kendi ilgi alanını yaz"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              onClick={handleAddCustomInterest}
              className="rounded-lg bg-accent px-4 py-2 text-sm text-white transition-opacity hover:opacity-90"
            >
              Ekle
            </button>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-base font-semibold">Takip ettiklerin</h2>
          {sources.length === 0 && (
            <p className="text-sm text-muted">Henüz kimseyi takip etmiyorsun.</p>
          )}
          {categoryGroups.map((group) => (
            <div key={group.category} className="space-y-3">
              <h3 className="font-mono text-xs uppercase tracking-wide text-muted">{group.label}</h3>
              {group.people.map((person) => (
                <div
                  key={person.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">{person.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {person.platforms.map((platform) => {
                        const href = sourceProfileUrl(platform.type, platform.url_or_handle);
                        const label = (
                          <span className="flex items-center gap-2 font-mono text-xs tracking-wide text-muted">
                            <SourceTypeDot type={platform.type} />
                            <span className="truncate">{platform.type}</span>
                          </span>
                        );
                        // Adres kurulamayan kaynak (ör. kırpılmış channel id) linklenmez.
                        return href ? (
                          <a
                            key={platform.id}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            title={`${person.name} · ${platform.type} sayfasını aç`}
                            className="hover:underline"
                          >
                            {label}
                          </a>
                        ) : (
                          <span key={platform.id}>{label}</span>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnfollowPerson(person.platforms.map((p) => p.id))}
                    className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent"
                  >
                    Takibi bırak
                  </button>
                </div>
              ))}
            </div>
          ))}
        </section>

        <button
          onClick={handleSignOut}
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-accent"
        >
          Çıkış yap
        </button>
      </div>
    </div>
  );
}
