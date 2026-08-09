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
