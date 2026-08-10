# Visual Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every page and shared component of ContentHub from ad-hoc default Tailwind classes to one consistent, fixed dark-theme design system with named color tokens, a two-role typography system, and a content-type dot indicator.

**Architecture:** Named color and font tokens are declared once in `tailwind.config.ts`; `app/globals.css` shrinks to a three-line Tailwind entry point plus a dark `body`. A new tiny `SourceTypeDot` component owns the type→color mapping so the four screens that show a source never duplicate it. Each remaining task then restyles exactly one page or component using those tokens — no logic, data-fetching, prop, or copy changes anywhere.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS 3.4, TypeScript, Supabase (`@supabase/auth-ui-react` on the login page only).

## Global Constraints

- **Dark theme only.** No `prefers-color-scheme` media query, no Tailwind `dark:` variants, no light-mode fallback anywhere. A user whose OS is set to light must still see the dark theme.
- **Exact color tokens** (declared in Task 1, used by name everywhere after): `background` `#08090C`, `surface` `#111117`, `border` `#22222C`, `foreground` `#F0F0F5`, `muted` `#84848E`, `accent` `#6C6CE5`.
- **Exact source-type dot colors:** `blog` `#D9A64E`, `youtube` `#E5708A`, `x` `#B4B4C4`, `academic` `#4CBB8A`.
- **Typography:** Geist Sans (body + headings) and Geist Mono (metadata only) are already loaded in `app/layout.tsx` as the CSS variables `--font-geist-sans` and `--font-geist-mono`. Do not add, import, or load any new font. Metadata lines use `font-mono text-xs tracking-wide text-muted`.
- **Type scale:** page title (login, onboarding) `text-2xl font-semibold`; section heading (`Akış`, `Keşfet`, `Profil`) `text-xl font-semibold`; sub-heading inside a page (`İlgi alanların`, `Takip ettiklerin`, `Kaynak Asistanı`) `text-base font-semibold`; card title `text-[15px] font-semibold`; body `text-sm`.
- **Canonical component class strings** — use these verbatim so every screen matches:
  - Card: `rounded-lg border border-border bg-surface p-4`
  - Input: `rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none`
  - Primary button: `rounded-lg bg-accent px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40`
  - Secondary button: `rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-accent`
  - Error text: `text-sm text-red-400`
  - Empty-state text: `text-sm text-muted`
- **Deliberate deviation from the spec, already decided — do not "fix" it back:** the spec's secondary button ends in `hover:bg-surface`, but most secondary buttons sit *on* a `bg-surface` card where that hover is invisible. The canonical string above uses `hover:border-accent` instead, everywhere.
- **Tailwind JIT requires complete literal class names.** Never build a class with template interpolation (`` `bg-source-${type}` `` produces no CSS and renders an invisible element). Map to full literal strings through an object, as Task 1 does.
- **Visual layer only.** Do not change component logic, hooks, data fetching, Supabase queries, props, exported signatures, or any Turkish user-facing string. If a task's code below differs from the current file in anything but `className` / markup structure, that is a mistake — flag it rather than applying it.
- **No automated tests.** This repo has no component, visual, or page tests, and this plan does not add any. Every task verifies with `npm run build` (must compile with no TypeScript errors) plus the manual browser check written into that task.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `tailwind.config.ts` | Color + font tokens (the single source of truth) | 1 |
| `app/globals.css` | Tailwind entry point + dark `body` | 1 |
| `app/components/SourceTypeDot.tsx` | **New.** Owns the source-type → dot-color mapping | 1 |
| `app/components/NavBar.tsx` | Nav shell, active-tab treatment | 2 |
| `app/feed/page.tsx` | Feed list cards | 2 |
| `app/discover/page.tsx` | Suggestion list cards | 3 |
| `app/components/DiscoveryAgent.tsx` | Chat panel: bubbles, candidate cards, composer | 4 |
| `app/profile/page.tsx` | Name form, interest pills, follow list | 5 |
| `app/login/page.tsx` | Supabase Auth UI theming | 6 |
| `app/onboarding/page.tsx` | Interest picker | 6 |

---

### Task 1: Design tokens, globals.css, and the SourceTypeDot component

**Files:**
- Modify: `tailwind.config.ts` (full replacement)
- Modify: `app/globals.css` (full replacement)
- Create: `app/components/SourceTypeDot.tsx`

**Interfaces:**
- Consumes: nothing (this is the foundation task).
- Produces, for every later task:
  - Color utilities: `bg-background`, `bg-surface`, `border-border`, `text-foreground`, `text-muted`, `bg-accent`, `border-accent`, `text-accent`, and `bg-source-blog` / `bg-source-youtube` / `bg-source-x` / `bg-source-academic`.
  - Font utilities: `font-sans` (Geist Sans, also the inherited default) and `font-mono` (Geist Mono).
  - `export default function SourceTypeDot({ type }: { type: string }): JSX.Element` — default-exported from `@/app/components/SourceTypeDot`, renders a 8×8px colored dot, falls back to `bg-muted` for an unrecognized `type`.

