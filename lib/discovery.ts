import type { SupabaseClient } from '@supabase/supabase-js';

export async function approveSuggestion(
  supabase: SupabaseClient,
  suggestion: { id: string; source_id: string; user_id: string }
) {
  const { error: followError } = await supabase
    .from('follows')
    .insert({ user_id: suggestion.user_id, source_id: suggestion.source_id });
  if (followError && followError.code !== '23505') throw followError;

  const { error: statusError } = await supabase
    .from('discovery_suggestions')
    .update({ status: 'liked' })
    .eq('id', suggestion.id);
  if (statusError) throw statusError;
}

export async function dismissSuggestion(supabase: SupabaseClient, suggestionId: string) {
  const { error } = await supabase.from('discovery_suggestions').update({ status: 'dismissed' }).eq('id', suggestionId);
  if (error) throw error;
}
