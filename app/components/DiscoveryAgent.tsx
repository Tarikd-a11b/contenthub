'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { followCandidate, type Candidate } from '@/lib/sourceSearch';
import SourceTypeDot from '@/app/components/SourceTypeDot';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  candidates?: Candidate[];
};

export default function DiscoveryAgent({ followedHandles }: { followedHandles: Set<string> }) {
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justFollowed, setJustFollowed] = useState<Set<string>>(new Set());

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/discover-agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) throw new Error('request failed');
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, candidates: data.candidates }]);
    } catch {
      setError('Bir şeyler ters gitti, tekrar dener misin?');
    } finally {
      setLoading(false);
    }
  }

  async function handleFollow(candidate: Candidate) {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;

    try {
      await followCandidate(supabase, userId, candidate);
      setJustFollowed((prev) => new Set(prev).add(candidate.url_or_handle));
    } catch {
      setError('Takip edilemedi, tekrar dener misin?');
    }
  }

  function isFollowed(candidate: Candidate) {
    return followedHandles.has(candidate.url_or_handle) || justFollowed.has(candidate.url_or_handle);
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-base font-semibold">Kaynak Asistanı</h2>

      {messages.length > 0 && (
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <p
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm ${
                  m.role === 'user'
                    ? 'bg-accent text-white'
                    : 'border border-border bg-background text-foreground'
                }`}
              >
                {m.content}
              </p>
              {m.candidates && m.candidates.length > 0 && (
                <div className="mt-2 space-y-2 text-left">
                  {m.candidates.map((c) => (
                    <div
                      key={c.url_or_handle}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="mt-1 flex items-center gap-2 font-mono text-xs tracking-wide text-muted">
                          <SourceTypeDot type={c.type} />
                          <span className="truncate">
                            {c.type} · {c.url_or_handle}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleFollow(c)}
                        disabled={isFollowed(c)}
                        className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-accent disabled:border-border disabled:text-muted disabled:hover:border-border"
                      >
                        {isFollowed(c) ? 'Takip ediliyor ✓' : 'Takip et'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Bir isim veya konu yaz: örn. Daron Acemoğlu"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {loading ? '...' : 'Gönder'}
        </button>
      </div>
    </div>
  );
}
