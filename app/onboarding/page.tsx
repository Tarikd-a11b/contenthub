'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { normalizeInterestLabel } from '@/lib/interests';

type Interest = { id: string; label: string; is_preset: boolean };

export default function OnboardingPage() {
  const supabase = createClient();
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customLabel, setCustomLabel] = useState('');

  useEffect(() => {
    supabase
      .from('interests')
      .select('id, label, is_preset')
      .order('is_preset', { ascending: false })
      .then(({ data }) => setInterests(data ?? []));
  }, [supabase]);

  async function toggleInterest(interestId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isSelected = selected.has(interestId);
    if (isSelected) {
      await supabase.from('user_interests').delete().eq('user_id', user.id).eq('interest_id', interestId);
    } else {
      await supabase.from('user_interests').insert({ user_id: user.id, interest_id: interestId });
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
  }

  async function addCustomInterest() {
    const label = normalizeInterestLabel(customLabel);
    if (!label) return;

    const { data: existing } = await supabase.from('interests').select('id').eq('label', label).maybeSingle();
    const interestId = existing?.id ?? (
      await supabase.from('interests').insert({ label, is_preset: false }).select('id').single()
    ).data?.id;

    if (interestId) {
      setInterests((prev) => (prev.some((i) => i.id === interestId) ? prev : [...prev, { id: interestId, label, is_preset: false }]));
      await toggleInterest(interestId);
    }
    setCustomLabel('');
  }

  return (
    <div className="mx-auto mt-16 max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold">İlgi alanlarını seç</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {interests.map((interest) => (
          <button
            key={interest.id}
            onClick={() => toggleInterest(interest.id)}
            className={`rounded-full border px-3 py-1 text-sm ${
              selected.has(interest.id) ? 'bg-black text-white' : 'bg-white text-black'
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
          className="flex-1 rounded border px-3 py-2"
        />
        <button onClick={addCustomInterest} className="rounded bg-black px-4 py-2 text-white">
          Ekle
        </button>
      </div>
    </div>
  );
}
