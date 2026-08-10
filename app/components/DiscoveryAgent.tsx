'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { followCandidate, type Candidate } from '@/lib/sourceSearch';

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
    <div className="space-y-3 rounded border p-4">
      <h2 className="text-lg font-medium">Kaynak Asistanı</h2>

      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <p
              className={`inline-block rounded px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-black text-white' : 'bg-gray-100'
              }`}
            >
              {m.content}
            </p>
            {m.candidates && m.candidates.length > 0 && (
              <div className="mt-2 space-y-2">
                {m.candidates.map((c) => (
                  <div key={c.url_or_handle} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-gray-500">
                        {c.type} · {c.url_or_handle}
                      </p>
                    </div>
                    <button
                      onClick={() => handleFollow(c)}
                      disabled={isFollowed(c)}
                      className="rounded border px-2 py-1 disabled:opacity-40"
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Bir isim veya konu yaz: örn. Daron Acemoğlu"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {loading ? '...' : 'Gönder'}
        </button>
      </div>
    </div>
  );
}
