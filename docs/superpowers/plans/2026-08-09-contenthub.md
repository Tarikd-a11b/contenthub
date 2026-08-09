# ContentHub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-user web app where users pick interests, get AI-discovered sources to follow, and read a single unified feed of new content from those sources — no manual RSS management, no jumping between sites.

**Architecture:** Next.js (App Router) frontend talks directly to Supabase (Postgres + Auth) for user-owned CRUD, protected by Row Level Security. Two n8n workflows do the heavy lifting outside the request/response cycle: a Discovery workflow (triggered when a user adds an interest, calls Claude to find candidate sources) and a scheduled Ingestion workflow (RSS-first polling of followed sources). Both workflows write back through thin Supabase Edge Functions that own the business logic (dedup, upsert, failure tracking) — n8n never talks to Postgres directly.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Tailwind CSS, Supabase (Postgres, Auth, Edge Functions on Deno), `@supabase/supabase-js` v2, `@supabase/ssr`, `@supabase/auth-ui-react`, Vitest + Testing Library (frontend tests), Deno test runner (edge function tests), n8n (existing instance), Anthropic Claude API (discovery).

## Global Constraints

- Node.js 18+, Next.js 14 App Router, TypeScript throughout.
- No local Docker/Supabase CLI login available in this environment. The project uses a hosted Supabase project (ref `tigawsmrndalzvuyjycc`). Migrations are applied by pasting the SQL into the Supabase Dashboard SQL Editor (human step) rather than `supabase db reset`. Credentials live in a git-ignored `.env.local` at the repo root, provided by the human partner (never printed, never committed): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Tests that need real Supabase access load it via `import 'dotenv/config'` (package `dotenv`, add to devDependencies in Task 1).
- All tables have Row Level Security enabled; users only ever read/write their own rows directly. `sources` and `content_items` are shared/read-only to clients — only Edge Functions (service role) write to them.
- n8n → Supabase Edge Function calls are authenticated with a shared secret header `x-webhook-secret`, value from env var `N8N_WEBHOOK_SECRET` (set identically in both n8n credentials and Supabase Edge Function secrets).
- YouTube ingestion uses the free channel RSS feed (`https://www.youtube.com/feeds/videos.xml?channel_id=...`), never the paid/quota-limited YouTube Data API.
- X/Twitter ingestion is out of scope for this plan (see design doc §Kapsam Dışı).
- Email/Telegram delivery is out of scope for this plan.

---

## Task 1: Next.js app scaffold with Supabase auth

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `app/login/page.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/supabase-client.test.ts`

**Interfaces:**
- Consumes: Supabase project URL/anon key via env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Produces: `createClient()` (browser) from `lib/supabase/client.ts` and `createClient()` (server) from `lib/supabase/server.ts` — both used by every later frontend task.

- [ ] **Step 1: Scaffold the Next.js project**

Run: `npx create-next-app@14 . --typescript --tailwind --eslint --no-src-dir --import-alias "@/*"`
Then: `npm install @supabase/supabase-js @supabase/ssr @supabase/auth-ui-react @supabase/auth-ui-shared`
Then: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

- [ ] **Step 2: Write the failing test for the browser client**

```typescript
// tests/supabase-client.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('createClient (browser)', () => {
  it('creates a client without throwing when env vars are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const { createClient } = await import('@/lib/supabase/client');
    expect(() => createClient()).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/supabase-client.test.ts`
Expected: FAIL with "Cannot find module '@/lib/supabase/client'"

- [ ] **Step 4: Implement the Supabase clients**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/supabase-client.test.ts`
Expected: PASS

- [ ] **Step 6: Build the login page**

```tsx
// app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/onboarding');
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <div className="mx-auto mt-20 max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">ContentHub&apos;a giriş yap</h1>
      <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />
    </div>
  );
}
```

- [ ] **Step 7: Manually verify in browser**

Run: `npm run dev`, open `http://localhost:3000/login`, sign up with a test email, confirm redirect to `/onboarding` (page doesn't exist yet — a 404 here is expected and fine, it confirms the auth redirect fired).

- [ ] **Step 8: Commit**

```bash
git add lib/supabase app/login app/layout.tsx tests/supabase-client.test.ts package.json package-lock.json
git commit -m "feat: scaffold Next.js app with Supabase auth"
```

---

## Task 2: Database schema and RLS policies

**Files:**
- Create: `supabase/migrations/0001_init_schema.sql`
- Test: `tests/rls.test.ts`

