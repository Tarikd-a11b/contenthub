'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { approveSuggestion, dismissSuggestion } from '@/lib/discovery';

type Suggestion = {
  id: string;
  source_id: string;
  sources: { name: string; type: string; url_or_handle: string; platform: string | null };
};

export default function DiscoverPage() {
  const supabase = createClient();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('discovery_suggestions')
      .select('id, source_id, sources(name, type, url_or_handle, platform)')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setSuggestions((data as unknown as Suggestion[]) ?? []);
      });
  }, [supabase, userId]);

  async function handleApprove(suggestion: Suggestion) {
    if (!userId) return;
    try {
      await approveSuggestion(supabase, { id: suggestion.id, source_id: suggestion.source_id, user_id: userId });
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    }
  }

  async function handleDismiss(suggestion: Suggestion) {
    try {
      await dismissSuggestion(supabase, suggestion.id);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Keşfet</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {suggestions.length === 0 && <p className="text-gray-500">Şu an öneri yok.</p>}
      {suggestions.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded border p-4">
          <div>
            <p className="font-medium">{s.sources.name}</p>
            <p className="text-sm text-gray-500">{s.sources.type} · {s.sources.url_or_handle}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleApprove(s)} className="rounded bg-black px-3 py-1 text-white">Beğen</button>
            <button onClick={() => handleDismiss(s)} className="rounded border px-3 py-1">Geç</button>
          </div>
        </div>
      ))}
    </div>
  );
}
