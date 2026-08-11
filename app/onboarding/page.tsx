'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { normalizeInterestLabel } from '@/lib/interests';
import NavBar from '@/app/components/NavBar';

type Interest = { id: string; label: string; is_preset: boolean };

export default function OnboardingPage() {
  const supabase = createClient();
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customLabel, setCustomLabel] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    supabase
      .from('interests')
      .select('id, label, is_preset')
      .order('is_preset', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setInterests(data ?? []);
      });
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_interests')
      .select('interest_id')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setSelected(new Set((data ?? []).map((row) => row.interest_id)));
      });
  }, [supabase, userId]);

  async function toggleInterest(interestId: string) {
    if (!userId) return;

    try {
      const isSelected = selected.has(interestId);
      if (isSelected) {
        await supabase.from('user_interests').delete().eq('user_id', userId).eq('interest_id', interestId);
      } else {
        await supabase.from('user_interests').insert({ user_id: userId, interest_id: interestId });
      }
      setSelected((prev) => {
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

  async function addCustomInterest() {
    if (!userId) return;

    try {
      const label = normalizeInterestLabel(customLabel);
      if (!label) return;

      const { data: existing } = await supabase.from('interests').select('id').ilike('label', label).maybeSingle();
      const interestId = existing?.id ?? (
        await supabase.from('interests').insert({ label, is_preset: false }).select('id').single()
      ).data?.id;

      if (interestId) {
        setInterests((prev) => (prev.some((i) => i.id === interestId) ? prev : [...prev, { id: interestId, label, is_preset: false }]));
        await toggleInterest(interestId);
      }
      setCustomLabel('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    }
  }

  return (
    <div>
      <NavBar />
      <div className="mx-auto mt-12 max-w-lg px-4">
      <h1 className="mb-2 text-2xl font-semibold">İlgi alanlarını seç</h1>
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      <div className="mb-6 mt-6 flex flex-wrap gap-2">
        {interests.map((interest) => (
          <button
            key={interest.id}
            onClick={() => toggleInterest(interest.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              selected.has(interest.id)
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
          onClick={addCustomInterest}
          className="rounded-lg bg-accent px-4 py-2 text-sm text-white transition-opacity hover:opacity-90"
        >
          Ekle
        </button>
      </div>

      {/* Giriş her seferinde buraya düşüyor (login/page.tsx). Çıkış yolu olmazsa
          kullanıcı adresi elle yazmadan akışa geçemiyor. */}
      <Link
        href="/feed"
        className="mt-10 inline-block rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-accent"
      >
        Akışa geç →
      </Link>
      </div>
    </div>
  );
}
