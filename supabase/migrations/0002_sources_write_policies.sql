-- supabase/migrations/0002_sources_write_policies.sql
-- Previously the only writer to public.sources was the discovery-webhook Edge
-- Function (service role, bypasses RLS). The new client-triggered "Kaynak
-- Asistanı" chat (lib/sourceSearch.ts's followCandidate) upserts directly
-- from the browser as the signed-in user, which needs its own RLS grant.
-- Mirrors the existing "interests_insert_authenticated" policy shape.

create policy "sources_insert_authenticated" on public.sources for insert with check (auth.role() = 'authenticated');
-- Intentionally no UPDATE policy: the app never needs to update an existing source row (see followCandidate).