**Interfaces:**
- Produces: tables `profiles`, `interests`, `user_interests`, `sources`, `discovery_suggestions`, `follows`, `content_items`, `user_content_status` — exact columns as below, consumed by every later task.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0001_init_schema.sql

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_preset boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_interests (
  user_id uuid not null references auth.users(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, interest_id)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('blog','youtube','x','academic')),
  name text not null,
  url_or_handle text not null unique,
  platform text,
  status text not null default 'active' check (status in ('active','broken')),
  discovered_via_interest_id uuid references public.interests(id) on delete set null,
  fail_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.discovery_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  interest_id uuid references public.interests(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','liked','dismissed')),
  created_at timestamptz not null default now(),
  unique (user_id, source_id)
);

create table public.follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (user_id, source_id)
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  title text not null,
  url text not null unique,
  published_at timestamptz not null,
  content_type text not null,
  summary text,
  fetched_at timestamptz not null default now()
);

create table public.user_content_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  read_at timestamptz,
  primary key (user_id, content_item_id)
);

alter table public.profiles enable row level security;
alter table public.interests enable row level security;
alter table public.user_interests enable row level security;
alter table public.sources enable row level security;
alter table public.discovery_suggestions enable row level security;
alter table public.follows enable row level security;
alter table public.content_items enable row level security;
alter table public.user_content_status enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);

create policy "interests_select_all" on public.interests for select using (auth.role() = 'authenticated');
create policy "interests_insert_authenticated" on public.interests for insert with check (auth.role() = 'authenticated');

create policy "user_interests_select_own" on public.user_interests for select using (auth.uid() = user_id);
create policy "user_interests_insert_own" on public.user_interests for insert with check (auth.uid() = user_id);
create policy "user_interests_delete_own" on public.user_interests for delete using (auth.uid() = user_id);

create policy "sources_select_all" on public.sources for select using (auth.role() = 'authenticated');

create policy "discovery_suggestions_select_own" on public.discovery_suggestions for select using (auth.uid() = user_id);
create policy "discovery_suggestions_update_own" on public.discovery_suggestions for update using (auth.uid() = user_id);

create policy "follows_select_own" on public.follows for select using (auth.uid() = user_id);
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = user_id);
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = user_id);

create policy "content_items_select_all" on public.content_items for select using (auth.role() = 'authenticated');

create policy "user_content_status_select_own" on public.user_content_status for select using (auth.uid() = user_id);
create policy "user_content_status_insert_own" on public.user_content_status for insert with check (auth.uid() = user_id);
create policy "user_content_status_update_own" on public.user_content_status for update using (auth.uid() = user_id);

insert into public.interests (label, is_preset) values
  ('Yapay Zeka', true),
  ('Yazılım Mühendisliği', true),
  ('Siber Güvenlik', true),
  ('Finans', true),
  ('Bilim', true)
on conflict (label) do nothing;
```

- [ ] **Step 2: Apply the migration to the hosted Supabase project**

This project has no local Docker/Supabase CLI login (see Global Constraints) — the migration is applied by hand instead of `supabase db reset`.

Ask the human partner to paste the full contents of `supabase/migrations/0001_init_schema.sql` into the Supabase Dashboard → SQL Editor (project ref `tigawsmrndalzvuyjycc`) and run it, then confirm back to you that it succeeded. Do not proceed to Step 3 until they confirm. Also confirm a `.env.local` file already exists at the repo root with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set (ask the human partner to create it from the Dashboard's Project Settings → API page if it doesn't exist yet) — never ask them to paste the values into chat, never print the file's contents yourself.

- [ ] **Step 3: Write the RLS verification test**

Add `dotenv` first: `npm install -D dotenv`

```typescript
// tests/rls.test.ts
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = 'test-password-123';

async function createTestUser(email: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!;
}

