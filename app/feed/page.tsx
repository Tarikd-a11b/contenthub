'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  sortFeedByRecency,
  markAsRead,
  groupFeedByDay,
  feedPage,
  feedPageCount,
  type FeedItem,
} from '@/lib/feed';
import NavBar from '@/app/components/NavBar';
import SourceTypeDot from '@/app/components/SourceTypeDot';
import FeedThumbnail from '@/app/components/FeedThumbnail';

export default function FeedPage() {
  const supabase = createClient();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      // Oturum yoksa load() hiç çalışmaz; yükleniyor durumunu burada kapatmazsak iskelet asılı kalır.
      if (!data.user) setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      try {
        const { data: follows, error: followsError } = await supabase.from('follows').select('source_id').eq('user_id', userId);
        if (followsError) setError(followsError.message);
        const sourceIds = (follows ?? []).map((f) => f.source_id);
        if (sourceIds.length === 0) return setItems([]);

        const { data: contentRows, error: contentError } = await supabase
          .from('content_items')
          .select('id, title, url, published_at, content_type, sources(name)')
          .in('source_id', sourceIds)
          .order('published_at', { ascending: false })
          .limit(100);
        if (contentError) setError(contentError.message);

        const contentIds = (contentRows ?? []).map((row) => row.id);

        const { data: statusRows, error: statusError } = contentIds.length > 0
          ? await supabase
              .from('user_content_status')
              .select('content_item_id, read_at')
              .eq('user_id', userId)
              .in('content_item_id', contentIds)
          : { data: [], error: null };
        if (statusError) setError(statusError.message);
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
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [supabase, userId]);

  // Sayfalama tamamen istemci tarafında: veri zaten tek limit(100) sorgusuyla geldi, ek istek yok.
  const totalPages = feedPageCount(items.length);
  const groups = useMemo(() => groupFeedByDay(feedPage(items, page)), [items, page]);

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleRead(item: FeedItem) {
    if (!userId) return;
    try {
      await markAsRead(supabase, userId, item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    }
  }

  return (
    <div>
      <NavBar />
      <div className="mx-auto mt-8 max-w-2xl px-4 pb-20">
        <h1 className="text-xl font-semibold">Akış</h1>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <FeedSkeleton />
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Henüz içerik yok — bir kaynak takip et.</p>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.key}>
                <h2 className="mb-1 mt-8 font-mono text-xs uppercase tracking-wider text-muted">{group.label}</h2>
                <div className="divide-y divide-border">
                  {group.items.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleRead(item)}
                      className={`-mx-3 flex gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-surface ${
                        item.is_read ? 'opacity-50' : ''
                      }`}
                    >
                      <FeedThumbnail url={item.url} contentType={item.content_type} sourceName={item.source_name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium leading-snug">{item.title}</p>
                        <p className="mt-1.5 flex items-center gap-2 font-mono text-xs tracking-wide text-muted">
                          <SourceTypeDot type={item.content_type} />
                          {item.source_name}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ))}

            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  className="text-muted transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted"
                >
                  ← Önceki
                </button>
                <span className="text-muted">
                  Sayfa {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  className="text-muted transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted"
                >
                  Sonraki →
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="mt-8 space-y-6" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex animate-pulse gap-4">
          <div className="h-[72px] w-32 shrink-0 rounded-md bg-surface" />
          <div className="flex-1 space-y-2.5 py-1.5">
            <div className="h-3.5 w-4/5 rounded bg-surface" />
            <div className="h-3 w-1/3 rounded bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}
