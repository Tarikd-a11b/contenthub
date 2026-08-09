import type { SupabaseClient } from '@supabase/supabase-js';

export type FeedItem = {
  id: string;
  title: string;
  url: string;
  published_at: string;
  content_type: string;
  source_name: string;
  is_read: boolean;
};

export function sortFeedByRecency(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
}

export async function markAsRead(supabase: SupabaseClient, userId: string, contentItemId: string) {
  const { error } = await supabase
    .from('user_content_status')
    .upsert(
      { user_id: userId, content_item_id: contentItemId, read_at: new Date().toISOString() },
      { onConflict: 'user_id,content_item_id' }
    );
  if (error) throw error;
}
