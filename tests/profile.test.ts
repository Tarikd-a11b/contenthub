import { describe, it, expect, vi } from 'vitest';
import {
  updateProfileName,
  unfollowSource,
  sourceProfileUrl,
  groupFollowedSources,
  groupPeopleByCategory,
  type FollowedSource,
} from '@/lib/profile';

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

  it('returns null for a youtube/x source whose "handle" is actually a bare site path (real prod cases)', () => {
    // Discovery yazdı, canlıda bulundu: bunlar @handle değil, bir web adresinin
    // yolu. '/@site.com%2Fpath' gibi kırık bir link üretmek yerine null dönmeli.
    expect(sourceProfileUrl('youtube', 'preposterousuniverse.com/podcast')).toBeNull();
    expect(sourceProfileUrl('youtube', 'youtube.com/CosmologyTalks')).toBeNull();
    expect(sourceProfileUrl('x', 'somesite.com/profile')).toBeNull();
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
    // Anahtar sütun `id` (ortak tablo, bkz. lib/profile.ts). Bu beklenti eskiden
    // user_id'ydi ve şema değişince testler geçmeye devam edip canlıyı kırdı.
    expect(upsert).toHaveBeenCalledWith({ id: 'user-1', name: 'Bilal' }, { onConflict: 'id' });
  });
});

describe('groupFollowedSources', () => {
  const src = (over: Partial<FollowedSource>): FollowedSource => ({
    id: 'id',
    name: 'name',
    type: 'blog',
    url_or_handle: 'x',
    ...over,
  });

  it('merges same-name sources across platforms into one card, category "mixed"', () => {
    const sources = [
      src({ id: '1', name: 'Barış Özcan', type: 'youtube', url_or_handle: '@barisozcan' }),
      src({ id: '2', name: 'Barış Özcan', type: 'blog', url_or_handle: 'barisozcan.com' }),
    ];

    const people = groupFollowedSources(sources);

    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('Barış Özcan');
    expect(people[0].category).toBe('mixed');
    expect(people[0].platforms).toHaveLength(2);
  });

  it('is case-insensitive when matching names', () => {
    const sources = [src({ id: '1', name: 'omnibus' }), src({ id: '2', name: 'Omnibus' })];
    expect(groupFollowedSources(sources)).toHaveLength(1);
  });

  it('merges when one platform\'s name has a " Blog" suffix the other lacks (real prod case)', () => {
    const sources = [
      src({ id: '1', name: 'Barış Özcan', type: 'youtube' }),
      src({ id: '2', name: 'Barış Özcan Blog', type: 'blog' }),
    ];
    const people = groupFollowedSources(sources);
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('Barış Özcan');
    expect(people[0].category).toBe('mixed');
  });

  it('merges when platforms use different descriptive suffixes for the same person (real prod case)', () => {
    const sources = [
      src({ id: '1', name: 'Yanis Varoufakis - English', type: 'x' }),
      src({ id: '2', name: 'Yanis Varoufakis Blog', type: 'blog' }),
    ];
    const people = groupFollowedSources(sources);
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('Yanis Varoufakis');
  });

  it('does not merge unrelated sources that happen to share no core name', () => {
    const sources = [
      src({ id: '1', name: 'Sean Carroll - Mindscape Podcast', type: 'youtube' }),
      src({ id: '2', name: 'World Science Festival (Brian Greene)', type: 'youtube' }),
    ];
    expect(groupFollowedSources(sources)).toHaveLength(2);
  });

  it('keeps a single-platform source in its own type as the category', () => {
    const sources = [src({ id: '1', name: 'Veritasium', type: 'youtube' })];
    expect(groupFollowedSources(sources)[0].category).toBe('youtube');
  });

  it('sorts people alphabetically by name', () => {
    const sources = [src({ id: '1', name: 'Zeynep' }), src({ id: '2', name: 'Ahmet' })];
    expect(groupFollowedSources(sources).map((p) => p.name)).toEqual(['Ahmet', 'Zeynep']);
  });
});

describe('groupPeopleByCategory', () => {
  it('buckets people under their category in a fixed order and drops empty categories', () => {
    const sources = [
      src({ id: '1', name: 'A', type: 'blog' }),
      src({ id: '2', name: 'B', type: 'youtube' }),
      src({ id: '3', name: 'C', type: 'youtube' }),
    ];
    const people = groupFollowedSources(sources);

    const groups = groupPeopleByCategory(people);

    expect(groups.map((g) => g.category)).toEqual(['youtube', 'blog']);
    expect(groups[0].people.map((p) => p.name)).toEqual(['B', 'C']);
    expect(groups[0].label).toBe('YouTube');
  });

  function src(over: Partial<FollowedSource>): FollowedSource {
    return { id: 'id', name: 'name', type: 'blog', url_or_handle: 'x', ...over };
  }
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
