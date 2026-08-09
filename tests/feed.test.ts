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
