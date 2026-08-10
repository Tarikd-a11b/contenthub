import { describe, it, expect, vi } from 'vitest';
import { extractCandidates, followCandidate } from '@/lib/sourceSearch';

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

  it('drops candidate entries with a type outside the allowed database values', () => {
    const input =
      'İşte.\n\n```json\n[{"type":"blog","name":"Ok","url_or_handle":"https://ok.com"},{"type":"podcast","name":"Bad","url_or_handle":"https://bad.com"}]\n```';

    const result = extractCandidates(input);

    expect(result.candidates).toEqual([{ type: 'blog', name: 'Ok', url_or_handle: 'https://ok.com', platform: null }]);
  });
});

function fakeSupabaseForFollow(options: {
  existingId?: string | null;
  lookupError?: { code: string } | null;
  insertedId?: string;
  insertError?: { code: string } | null;
  followError?: { code: string } | null;
}) {
  const { existingId = null, lookupError = null, insertedId = 'src-new', insertError = null, followError = null } = options;

  const maybeSingle = vi.fn().mockResolvedValue({ data: existingId ? { id: existingId } : null, error: lookupError });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const selectForLookup = vi.fn().mockReturnValue({ eq });

  const single = vi.fn().mockResolvedValue({ data: insertError ? null : { id: insertedId }, error: insertError });
  const selectForInsert = vi.fn().mockReturnValue({ single });
  const insertSources = vi.fn().mockReturnValue({ select: selectForInsert });

  const sourcesTable = {
    select: selectForLookup,
    insert: insertSources,
  };

  const insertFollows = vi.fn().mockResolvedValue({ error: followError });
  const followsTable = { insert: insertFollows };

  const from = vi.fn((table: string) => (table === 'sources' ? sourcesTable : followsTable));

  return { from, selectForLookup, eq, maybeSingle, insertSources, selectForInsert, single, insertFollows };
}

describe('followCandidate', () => {
  it('reuses the existing source id and does not insert into sources when it already exists', async () => {
    const supabase = fakeSupabaseForFollow({ existingId: 'src-existing' });
    const candidate = { type: 'blog', name: 'Test', url_or_handle: 'https://example.com', platform: null };

    // deno-lint-ignore no-explicit-any
    await followCandidate(supabase as any, 'user-1', candidate);

    expect(supabase.selectForLookup).toHaveBeenCalledWith('id');
    expect(supabase.eq).toHaveBeenCalledWith('url_or_handle', 'https://example.com');
    expect(supabase.insertSources).not.toHaveBeenCalled();
    expect(supabase.insertFollows).toHaveBeenCalledWith({ user_id: 'user-1', source_id: 'src-existing' });
  });

  it('inserts a new source when none exists yet, then follows the newly created id', async () => {
    const supabase = fakeSupabaseForFollow({ existingId: null, insertedId: 'src-new' });
    const candidate = { type: 'blog', name: 'Test', url_or_handle: 'https://example.com', platform: null };

    // deno-lint-ignore no-explicit-any
    await followCandidate(supabase as any, 'user-1', candidate);

    expect(supabase.insertSources).toHaveBeenCalledWith({
      type: 'blog',
      name: 'Test',
      url_or_handle: 'https://example.com',
      platform: null,
    });
    expect(supabase.insertFollows).toHaveBeenCalledWith({ user_id: 'user-1', source_id: 'src-new' });
  });

  it('swallows a duplicate-follow error', async () => {
    const supabase = fakeSupabaseForFollow({ existingId: 'src-1', followError: { code: '23505' } });
    const candidate = { type: 'blog', name: 'Test', url_or_handle: 'https://example.com', platform: null };

    await expect(
      // deno-lint-ignore no-explicit-any
      followCandidate(supabase as any, 'user-1', candidate)
    ).resolves.toBeUndefined();
  });

  it('throws on other follow errors', async () => {
    const supabase = fakeSupabaseForFollow({ existingId: 'src-1', followError: { code: '500' } });
    const candidate = { type: 'blog', name: 'Test', url_or_handle: 'https://example.com', platform: null };

    await expect(
      // deno-lint-ignore no-explicit-any
      followCandidate(supabase as any, 'user-1', candidate)
    ).rejects.toEqual({ code: '500' });
  });
});
