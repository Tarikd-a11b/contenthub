# Discover Page Chat Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Copilot-style chat assistant to the `/discover` page that lets the user search for content sources by name or topic (e.g. "Daron Acemoğlu"), refine across multiple turns, and follow suggested sources directly from the chat.

**Architecture:** A client chat component (`DiscoveryAgent`) posts the full conversation history to a Next.js Route Handler on every turn. The route handler calls the Anthropic Messages API directly (no n8n) with the `web_search_20250305` server tool, which resolves searches within the same HTTP response — no client-side tool-use loop is needed. The route extracts a trailing fenced JSON block from Claude's reply into a typed candidate list; the chat UI renders those as follow-able cards.

**Tech Stack:** Next.js 14 App Router, React (client components), Supabase (`@supabase/ssr`), Anthropic Messages API (`claude-haiku-4-5`, `web_search_20250305`), Vitest.

## Global Constraints

- No chat persistence — conversation lives only in React state, nothing written to Supabase.
- No n8n involvement — this is a user-triggered, on-demand feature, not a scheduled automation.
- Uses the existing `ANTHROPIC_API_KEY` env var (already present in `.env.local` and in Vercel's project environment variables).
- Model: `claude-haiku-4-5` (same model already used by the n8n Discovery workflow).
- Follow the existing code style in this repo: `'use client'` pages/components use `useEffect` + `createClient()` from `lib/supabase/client`; `lib/*.ts` helpers take a `SupabaseClient` as their first argument and throw on error (see `lib/discovery.ts`); tests use Vitest with hand-rolled chainable mock objects (see `tests/discovery.test.ts`) — no test library/mocking framework beyond `vitest`.

---

### Task 1: `extractCandidates` — parse candidate sources out of the assistant's reply

**Files:**
- Create: `lib/sourceSearch.ts`
- Test: `tests/sourceSearch.test.ts`

**Interfaces:**
- Produces: `export type Candidate = { type: string; name: string; url_or_handle: string; platform: string | null }`
- Produces: `export function extractCandidates(assistantText: string): { text: string; candidates: Candidate[] }`

**Behavior:** Look for a fenced ` ```json ... ``` ` block anywhere in `assistantText`. If none is found, return the full trimmed text with an empty candidate list. If one is found, try to `JSON.parse` its contents. If parsing fails, or the parsed value is not an array, return the full trimmed original text (fence included) with an empty candidate list — never silently truncate a reply we couldn't successfully parse. If parsing succeeds, keep only array entries that have string `type`, `name`, and `url_or_handle` fields (defaulting missing/non-string `platform` to `null`), and return the text with the fenced block and anything after it removed, trimmed, alongside the parsed candidates.

- [ ] **Step 1: Write the failing tests**

Create `tests/sourceSearch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractCandidates } from '@/lib/sourceSearch';

describe('extractCandidates', () => {
  it('splits the reply text from a trailing JSON code block', () => {
    const input =
      'Merhaba! İşte bulduklarım.\n\n```json\n[{"type":"blog","name":"Test Blog","url_or_handle":"https://example.com","platform":"web"}]\n```';

    const result = extractCandidates(input);

    expect(result.text).toBe('Merhaba! İşte bulduklarım.');
    expect(result.candidates).toEqual([
      { type: 'blog', name: 'Test Blog', url_or_handle: 'https://example.com', platform: 'web' },
    ]);
  });

  it('defaults a missing platform to null', () => {
    const input = 'Buldum.\n\n```json\n[{"type":"youtube","name":"Chan","url_or_handle":"@chan"}]\n```';

    const result = extractCandidates(input);

    expect(result.candidates).toEqual([{ type: 'youtube', name: 'Chan', url_or_handle: '@chan', platform: null }]);
  });

  it('returns the full text unchanged when there is no JSON block', () => {
    const input = 'Üzgünüm, bu konuda takip edilebilir bir kaynak bulamadım.';

    const result = extractCandidates(input);

    expect(result.text).toBe(input);
    expect(result.candidates).toEqual([]);
  });

  it('returns the full text unchanged when the JSON block is malformed', () => {
    const input = 'Buldum ama biraz garip oldu.\n\n```json\n{not valid json\n```';

    const result = extractCandidates(input);

    expect(result.text).toBe(input);
    expect(result.candidates).toEqual([]);
  });

  it('drops candidate entries missing required fields', () => {
    const input =
      'İşte.\n\n```json\n[{"type":"blog","name":"Ok","url_or_handle":"https://ok.com"},{"name":"Missing type"}]\n```';

    const result = extractCandidates(input);

    expect(result.candidates).toEqual([{ type: 'blog', name: 'Ok', url_or_handle: 'https://ok.com', platform: null }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- sourceSearch`
Expected: FAIL — `Cannot find module '@/lib/sourceSearch'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/sourceSearch.ts`:

```ts
export type Candidate = {
  type: string;
  name: string;
  url_or_handle: string;
  platform: string | null;
};

export function extractCandidates(assistantText: string): { text: string; candidates: Candidate[] } {
  const match = assistantText.match(/```json\s*([\s\S]*?)```/);
  if (!match) {
    return { text: assistantText.trim(), candidates: [] };
  }

  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) {
      return { text: assistantText.trim(), candidates: [] };
    }

    const candidates: Candidate[] = parsed
      .filter(
        (c: unknown): c is { type: string; name: string; url_or_handle: string; platform?: unknown } =>
          typeof c === 'object' &&
          c !== null &&
          typeof (c as Record<string, unknown>).type === 'string' &&
          typeof (c as Record<string, unknown>).name === 'string' &&
          typeof (c as Record<string, unknown>).url_or_handle === 'string'
      )
      .map((c) => ({
        type: c.type,
        name: c.name,
        url_or_handle: c.url_or_handle,
        platform: typeof c.platform === 'string' ? c.platform : null,
      }));

    return { text: assistantText.slice(0, match.index).trim(), candidates };
  } catch {
    return { text: assistantText.trim(), candidates: [] };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- sourceSearch`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sourceSearch.ts tests/sourceSearch.test.ts
git commit -m "feat: add extractCandidates to parse agent replies into follow candidates"
```

---

### Task 2: `followCandidate` — save a candidate as a followed source

**Files:**
- Modify: `lib/sourceSearch.ts`
- Modify: `tests/sourceSearch.test.ts`

**Interfaces:**
- Consumes: `Candidate` type from Task 1.
- Produces: `export async function followCandidate(supabase: SupabaseClient, userId: string, candidate: Candidate): Promise<void>`

**Behavior:** Upsert the candidate into `sources` keyed on `url_or_handle` (matches the conflict key already used in `supabase/functions/discovery-webhook/index.ts`), then insert a row into `follows` for `(userId, source.id)`. If the insert fails with Postgres unique-violation code `23505` (already following), swallow the error — this mirrors the existing tolerance in `lib/discovery.ts`'s `approveSuggestion`. Any other error from either step throws.

- [ ] **Step 1: Write the failing tests**

Add to `tests/sourceSearch.test.ts` (new imports and new `describe` block — keep the existing `extractCandidates` block above it):

```ts
import { describe, it, expect, vi } from 'vitest';
import { extractCandidates, followCandidate } from '@/lib/sourceSearch';
```

(Replace the existing `import { describe, it, expect } from 'vitest';` / `import { extractCandidates } from '@/lib/sourceSearch';` lines at the top of the file with the two lines above.)

Append this block at the end of the file:

```ts
function fakeSupabaseForFollow(sourceId: string, followError: { code: string } | null = null) {
  const single = vi.fn().mockResolvedValue({ data: { id: sourceId }, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const upsert = vi.fn().mockReturnValue({ select });
  const insert = vi.fn().mockResolvedValue({ error: followError });
  const from = vi.fn((table: string) => (table === 'sources' ? { upsert } : { insert }));
  return { from, upsert, insert };
}

describe('followCandidate', () => {
  it('upserts the source on url_or_handle then inserts a follow row', async () => {
    const supabase = fakeSupabaseForFollow('src-1');
    const candidate = { type: 'blog', name: 'Test', url_or_handle: 'https://example.com', platform: null };

    // deno-lint-ignore no-explicit-any
    await followCandidate(supabase as any, 'user-1', candidate);

    expect(supabase.upsert).toHaveBeenCalledWith(
      { type: 'blog', name: 'Test', url_or_handle: 'https://example.com', platform: null },
      { onConflict: 'url_or_handle' }
    );
    expect(supabase.insert).toHaveBeenCalledWith({ user_id: 'user-1', source_id: 'src-1' });
  });

  it('swallows a duplicate-follow error', async () => {
    const supabase = fakeSupabaseForFollow('src-1', { code: '23505' });
    const candidate = { type: 'blog', name: 'Test', url_or_handle: 'https://example.com', platform: null };

    await expect(
      // deno-lint-ignore no-explicit-any
      followCandidate(supabase as any, 'user-1', candidate)
    ).resolves.toBeUndefined();
  });

  it('throws on other follow errors', async () => {
    const supabase = fakeSupabaseForFollow('src-1', { code: '500' });
    const candidate = { type: 'blog', name: 'Test', url_or_handle: 'https://example.com', platform: null };

    await expect(
      // deno-lint-ignore no-explicit-any
      followCandidate(supabase as any, 'user-1', candidate)
    ).rejects.toEqual({ code: '500' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- sourceSearch`
Expected: FAIL — `followCandidate is not a function` (or similar, since it isn't exported yet).

- [ ] **Step 3: Write the implementation**

Add to `lib/sourceSearch.ts` (append below `extractCandidates`, add the import at the top of the file):

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
```

```ts
export async function followCandidate(supabase: SupabaseClient, userId: string, candidate: Candidate) {
  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .upsert(
      { type: candidate.type, name: candidate.name, url_or_handle: candidate.url_or_handle, platform: candidate.platform },
      { onConflict: 'url_or_handle' }
    )
    .select()
    .single();
  if (sourceError) throw sourceError;

  const { error: followError } = await supabase.from('follows').insert({ user_id: userId, source_id: source.id });
  if (followError && followError.code !== '23505') throw followError;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- sourceSearch`
Expected: PASS (8 tests total: 5 from Task 1 + 3 from this task).

- [ ] **Step 5: Commit**

```bash
git add lib/sourceSearch.ts tests/sourceSearch.test.ts
git commit -m "feat: add followCandidate to save an agent-suggested source as followed"
```

---

### Task 3: `/api/discover-agent` route — talk to Claude

**Files:**
- Create: `app/api/discover-agent/route.ts`

**Interfaces:**
- Consumes: `extractCandidates` from `lib/sourceSearch.ts` (Task 1), `createClient` from `lib/supabase/server.ts`.
- Produces: `POST /api/discover-agent` — accepts `{ messages: { role: 'user' | 'assistant'; content: string }[] }`, returns `{ reply: string; candidates: Candidate[] }` on success (200), `{ error: string }` on failure (400/401/502).

**Behavior:** Reject unauthenticated requests (401) using the existing server-side Supabase client to check `auth.getUser()`. Reject requests with a missing/empty `messages` array (400). Otherwise call `https://api.anthropic.com/v1/messages` with `model: 'claude-haiku-4-5'`, the `web_search_20250305` tool, a system prompt instructing the model to find well-known, recognized experts (not generic aggregators like Hacker News/Reddit) and to end its reply with a fenced ` ```json ` array of candidates, and the full `messages` history. On a non-OK response, return 502. On success, concatenate all `text`-type content blocks from Claude's reply, run them through `extractCandidates`, and return the result.

- [ ] **Step 1: Write the implementation**

Create `app/api/discover-agent/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractCandidates } from '@/lib/sourceSearch';

const SYSTEM_PROMPT = `Kullanıcının belirttiği kişi ya da konu için dünya çapında tanınmış, alanında uzman kaynaklar bul (kişisel blog, YouTube kanalı, X hesabı, akademik kaynak). Hacker News, Reddit gibi genel haber/link toplama sitelerini önerme — doğrudan o kişinin/uzmanın kendi yayın kanalını bul.

Önce kullanıcıya normal, doğal bir cevap yaz (bulduklarını kısaca anlat). Cevabının en sonuna, bulduğun kaynakları şu formatta bir kod bloğunda ekle:

\`\`\`json
[{"type":"blog|youtube|x|academic","name":"...","url_or_handle":"...","platform":"..."}]
\`\`\`

Hiç kaynak bulamazsan kod bloğunu hiç ekleme, sadece açıkla.`;

type IncomingMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Giriş yapmalısın' }, { status: 401 });
  }

  const body = await req.json();
  const messages: IncomingMessage[] = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages gerekli' }, { status: 400 });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Anthropic isteği başarısız oldu' }, { status: 502 });
  }

  const data = await response.json();
  const text = (data.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('\n');

  const { text: reply, candidates } = extractCandidates(text);
  return NextResponse.json({ reply, candidates });
}
```

- [ ] **Step 2: Verify the project still type-checks and builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors (this route has no automated test — the repo has no existing route-handler tests to follow, and this route is a thin wrapper around already-tested `extractCandidates`; it's verified end-to-end with a real logged-in session in Task 5).

- [ ] **Step 3: Commit**

```bash
git add app/api/discover-agent/route.ts
git commit -m "feat: add /api/discover-agent route calling Claude with web search"
```

---

### Task 4: `DiscoveryAgent` chat component

**Files:**
- Create: `app/components/DiscoveryAgent.tsx`

**Interfaces:**
- Consumes: `Candidate`, `followCandidate` from `lib/sourceSearch.ts` (Tasks 1–2); `createClient` from `lib/supabase/client`.
- Produces: `export default function DiscoveryAgent({ followedHandles }: { followedHandles: Set<string> }): JSX.Element` — a self-contained chat panel. `followedHandles` is the set of `url_or_handle` values the user already follows, used to disable "Takip et" for candidates already followed.

**Behavior:** Renders a message list (user messages right-aligned, assistant left-aligned) and an input + send button. Sending a message appends it to local state, POSTs the full history to `/api/discover-agent`, and appends the assistant's reply (with any candidate cards) to the list. Each candidate card has a "Takip et" button that calls `followCandidate` and then shows "Takip ediliyor ✓" (disabled) — both for candidates already in `followedHandles` and ones just followed in this session. Network/API errors show an inline error message below the message list without clearing the input.

- [ ] **Step 1: Write the implementation**

Create `app/components/DiscoveryAgent.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify the project builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/DiscoveryAgent.tsx
git commit -m "feat: add DiscoveryAgent chat component"
```

---

### Task 5: Wire `DiscoveryAgent` into the Discover page

**Files:**
- Modify: `app/discover/page.tsx`

**Interfaces:**
- Consumes: `DiscoveryAgent` from `app/components/DiscoveryAgent.tsx` (Task 4).

**Behavior:** Fetch the current user's followed `url_or_handle` values (join `follows` → `sources`) into a `Set<string>` once `userId` is known, and render `<DiscoveryAgent followedHandles={followedHandles} />` above the existing "Keşfet" heading and suggestion list.

- [ ] **Step 1: Add the import and state**

In `app/discover/page.tsx`, add this import alongside the existing ones:

```ts
import DiscoveryAgent from '@/app/components/DiscoveryAgent';
```

Add this state declaration next to the existing `suggestions`/`userId`/`error` state:

```ts
const [followedHandles, setFollowedHandles] = useState<Set<string>>(new Set());
```

- [ ] **Step 2: Fetch followed handles**

Add this `useEffect` alongside the existing one that fetches `discovery_suggestions` (same `[supabase, userId]` dependency array):

```ts
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
```

- [ ] **Step 3: Render the component**

In the JSX returned by `DiscoverPage`, add `<DiscoveryAgent followedHandles={followedHandles} />` immediately after the `<NavBar />` and before the `<h1>Keşfet</h1>` heading, so the final structure looks like:

```tsx
return (
  <div>
    <NavBar />
    <div className="mx-auto mt-8 max-w-lg space-y-4">
      <DiscoveryAgent followedHandles={followedHandles} />
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
  </div>
);
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (all existing tests plus the 8 from Tasks 1–2).

- [ ] **Step 5: Build and manually verify end-to-end in the browser**

Run: `npm run build && npm run dev`

In a browser, log in, go to `/discover`, and:
1. Type "Daron Acemoğlu" and send — confirm a reply appears with at least one candidate card.
2. Click "Takip et" on a card — confirm the button becomes "Takip ediliyor ✓" and disabled.
3. Refresh `/profile` — confirm the newly followed source appears under "Takip ettiklerin".
4. Send a follow-up message in the same chat (e.g. "Türkçe kaynak var mı?") — confirm the reply reflects the earlier context (doesn't ask "kim?" again).
5. Stop the dev server (`Ctrl+C`) once verified.

- [ ] **Step 6: Commit**

```bash
git add app/discover/page.tsx
git commit -m "feat: wire DiscoveryAgent into the Discover page"
```
