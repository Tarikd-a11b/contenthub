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
});

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
