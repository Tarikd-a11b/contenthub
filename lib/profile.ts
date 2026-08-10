import type { SupabaseClient } from '@supabase/supabase-js';

export type FollowedSource = {
  id: string;
  name: string;
  type: string;
  url_or_handle: string;
};

export async function updateProfileName(supabase: SupabaseClient, userId: string, name: string) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, name }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function unfollowSource(supabase: SupabaseClient, userId: string, sourceId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('user_id', userId)
    .eq('source_id', sourceId);
  if (error) throw error;
}
