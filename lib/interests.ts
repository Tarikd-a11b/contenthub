import type { SupabaseClient } from '@supabase/supabase-js';

export function normalizeInterestLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function toggleUserInterest(
  supabase: SupabaseClient,
  userId: string,
  interestId: string,
  isSelected: boolean
) {
  if (isSelected) {
    const { error } = await supabase
      .from('user_interests')
      .delete()
      .eq('user_id', userId)
      .eq('interest_id', interestId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('user_interests').insert({ user_id: userId, interest_id: interestId });
    if (error) throw error;
  }
}

/**
 * Var olan bir ilgi alanını (case-insensitive) bulup döndürür, yoksa yeni
 * `is_preset: false` kaydı oluşturur. Kullanıcının o ilgiyi seçmesi (user_interests)
 * ayrı bir adım — bu fonksiyon yalnızca `interests` kaydını garanti eder.
 */
export async function findOrCreateInterest(
  supabase: SupabaseClient,
  rawLabel: string
): Promise<{ id: string; label: string } | null> {
  const label = normalizeInterestLabel(rawLabel);
  if (!label) return null;

  const { data: existing, error: selectError } = await supabase
    .from('interests')
    .select('id')
    .ilike('label', label)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing?.id) return { id: existing.id, label };

  const { data, error } = await supabase.from('interests').insert({ label, is_preset: false }).select('id').single();
  if (error) throw error;
  return data ? { id: data.id, label } : null;
}
