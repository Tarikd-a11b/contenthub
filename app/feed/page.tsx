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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