- [ ] **Step 1: Replace `tailwind.config.ts`**

Write the file to exactly this:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#08090C",
        surface: "#111117",
        border: "#22222C",
        foreground: "#F0F0F5",
        muted: "#84848E",
        accent: "#6C6CE5",
        source: {
          blog: "#D9A64E",
          youtube: "#E5708A",
          x: "#B4B4C4",
          academic: "#4CBB8A",
        },
      },
      borderColor: {
        DEFAULT: "#22222C",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
```

Two notes on why this shape:
- The previous config pointed `background` / `foreground` at `var(--background)` / `var(--foreground)`, which Task 1 deletes from `globals.css`. Fixed hex values replace them, because the theme no longer switches at runtime.
- `borderColor.DEFAULT` is set separately from `colors.border`. Defining a *color* named `border` gives you the `border-border` utility, but it does **not** change Tailwind Preflight's default border color (`gray-200`). Without this override, any element that still has a bare `border` class and no `border-border` would draw a light gray hairline on the dark background.

- [ ] **Step 2: Replace `app/globals.css`**

Write the file to exactly this:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-background text-foreground;
}
```

This deletes the `:root` variables, the `@media (prefers-color-scheme: dark)` block, the `.text-balance` utility (unused anywhere in the app), and the `font-family: Arial, Helvetica, sans-serif` line. Dropping that last line matters: it was overriding the Geist font that `app/layout.tsx` loads, so the app was rendering in Arial. With `fontFamily.sans` extended in Task 1 Step 1, Tailwind Preflight now applies Geist Sans document-wide.

- [ ] **Step 3: Create `app/components/SourceTypeDot.tsx`**

```tsx
const DOT_CLASSES: Record<string, string> = {
  blog: 'bg-source-blog',
  youtube: 'bg-source-youtube',
  x: 'bg-source-x',
  academic: 'bg-source-academic',
};

export default function SourceTypeDot({ type }: { type: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_CLASSES[type] ?? 'bg-muted'}`}
    />
  );
}
```

`type` is `string` rather than a union because the three call sites pass differently-typed values (`FeedItem.content_type`, `Suggestion['sources']['type']`, and `Candidate.type` are all plain `string`). Unrecognized values fall back to `bg-muted` instead of rendering nothing.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TypeScript errors.

- [ ] **Step 5: Verify in the browser**

Run `npm run dev`, open `http://localhost:3000/feed`, and confirm:
1. The page background is near-black (`#08090C`), not white and not the old `#0a0a0a`.
2. Text renders in Geist Sans, not Arial (letterforms are noticeably more geometric; the lowercase `a` is single-storey-ish and the `g` differs clearly from Arial's).
3. The page is otherwise still the old unstyled layout — that is expected at this point; no page has been restyled yet.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.ts app/globals.css app/components/SourceTypeDot.tsx
git commit -m "feat: add dark design tokens, Geist font wiring, and SourceTypeDot"
```

---

### Task 2: NavBar and the feed page

**Files:**
- Modify: `app/components/NavBar.tsx` (replace the returned JSX)
- Modify: `app/feed/page.tsx` (replace the returned JSX; add one import)

**Interfaces:**
- Consumes: the color/font utilities and `SourceTypeDot` from Task 1.
- Produces: nothing new — `NavBar` keeps its existing no-prop default export and `FeedPage` keeps its existing default export.

- [ ] **Step 1: Restyle `NavBar.tsx`**

Replace only the `return (...)` block. Everything above it (`'use client'`, the imports, the `LINKS` array, the `usePathname()` call) stays exactly as it is.

```tsx
  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex max-w-2xl items-center gap-6 px-4 py-4 text-sm">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? 'border-b-2 border-accent pb-1 font-medium text-foreground'
                  : 'border-b-2 border-transparent pb-1 text-muted transition-colors hover:text-foreground'
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
```

The bottom border moves from the constrained inner element to the full-width `<nav>`, so the hairline spans the viewport while the links stay aligned with page content. Both states carry `border-b-2` (transparent when inactive) so tabs don't shift by 2px on navigation.

- [ ] **Step 2: Add the `SourceTypeDot` import to `app/feed/page.tsx`**

Add this line directly below the existing `import NavBar from '@/app/components/NavBar';`:

```tsx
import SourceTypeDot from '@/app/components/SourceTypeDot';
```

- [ ] **Step 3: Restyle the feed page's returned JSX**

Replace only the `return (...)` block (currently lines 74–96). All state, effects, `handleRead`, and the `FeedItem` mapping above it stay exactly as they are.

```tsx
  return (
    <div>
      <NavBar />
      <div className="mx-auto mt-8 max-w-2xl space-y-3 px-4">
        <h1 className="text-xl font-semibold">Akış</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {items.length === 0 && (
          <p className="text-sm text-muted">Henüz içerik yok — bir kaynak takip et.</p>
        )}
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => handleRead(item)}
            className={`block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent ${
              item.is_read ? 'opacity-50' : ''
            }`}
          >
            <p className="text-[15px] font-semibold">{item.title}</p>
            <p className="mt-1.5 flex items-center gap-2 font-mono text-xs tracking-wide text-muted">
              <SourceTypeDot type={item.content_type} />
              {item.source_name} · {item.content_type}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
```

`item.content_type` is the right value for the dot: the ingestion pipeline stores `blog` / `youtube` there, matching the dot palette.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/NavBar.tsx app/feed/page.tsx
git commit -m "feat: restyle NavBar and feed page with design tokens"
```

---

### Task 3: Discover page

**Files:**
- Modify: `app/discover/page.tsx` (replace the returned JSX; add one import)

**Interfaces:**
- Consumes: the color/font utilities and `SourceTypeDot` from Task 1; the restyled `NavBar` from Task 2.
- Produces: nothing new.

Note: this page also renders `<DiscoveryAgent />`, which is restyled separately in Task 4. After this task the suggestion list will look finished while the chat panel above it still looks unstyled — that is expected and Task 4 closes it.

- [ ] **Step 1: Add the `SourceTypeDot` import**

Add this line directly below the existing `import DiscoveryAgent from '@/app/components/DiscoveryAgent';`:

```tsx
import SourceTypeDot from '@/app/components/SourceTypeDot';
```

- [ ] **Step 2: Restyle the returned JSX**

Replace only the `return (...)` block (currently lines 71–93). All state, the three `useEffect` hooks, `handleApprove`, and `handleDismiss` stay exactly as they are.

```tsx
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
```

The buttons use `px-3 py-1.5` rather than the canonical `px-4 py-2` because two of them sit inline inside a card row; the colors, radius, and hover behavior are unchanged from the canonical strings. `min-w-0` plus `truncate` keeps a long `url_or_handle` from pushing the buttons off the card.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/discover/page.tsx
git commit -m "feat: restyle discover page with design tokens"
```

---

### Task 4: DiscoveryAgent chat panel

**Files:**
- Modify: `app/components/DiscoveryAgent.tsx` (replace the returned JSX; add one import)

**Interfaces:**
- Consumes: the color/font utilities and `SourceTypeDot` from Task 1.
- Produces: nothing new — the component keeps its existing `{ followedHandles: Set<string> }` prop and default export.

- [ ] **Step 1: Add the `SourceTypeDot` import**

Add this line directly below the existing `import { followCandidate, type Candidate } from '@/lib/sourceSearch';`:

```tsx
import SourceTypeDot from '@/app/components/SourceTypeDot';
```

- [ ] **Step 2: Restyle the returned JSX**

Replace only the `return (...)` block (currently lines 64–122). `handleSend`, `handleFollow`, `isFollowed`, all state, and the `ChatMessage` type stay exactly as they are.

```tsx
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
```

Four things worth noticing, all deliberate:
- The panel itself is a `bg-surface` card, so everything nested inside it (assistant bubbles, candidate cards, the input) uses `bg-background` instead — otherwise nested `surface`-on-`surface` would be invisible. This is why the input here departs from the canonical `bg-surface` input string.
- This replaces the earlier one-off contrast fix (`bg-gray-100 text-gray-900` on the assistant bubble) with the system's own colors.
- `whitespace-pre-wrap` preserves the line breaks the assistant writes, and `max-w-[85%]` stops a long reply from becoming one full-width wall.
- `text-left` on the bubble keeps assistant prose left-aligned even inside the right-aligned user row.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/DiscoveryAgent.tsx
git commit -m "feat: restyle DiscoveryAgent chat panel with design tokens"
```

---

### Task 5: Profile page

**Files:**
- Modify: `app/profile/page.tsx` (replace the returned JSX; add one import)

**Interfaces:**
- Consumes: the color/font utilities and `SourceTypeDot` from Task 1; the restyled `NavBar` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Add the `SourceTypeDot` import**

Add this line directly below the existing `import NavBar from '@/app/components/NavBar';`:

```tsx
import SourceTypeDot from '@/app/components/SourceTypeDot';
```

- [ ] **Step 2: Restyle the returned JSX**

Replace only the `return (...)` block (currently lines 92–151). All state, effects, `handleSaveName`, `handleUnfollow`, and `handleSignOut` stay exactly as they are.

```tsx
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
          {interests.length === 0 && (
            <p className="text-sm text-muted">Henüz ilgi alanı seçmedin.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {interests.map((label) => (
              <span
                key={label}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Takip ettiklerin</h2>
          {sources.length === 0 && (
            <p className="text-sm text-muted">Henüz kimseyi takip etmiyorsun.</p>
          )}
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{source.name}</p>
                <p className="mt-1.5 flex items-center gap-2 font-mono text-xs tracking-wide text-muted">
                  <SourceTypeDot type={source.type} />
                  <span className="truncate">
                    {source.type} · {source.url_or_handle}
                  </span>
                </p>
              </div>
              <button
                onClick={() => handleUnfollow(source.id)}
                className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent"
              >
                Takibi bırak
              </button>
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
```

The email line becomes mono metadata (it is exactly that), and the read-only interest pills get a filled `surface` background so they read as chips rather than as clickable buttons — unlike the onboarding pills in Task 6, which are interactive.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat: restyle profile page with design tokens"
```

---

### Task 6: Login and onboarding pages

**Files:**
- Modify: `app/login/page.tsx` (replace the returned JSX)
- Modify: `app/onboarding/page.tsx` (replace the returned JSX)

**Interfaces:**
- Consumes: the color utilities from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Restyle `app/login/page.tsx`**

Replace only the `return (...)` block. The `'use client'` directive, the imports, the `supabase` / `router` setup, and the `useEffect` with the auth-state subscription stay exactly as they are.

This page renders Supabase's `<Auth>` widget, which does **not** accept Tailwind classes — it is themed through `appearance.variables`, so the token hex values must be written out literally here. These are the same values Task 1 put in `tailwind.config.ts`; keep them in sync if the palette ever changes.

```tsx
  return (
    <div className="mx-auto mt-20 max-w-sm px-4">
      <h1 className="mb-6 text-2xl font-semibold">ContentHub&apos;a giriş yap</h1>
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#6C6CE5',
                brandAccent: '#5A5AD1',
                brandButtonText: '#FFFFFF',
                defaultButtonBackground: '#111117',
                defaultButtonBackgroundHover: '#1A1A22',
                defaultButtonBorder: '#22222C',
                defaultButtonText: '#F0F0F5',
                dividerBackground: '#22222C',
                inputBackground: '#111117',
                inputBorder: '#22222C',
                inputBorderHover: '#6C6CE5',
                inputBorderFocus: '#6C6CE5',
                inputText: '#F0F0F5',
                inputLabelText: '#84848E',
                inputPlaceholder: '#84848E',
                messageText: '#84848E',
                messageTextDanger: '#F87171',
                anchorTextColor: '#84848E',
                anchorTextHoverColor: '#F0F0F5',
              },
              radii: {
                borderRadiusButton: '0.5rem',
                buttonBorderRadius: '0.5rem',
                inputBorderRadius: '0.5rem',
              },
            },
          },
        }}
        redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined}
      />
    </div>
  );
