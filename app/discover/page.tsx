'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { approveSuggestion, dismissSuggestion } from '@/lib/discovery';
import NavBar from '@/app/components/NavBar';
import DiscoveryAgent from '@/app/components/DiscoveryAgent';
import SourceTypeDot from '@/app/components/SourceTypeDot';

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
  const [followedHandles, setFollowedHandles] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('follows')
      .select('sources(url_or_handle)')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFollowedHandles(new Set((data ?? []).map((row: any) => row.sources?.url_or_handle).filter(Boolean)));
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
    <div>
      <NavBar />
      <div className="mx-auto mt-8 max-w-lg space-y-4 px-4">
        <DiscoveryAgent followedHandles={followedHandles} />
        <h1 className="text-xl font-semibold">Keşfet</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {suggestions.length === 0 && <p className="text-sm text-muted">Şu an öneri yok.</p>}
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{s.sources.name}</p>
              <p className="mt-1.5 flex items-center gap-2 font-mono text-xs tracking-wide text-muted">
                <SourceTypeDot type={s.sources.type} />
                <span className="truncate">
                  {s.sources.type} · {s.sources.url_or_handle}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => handleApprove(s)}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition-opacity hover:opacity-90"
              >
                Beğen
              </button>
              <button
                onClick={() => handleDismiss(s)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent"
              >
                Geç
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
