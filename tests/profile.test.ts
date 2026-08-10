import { describe, it, expect, vi } from 'vitest';
import { updateProfileName, unfollowSource, sourceProfileUrl } from '@/lib/profile';

describe('sourceProfileUrl', () => {
  it('builds a YouTube channel url from an @handle', () => {
    expect(sourceProfileUrl('youtube', '@veritasium')).toBe('https://www.youtube.com/@veritasium');
  });

  it('builds an X profile url, with or without the leading @', () => {
    expect(sourceProfileUrl('x', '@DAcemogluMIT')).toBe('https://x.com/DAcemogluMIT');
    expect(sourceProfileUrl('x', 'kirkdokuzW')).toBe('https://x.com/kirkdokuzW');
  });

  it('adds the missing scheme to a bare blog domain', () => {
    expect(sourceProfileUrl('blog', 'yanisvaroufakis.eu')).toBe('https://yanisvaroufakis.eu');
  });

  it('passes an already-complete url through untouched', () => {
    const url = 'https://scholar.google.com.tr/citations?user=eWktLuQAAAAJ&hl=tr';
    expect(sourceProfileUrl('academic', url)).toBe(url);
    expect(sourceProfileUrl('youtube', 'https://www.youtube.com/@omnibus')).toBe('https://www.youtube.com/@omnibus');
  });

  it('uses the /channel/ path for a full channel id', () => {
    expect(sourceProfileUrl('youtube', 'UC7_gcs09iThXybpVgjHZ_7g')).toBe(
      'https://www.youtube.com/channel/UC7_gcs09iThXybpVgjHZ_7g'
    );
  });

  it('percent-encodes non-ascii handles', () => {
    expect(sourceProfileUrl('youtube', '@MoxoTürkiye')).toBe('https://www.youtube.com/@MoxoT%C3%BCrkiye');
  });

  it('returns null for a truncated channel id rather than linking to a 404', () => {
    expect(sourceProfileUrl('youtube', 'UCmZUV...')).toBeNull();
    expect(sourceProfileUrl('youtube', 'UCshort')).toBeNull();
  });

  it('returns null for empty input and unknown types', () => {
    expect(sourceProfileUrl('youtube', '   ')).toBeNull();
    expect(sourceProfileUrl('x', '@')).toBeNull();
    expect(sourceProfileUrl('podcast', 'whatever')).toBeNull();
  });
});

describe('updateProfileName', () => {
  it('upserts the profile row for the user', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };

    // deno-lint-ignore no-explicit-any
    await updateProfileName(supabase as any, 'user-1', 'Bilal');

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(upsert).toHaveBeenCalledWith({ user_id: 'user-1', name: 'Bilal' }, { onConflict: 'user_id' });
  });
});

describe('unfollowSource', () => {
  it('deletes the follow row for the user and source', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const del = vi.fn().mockReturnValue({ eq: eq1 });
    const supabase = { from: vi.fn().mockReturnValue({ delete: del }) };

    // deno-lint-ignore no-explicit-any
    await unfollowSource(supabase as any, 'user-1', 'src-1');

    expect(supabase.from).toHaveBeenCalledWith('follows');
    expect(eq1).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eq2).toHaveBeenCalledWith('source_id', 'src-1');
  });
});