```

- [ ] **Step 2: Restyle `app/onboarding/page.tsx`**

Replace only the `return (...)` block. All state, the three `useEffect` hooks, `toggleInterest`, and `addCustomInterest` stay exactly as they are.

```tsx
  return (
    <div className="mx-auto mt-16 max-w-lg px-4">
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
    </div>
  );
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TypeScript errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — 19/19, unchanged. No test in this repo touches styling; a failure here means something outside the visual layer was modified.

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx app/onboarding/page.tsx
git commit -m "feat: restyle login and onboarding pages with design tokens"
```

- [ ] **Step 6: Full manual walkthrough**

Run `npm run dev` and check every screen against the design system. The controller performs this step (it has the logged-in browser session); the implementer should stop after Step 5 and report.

1. `/login` (in a logged-out window) — dark card, indigo sign-in button, dark inputs; no white boxes anywhere.
2. `/onboarding` — unselected pills are outlined/muted, selected pills are solid indigo; the custom-interest input is dark.
3. `/feed` — cards are `surface` on `background` with a hairline border; each metadata line starts with a colored dot matching its type (youtube = coral, blog = amber); read items are dimmed; hovering a card highlights its border in indigo.
4. `/discover` — the Kaynak Asistanı panel reads as one card; sending a message shows a right-aligned indigo user bubble and a left-aligned dark assistant bubble with **readable** text (this is the bug that started the redesign); candidate cards show dots and a working "Takip et" button.
5. `/profile` — email renders in mono, interest chips are filled, follow-list rows show correct dots, both button styles look right.
6. Nav — the active tab is bright with an indigo underline; inactive tabs are muted and brighten on hover; no 2px jump when switching tabs.

Stop the dev server when done.