async function signIn(email: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe('follows RLS', () => {
  it("blocks a user from reading another user's follows", async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const stamp = Date.now();
    const emailA = `a-${stamp}@test.local`;
    const emailB = `b-${stamp}@test.local`;

    const userA = await createTestUser(emailA);
    await createTestUser(emailB);

    const { data: source } = await admin
      .from('sources')
      .insert({ type: 'blog', name: 'Test Blog', url_or_handle: `https://example.com/${stamp}` })
      .select()
      .single();

    await admin.from('follows').insert({ user_id: userA.id, source_id: source!.id });

    const clientB = await signIn(emailB);
    const { data, error } = await clientB.from('follows').select('*').eq('user_id', userA.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/rls.test.ts`
Expected: PASS (RLS blocks cross-user reads). If it fails with rows returned, a policy from Step 1 is missing or wrong — fix before continuing.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_init_schema.sql tests/rls.test.ts package.json package-lock.json
git commit -m "feat: add ContentHub database schema with RLS policies"
```

---

## Task 3: Interest onboarding page

**Files:**
- Create: `lib/interests.ts`
- Create: `app/onboarding/page.tsx`
- Test: `tests/interests.test.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts` (Task 1).
- Produces: `normalizeInterestLabel(raw: string): string` from `lib/interests.ts`, used by the onboarding page and reusable by later interest-related UI.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/interests.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeInterestLabel } from '@/lib/interests';

describe('normalizeInterestLabel', () => {
  it('trims, collapses whitespace, and lowercases', () => {
    expect(normalizeInterestLabel('  Yapay   Zeka  ')).toBe('yapay zeka');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/interests.test.ts`
Expected: FAIL with "Cannot find module '@/lib/interests'"

- [ ] **Step 3: Implement the helper**

```typescript
// lib/interests.ts
export function normalizeInterestLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/interests.test.ts`
Expected: PASS

- [ ] **Step 5: Build the onboarding page**

```tsx
// app/onboarding/page.tsx
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

    const next = new Set(selected);
    if (next.has(interestId)) {
      next.delete(interestId);
      await supabase.from('user_interests').delete().eq('user_id', user.id).eq('interest_id', interestId);
    } else {
      next.add(interestId);
      await supabase.from('user_interests').insert({ user_id: user.id, interest_id: interestId });
    }
    setSelected(next);
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
```

- [ ] **Step 6: Manually verify in browser**

Run: `npm run dev`, log in, go to `/onboarding`, select a preset interest and add a custom one, then check in Supabase Studio that `user_interests` has the expected rows.

- [ ] **Step 7: Commit**

```bash
git add lib/interests.ts app/onboarding tests/interests.test.ts
git commit -m "feat: add interest onboarding page"
```

---

## Task 4: Edge Function — trigger-discovery

**Files:**
- Create: `supabase/functions/trigger-discovery/index.ts`
- Test: `supabase/functions/trigger-discovery/index.test.ts`

**Interfaces:**
- Consumes: Supabase Database Webhook payload shape `{ type: 'INSERT', table: 'user_interests', record: { user_id: string; interest_id: string } }`.
- Produces: forwards `{ user_id, interest_id }` as JSON POST to `N8N_DISCOVERY_WEBHOOK_URL`. Consumed by the n8n Discovery workflow (Task 7).

- [ ] **Step 1: Write the failing test**

```typescript
// supabase/functions/trigger-discovery/index.test.ts
import { assertEquals } from 'jsr:@std/assert';
import { triggerDiscovery } from './index.ts';

Deno.test('forwards user_id and interest_id to the n8n webhook', async () => {
  let capturedBody: unknown;
  const fakeFetch = async (_url: string, init: RequestInit) => {
    capturedBody = JSON.parse(init.body as string);
    return new Response(null, { status: 200 });
  };

  const result = await triggerDiscovery(fakeFetch as typeof fetch, {
    record: { user_id: 'user-1', interest_id: 'interest-1' },
  });

  assertEquals(result.forwarded, true);
  assertEquals(capturedBody, { user_id: 'user-1', interest_id: 'interest-1' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --allow-env supabase/functions/trigger-discovery/index.test.ts`
Expected: FAIL — `./index.ts` doesn't exist yet.

- [ ] **Step 3: Implement the function**

```typescript
// supabase/functions/trigger-discovery/index.ts
const N8N_DISCOVERY_WEBHOOK_URL = Deno.env.get('N8N_DISCOVERY_WEBHOOK_URL') ?? '';

export async function triggerDiscovery(
  fetcher: typeof fetch,
  payload: { record: { user_id: string; interest_id: string } }
) {
  const response = await fetcher(N8N_DISCOVERY_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: payload.record.user_id, interest_id: payload.record.interest_id }),
  });
  return { forwarded: response.ok };
}

Deno.serve(async (req) => {
  const payload = await req.json();
  const result = await triggerDiscovery(fetch, payload);
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --allow-env supabase/functions/trigger-discovery/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/trigger-discovery
git commit -m "feat: add trigger-discovery edge function"
```

---

## Task 5: Edge Function — discovery-webhook

**Files:**
- Create: `supabase/functions/discovery-webhook/index.ts`
- Test: `supabase/functions/discovery-webhook/index.test.ts`

**Interfaces:**
- Consumes: POST body `{ user_id: string; interest_id: string; candidates: Array<{ type: string; name: string; url_or_handle: string; platform?: string }> }` from the n8n Discovery workflow (Task 7). Requires header `x-webhook-secret` matching `N8N_WEBHOOK_SECRET`.
- Produces: rows in `sources` and `discovery_suggestions` (status `pending`), read by the Discover page (Task 9).

- [ ] **Step 1: Write the failing test**

```typescript
// supabase/functions/discovery-webhook/index.test.ts
import { assertEquals } from 'jsr:@std/assert';
import { handleDiscoveryPayload } from './index.ts';

function fakeSupabase(sourceId: string) {
  const calls: Array<{ table: string; payload: unknown }> = [];
  return {
    calls,
    from(table: string) {
      return {
        upsert(payload: unknown) {
          calls.push({ table, payload });
          if (table === 'sources') {
            return { select: () => ({ single: async () => ({ data: { id: sourceId }, error: null }) }) };
          }
          return Promise.resolve({ error: null });
        },
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test('inserts a pending suggestion for each candidate', async () => {
  const supabase = fakeSupabase('source-1');

  const results = await handleDiscoveryPayload(supabase, {
    user_id: 'user-1',
    interest_id: 'interest-1',
    candidates: [{ type: 'blog', name: 'Test Blog', url_or_handle: 'https://example.com' }],
  });

  assertEquals(results.length, 1);
  assertEquals(results[0].error, null);
  assertEquals(supabase.calls[0].table, 'sources');
  assertEquals(supabase.calls[1].table, 'discovery_suggestions');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --allow-env supabase/functions/discovery-webhook/index.test.ts`
Expected: FAIL — `./index.ts` doesn't exist yet.

- [ ] **Step 3: Implement the function**

```typescript
// supabase/functions/discovery-webhook/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SHARED_SECRET = Deno.env.get('N8N_WEBHOOK_SECRET') ?? '';

type DiscoveryPayload = {
  user_id: string;
  interest_id: string;
  candidates: Array<{ type: string; name: string; url_or_handle: string; platform?: string }>;
};

export async function handleDiscoveryPayload(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  payload: DiscoveryPayload
) {
  const results: Array<{ candidate: unknown; error: string | null }> = [];

  for (const candidate of payload.candidates) {
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .upsert(
        {
          type: candidate.type,
          name: candidate.name,
          url_or_handle: candidate.url_or_handle,
          platform: candidate.platform ?? null,
          discovered_via_interest_id: payload.interest_id,
        },
        { onConflict: 'url_or_handle', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (sourceError) {
      results.push({ candidate, error: sourceError.message });
      continue;
    }

    const { error: suggestionError } = await supabase.from('discovery_suggestions').upsert(
      { user_id: payload.user_id, source_id: source.id, interest_id: payload.interest_id, status: 'pending' },
      { onConflict: 'user_id,source_id', ignoreDuplicates: true }
    );

    results.push({ candidate, error: suggestionError?.message ?? null });
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== SHARED_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload: DiscoveryPayload = await req.json();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const results = await handleDiscoveryPayload(supabase, payload);

  return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --allow-env supabase/functions/discovery-webhook/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/discovery-webhook
git commit -m "feat: add discovery-webhook edge function"
```

---

## Task 6: Edge Function — ingestion-webhook

**Files:**
- Create: `supabase/functions/ingestion-webhook/index.ts`
- Test: `supabase/functions/ingestion-webhook/index.test.ts`

**Interfaces:**
- Consumes: POST body `{ items: Array<{ source_id: string; title: string; url: string; published_at: string; content_type: string; summary?: string }>; failed_source_ids?: string[] }` from the n8n Ingestion workflow (Task 8). Requires header `x-webhook-secret`.
- Produces: rows in `content_items` (deduped on `url`); updates `sources.fail_count`/`status` for failed sources. Read by the Feed page (Task 10).

- [ ] **Step 1: Write the failing test**

```typescript
// supabase/functions/ingestion-webhook/index.test.ts
import { assertEquals } from 'jsr:@std/assert';
import { handleIngestionPayload } from './index.ts';

function fakeSupabase(insertedCount: number, existingFailCount = 0) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  return {
    calls,
    from(table: string) {
      return {
        upsert(payload: unknown) {
          calls.push({ table, op: 'upsert', payload });
          return { select: async () => ({ data: Array(insertedCount).fill({}), error: null }) };
        },
        select() {
          return {
            eq: () => ({
              single: async () => ({ data: { fail_count: existingFailCount }, error: null }),
            }),
          };
        },
        update(payload: unknown) {
          calls.push({ table, op: 'update', payload });
          return { eq: async () => ({ error: null }) };
        },
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test('inserts new content items and reports the inserted count', async () => {
  const supabase = fakeSupabase(2);

  const result = await handleIngestionPayload(supabase, {
    items: [
      { source_id: 's1', title: 'A', url: 'https://a.example', published_at: '2026-08-01T00:00:00Z', content_type: 'blog' },
      { source_id: 's1', title: 'B', url: 'https://b.example', published_at: '2026-08-02T00:00:00Z', content_type: 'blog' },
    ],
  });

  assertEquals(result.inserted, 2);
});

Deno.test('marks a source broken after 3 failures', async () => {
  const supabase = fakeSupabase(0, 2);

  await handleIngestionPayload(supabase, { items: [], failed_source_ids: ['s1'] });

  const updateCall = supabase.calls.find((c: { table: string; op: string }) => c.table === 'sources' && c.op === 'update');
  assertEquals((updateCall!.payload as { status: string }).status, 'broken');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --allow-env supabase/functions/ingestion-webhook/index.test.ts`
Expected: FAIL — `./index.ts` doesn't exist yet.

- [ ] **Step 3: Implement the function**

```typescript
// supabase/functions/ingestion-webhook/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SHARED_SECRET = Deno.env.get('N8N_WEBHOOK_SECRET') ?? '';

type IngestionPayload = {
  items: Array<{ source_id: string; title: string; url: string; published_at: string; content_type: string; summary?: string }>;
  failed_source_ids?: string[];
};

export async function handleIngestionPayload(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  payload: IngestionPayload
) {
  let inserted = 0;

  if (payload.items.length > 0) {
    const { data, error } = await supabase
      .from('content_items')
      .upsert(payload.items, { onConflict: 'url', ignoreDuplicates: true })
      .select();
    if (error) throw error;
    inserted = data?.length ?? 0;
  }

  for (const sourceId of payload.failed_source_ids ?? []) {
    const { data: source } = await supabase.from('sources').select('fail_count').eq('id', sourceId).single();
    const failCount = (source?.fail_count ?? 0) + 1;
    await supabase
      .from('sources')
      .update({ fail_count: failCount, status: failCount >= 3 ? 'broken' : 'active' })
      .eq('id', sourceId);
  }

  return { inserted };
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== SHARED_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload: IngestionPayload = await req.json();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const result = await handleIngestionPayload(supabase, payload);

  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --allow-env supabase/functions/ingestion-webhook/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ingestion-webhook
git commit -m "feat: add ingestion-webhook edge function"
```

---

## Task 7: n8n Discovery workflow

**Files:**
- None (configured in the n8n editor). Record the exported workflow as `n8n/discovery-workflow.json` for reference after building it.

**Interfaces:**
- Consumes: POST `{ user_id, interest_id }` from Supabase Database Webhook → `trigger-discovery` Edge Function (Task 4).
- Produces: POST `{ user_id, interest_id, candidates: [...] }` to the `discovery-webhook` Edge Function URL (Task 5), header `x-webhook-secret`.

- [ ] **Step 1: Wire the Supabase Database Webhook**

In Supabase Dashboard → Database → Webhooks: create a webhook on `user_interests`, event `INSERT`, target = the deployed `trigger-discovery` function URL.

- [ ] **Step 2: Build the workflow in n8n**

Create nodes in order:
1. **Webhook** (trigger) — Method: POST, Path: `discovery-trigger`, Respond: Immediately. This is the URL you set as `N8N_DISCOVERY_WEBHOOK_URL` in Task 4.
2. **HTTP Request** ("Get interest label") — GET `{{$env.SUPABASE_URL}}/rest/v1/interests?id=eq.{{$json.body.interest_id}}&select=label`, headers `apikey` and `Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}`.
3. **HTTP Request** ("Ask Claude") — POST `https://api.anthropic.com/v1/messages`, headers `x-api-key: {{$env.ANTHROPIC_API_KEY}}`, `anthropic-version: 2023-06-01`. Body:
   ```json
   {
     "model": "claude-sonnet-5",
     "max_tokens": 1024,
     "tools": [{"type": "web_search_20250305", "name": "web_search"}],
     "messages": [{
       "role": "user",
       "content": "\"{{$json[0].label}}\" konusunda aktif, takip edilebilir 5 kaynak öner (blog, YouTube kanalı, akademik kaynak). Sadece şu JSON formatında cevap ver, başka metin ekleme: [{\"type\":\"blog|youtube|academic\",\"name\":\"...\",\"url_or_handle\":\"...\",\"platform\":\"...\"}]"
     }]
   }
   ```
4. **Code** ("Parse candidates") — extract the JSON array from Claude's text response (strip markdown fences if present with a regex), attach `user_id` and `interest_id` from the original webhook body.
5. **HTTP Request** ("Post to discovery-webhook") — POST to the deployed `discovery-webhook` function URL, header `x-webhook-secret: {{$env.N8N_WEBHOOK_SECRET}}`, body `{{$json}}` (the object built in step 4: `user_id`, `interest_id`, `candidates`). In node Settings, enable **"Retry On Fail"** with 3 attempts and a wait time of 5s (doubling each retry) — this is the "webhook güvenilirliği" retry from the design doc.

- [ ] **Step 3: Manually verify end-to-end**

Run: `curl -X POST <n8n-discovery-trigger-url> -H "Content-Type: application/json" -d '{"record":{"user_id":"<real-user-id>","interest_id":"<real-interest-id>"}}'`
Then check in Supabase Studio SQL editor: `select * from discovery_suggestions where user_id = '<real-user-id>';`
Expected: new rows with `status = 'pending'`.

- [ ] **Step 4: Export and commit the workflow**

Export the workflow as JSON from the n8n editor (⋯ menu → Download) into `n8n/discovery-workflow.json`, then:

```bash
git add n8n/discovery-workflow.json
git commit -m "feat: add n8n discovery workflow export"
```

---

## Task 8: n8n Ingestion workflow

**Files:**
- None (configured in the n8n editor). Record the exported workflow as `n8n/ingestion-workflow.json` for reference after building it.

**Interfaces:**
- Produces: POST `{ items: [...], failed_source_ids: [...] }` to the `ingestion-webhook` Edge Function URL (Task 6), header `x-webhook-secret`.

- [ ] **Step 1: Build the workflow in n8n**

Create nodes in order:
1. **Schedule Trigger** — Cron: `0 */4 * * *` (every 4 hours).
2. **HTTP Request** ("Get followed sources") — GET `{{$env.SUPABASE_URL}}/rest/v1/follows?select=source_id,sources(id,type,name,url_or_handle,status)&sources.status=eq.active`, headers `apikey`/`Authorization` (service role).
3. **Code** ("Dedupe sources") — multiple users can follow the same source; reduce the array to unique `sources.id`.
4. **Split In Batches** — batch size 1, one iteration per source.
5. **Switch** on `{{$json.type}}`, branches `blog`, `youtube`, `academic` (drop `x` — out of scope):
   - **blog** → **RSS Read** node, URL = `{{$json.url_or_handle}}`.
   - **youtube** → **Code** node computing `https://www.youtube.com/feeds/videos.xml?channel_id=` + channel ID parsed from `url_or_handle` → **RSS Read** node with that URL.
   - **academic** → **HTTP Request** GET to the arXiv API query stored in `url_or_handle`.
   - Enable **"Continue On Fail"** on each fetch node so one broken feed doesn't stop the loop; route its error output to a **Code** node that appends the source id to a `failedSourceIds` array (use a static/workflow variable or a **Merge** node accumulating across iterations). Also enable **"Retry On Fail"** (3 attempts, 5s wait doubling) on the `academic` branch's HTTP Request node, since arXiv's API is the one call in this workflow subject to rate limiting.
6. **Code** ("Normalize items", after each branch) — map feed entries to `{source_id, title, url, published_at, content_type, summary: null}`.
7. After the Split In Batches loop completes, use a **Merge**/**Aggregate** node to collect all normalized items and all failed source ids from every iteration into one payload.
8. **HTTP Request** ("Post to ingestion-webhook") — POST to the deployed `ingestion-webhook` function URL, header `x-webhook-secret: {{$env.N8N_WEBHOOK_SECRET}}`, body `{ "items": {{$json.items}}, "failed_source_ids": {{$json.failedSourceIds}} }`. In node Settings, enable **"Retry On Fail"** with 3 attempts and a wait time of 5s (doubling each retry).

- [ ] **Step 2: Manually verify end-to-end**

Seed one active `blog` source with a real RSS URL and a `follows` row for a test user. Execute the workflow manually in the n8n editor ("Execute Workflow" button).
Then check: `select * from content_items where source_id = '<seeded-source-id>';`
Expected: rows matching the feed's recent entries.

- [ ] **Step 3: Verify dedup on re-run**

Execute the workflow a second time immediately.
Expected: the `ingestion-webhook` HTTP response shows `inserted: 0` (or only genuinely new entries) — no duplicate rows in `content_items`.

- [ ] **Step 4: Export and commit the workflow**

```bash
git add n8n/ingestion-workflow.json
git commit -m "feat: add n8n ingestion workflow export"
```

---

## Task 9: Discover page

**Files:**
- Create: `lib/discovery.ts`
- Create: `app/discover/page.tsx`
- Test: `tests/discovery.test.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts` (Task 1); reads `discovery_suggestions` joined with `sources` (populated by Task 5).
- Produces: `approveSuggestion(supabase, suggestion)` and `dismissSuggestion(supabase, suggestionId)` from `lib/discovery.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/discovery.test.ts
import { describe, it, expect, vi } from 'vitest';
import { approveSuggestion, dismissSuggestion } from '@/lib/discovery';

function fakeSupabase() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  return {
    insert,
    update,
    from: vi.fn().mockReturnValue({ insert, update }),
  };
}

describe('approveSuggestion', () => {
  it('inserts a follow then marks the suggestion liked', async () => {
    const supabase = fakeSupabase();
    // deno-lint-ignore no-explicit-any
    await approveSuggestion(supabase as any, { id: 'sugg-1', source_id: 'src-1', user_id: 'user-1' });

    expect(supabase.insert).toHaveBeenCalledWith({ user_id: 'user-1', source_id: 'src-1' });
    expect(supabase.update).toHaveBeenCalledWith({ status: 'liked' });
  });
});

describe('dismissSuggestion', () => {
  it('marks the suggestion dismissed', async () => {
    const supabase = fakeSupabase();
    // deno-lint-ignore no-explicit-any
    await dismissSuggestion(supabase as any, 'sugg-1');

    expect(supabase.update).toHaveBeenCalledWith({ status: 'dismissed' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/discovery.test.ts`
Expected: FAIL with "Cannot find module '@/lib/discovery'"

- [ ] **Step 3: Implement the helpers**

```typescript
// lib/discovery.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function approveSuggestion(
  supabase: SupabaseClient,
  suggestion: { id: string; source_id: string; user_id: string }
) {
  const { error: followError } = await supabase
    .from('follows')
    .insert({ user_id: suggestion.user_id, source_id: suggestion.source_id });
  if (followError && followError.code !== '23505') throw followError;

  const { error: statusError } = await supabase
    .from('discovery_suggestions')
    .update({ status: 'liked' })
    .eq('id', suggestion.id);
  if (statusError) throw statusError;
}

export async function dismissSuggestion(supabase: SupabaseClient, suggestionId: string) {
  const { error } = await supabase.from('discovery_suggestions').update({ status: 'dismissed' }).eq('id', suggestionId);
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/discovery.test.ts`
Expected: PASS

- [ ] **Step 5: Build the discover page**

```tsx
// app/discover/page.tsx
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
      .then(({ data }) => setSuggestions((data as unknown as Suggestion[]) ?? []));
  }, [supabase, userId]);

  async function handleApprove(suggestion: Suggestion) {
    if (!userId) return;
    await approveSuggestion(supabase, { id: suggestion.id, source_id: suggestion.source_id, user_id: userId });
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  }

  async function handleDismiss(suggestion: Suggestion) {
    await dismissSuggestion(supabase, suggestion.id);
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  }

  return (
    <div className="mx-auto mt-16 max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Keşfet</h1>
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
```

- [ ] **Step 6: Manually verify in browser**

Seed a `discovery_suggestions` row for your test user directly in Supabase Studio, open `/discover`, click "Beğen", confirm the row disappears and a matching row appears in `follows`.

- [ ] **Step 7: Commit**

```bash
git add lib/discovery.ts app/discover tests/discovery.test.ts
git commit -m "feat: add discover page with approve/dismiss"
```

---

## Task 10: Feed page

**Files:**
- Create: `lib/feed.ts`
- Create: `app/feed/page.tsx`
- Test: `tests/feed.test.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts` (Task 1); reads `content_items` joined via `follows` (populated by Task 6/9).
- Produces: `sortFeedByRecency(items)` and `markAsRead(supabase, userId, contentItemId)` from `lib/feed.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/feed.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sortFeedByRecency, markAsRead, type FeedItem } from '@/lib/feed';

describe('sortFeedByRecency', () => {
  it('orders items newest first', () => {
    const items: FeedItem[] = [
      { id: '1', title: 'Old', url: 'https://a', published_at: '2026-01-01T00:00:00Z', content_type: 'blog', source_name: 'A', is_read: false },
      { id: '2', title: 'New', url: 'https://b', published_at: '2026-08-01T00:00:00Z', content_type: 'blog', source_name: 'B', is_read: false },
    ];
    expect(sortFeedByRecency(items).map((i) => i.id)).toEqual(['2', '1']);
  });
});

describe('markAsRead', () => {
  it('upserts a read status row', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };
    // deno-lint-ignore no-explicit-any
    await markAsRead(supabase as any, 'user-1', 'item-1');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', content_item_id: 'item-1' }),
      { onConflict: 'user_id,content_item_id' }
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/feed.test.ts`
Expected: FAIL with "Cannot find module '@/lib/feed'"

- [ ] **Step 3: Implement the helpers**

```typescript
// lib/feed.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type FeedItem = {
  id: string;
  title: string;
  url: string;
  published_at: string;
  content_type: string;
  source_name: string;
  is_read: boolean;
};

export function sortFeedByRecency(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
}

export async function markAsRead(supabase: SupabaseClient, userId: string, contentItemId: string) {
  const { error } = await supabase
    .from('user_content_status')
    .upsert(
      { user_id: userId, content_item_id: contentItemId, read_at: new Date().toISOString() },
      { onConflict: 'user_id,content_item_id' }
    );
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/feed.test.ts`
Expected: PASS

- [ ] **Step 5: Build the feed page**

```tsx
// app/feed/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sortFeedByRecency, markAsRead, type FeedItem } from '@/lib/feed';

export default function FeedPage() {
  const supabase = createClient();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      const { data: follows } = await supabase.from('follows').select('source_id').eq('user_id', userId);
      const sourceIds = (follows ?? []).map((f) => f.source_id);
      if (sourceIds.length === 0) return setItems([]);

      const { data: contentRows } = await supabase
        .from('content_items')
        .select('id, title, url, published_at, content_type, sources(name)')
        .in('source_id', sourceIds);

      const { data: statusRows } = await supabase
        .from('user_content_status')
        .select('content_item_id, read_at')
        .eq('user_id', userId);
      const readIds = new Set((statusRows ?? []).filter((r) => r.read_at).map((r) => r.content_item_id));

      const feedItems: FeedItem[] = (contentRows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        url: row.url,
        published_at: row.published_at,
        content_type: row.content_type,
        // deno-lint-ignore no-explicit-any
        source_name: (row.sources as any)?.name ?? '',
        is_read: readIds.has(row.id),
      }));

      setItems(sortFeedByRecency(feedItems));
    }

    load();
  }, [supabase, userId]);

  async function handleRead(item: FeedItem) {
    if (!userId) return;
    await markAsRead(supabase, userId, item.id);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)));
  }

  return (
    <div className="mx-auto mt-16 max-w-2xl space-y-3">
      <h1 className="text-2xl font-semibold">Akış</h1>
      {items.length === 0 && <p className="text-gray-500">Henüz içerik yok — bir kaynak takip et.</p>}
      {items.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => handleRead(item)}
          className={`block rounded border p-4 ${item.is_read ? 'opacity-50' : ''}`}
        >
          <p className="font-medium">{item.title}</p>
          <p className="text-sm text-gray-500">{item.source_name} · {item.content_type}</p>
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Manually verify in browser**

With a followed source that has `content_items` rows, open `/feed`, confirm items appear newest-first, click one, confirm it dims (marked read) and a row appears in `user_content_status`.

- [ ] **Step 7: Commit**

```bash
git add lib/feed.ts app/feed tests/feed.test.ts
git commit -m "feat: add feed page with read tracking"
```
