import { describe, it, expect, vi } from 'vitest';
import {
  sortFeedByRecency,
  markAsRead,
  groupFeedByDay,
  youtubeThumbnail,
  feedPage,
  feedPageCount,
  type FeedItem,
} from '@/lib/feed';

/** Yerel öğlen — gün sınırına ±12 saatlik hiçbir zaman diliminde taşmaz, test makineden bağımsız kalır. */
function localNoon(y: number, m: number, d: number): string {
  return new Date(y, m, d, 12, 0, 0).toISOString();
}

function item(id: string, published_at: string, url = 'https://example.com/' + id): FeedItem {
  return { id, title: 'T' + id, url, published_at, content_type: 'youtube', source_name: 'S', is_read: false };
}

describe('sortFeedByRecency', () => {
  it('orders items newest first', () => {
    const items: FeedItem[] = [
      { id: '1', title: 'Old', url: 'https://a', published_at: '2026-01-01T00:00:00Z', content_type: 'blog', source_name: 'A', is_read: false },
      { id: '2', title: 'New', url: 'https://b', published_at: '2026-08-01T00:00:00Z', content_type: 'blog', source_name: 'B', is_read: false },
    ];
    expect(sortFeedByRecency(items).map((i) => i.id)).toEqual(['2', '1']);
  });
});

describe('groupFeedByDay', () => {
  const now = new Date(2026, 7, 10, 15, 0, 0); // 10 Ağustos 2026, yerel

  it('labels today and yesterday by name and older days by date', () => {
    const groups = groupFeedByDay(
      [
        item('a', localNoon(2026, 7, 10)),
        item('b', localNoon(2026, 7, 9)),
        item('c', localNoon(2026, 7, 7)),
      ],
      now
    );
    expect(groups.map((g) => g.label)).toEqual(['Bugün', 'Dün', '7 Ağustos']);
  });

  it('appends the year only when it differs from the current one', () => {
    const groups = groupFeedByDay([item('a', localNoon(2025, 11, 24))], now);
    expect(groups[0].label).toBe('24 Aralık 2025');
  });

  it('collects same-day items into one group and preserves input order', () => {
    const groups = groupFeedByDay(
      [
        item('a', new Date(2026, 7, 10, 9, 0).toISOString()),
        item('b', new Date(2026, 7, 10, 8, 0).toISOString()),
        item('c', localNoon(2026, 7, 9)),
      ],
      now
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('keeps items with an unparseable date in a trailing group instead of dropping them', () => {
    const groups = groupFeedByDay([item('a', localNoon(2026, 7, 10)), item('bad', 'not-a-date')], now);
    expect(groups.map((g) => g.label)).toEqual(['Bugün', 'Tarihsiz']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['bad']);
  });

  it('returns no groups for an empty feed', () => {
    expect(groupFeedByDay([], now)).toEqual([]);
  });
});

describe('youtubeThumbnail', () => {
  it('uses the original-aspect image for Shorts, since mqdefault bakes in grey bars', () => {
    expect(youtubeThumbnail('https://www.youtube.com/shorts/XYfv0T2k4h8')).toEqual({
      src: 'https://i.ytimg.com/vi/XYfv0T2k4h8/oardefault.jpg',
      fallback: 'https://i.ytimg.com/vi/XYfv0T2k4h8/mqdefault.jpg',
    });
  });

  it('uses mqdefault for regular videos, where oardefault 404s', () => {
    expect(youtubeThumbnail('https://www.youtube.com/watch?v=I07RBedXRYA')).toEqual({
      src: 'https://i.ytimg.com/vi/I07RBedXRYA/mqdefault.jpg',
      fallback: null,
    });
  });

  it('finds the id when v= is not the first query parameter', () => {
    expect(youtubeThumbnail('https://www.youtube.com/watch?list=PL123&v=I07RBedXRYA')?.src).toContain('I07RBedXRYA');
  });

  it('returns null for non-YouTube urls', () => {
    expect(youtubeThumbnail('https://yanisvaroufakis.eu/2026/08/01/post/')).toBeNull();
  });
});

describe('feedPage', () => {
  const items = Array.from({ length: 45 }, (_, i) => item(String(i), localNoon(2026, 7, 10)));

  it('counts pages, rounding a partial last page up', () => {
    expect(feedPageCount(45)).toBe(3);
    expect(feedPageCount(40)).toBe(2);
  });

  it('reports one page for an empty feed so the control never reads "Sayfa 1 / 0"', () => {
    expect(feedPageCount(0)).toBe(1);
  });

  it('slices the requested page', () => {
    expect(feedPage(items, 1).map((i) => i.id)[0]).toBe('0');
    expect(feedPage(items, 2).map((i) => i.id)[0]).toBe('20');
    expect(feedPage(items, 3)).toHaveLength(5);
  });

  it('clamps out-of-range pages instead of returning nothing', () => {
    expect(feedPage(items, 99)).toHaveLength(5);
    expect(feedPage(items, 0).map((i) => i.id)[0]).toBe('0');
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
