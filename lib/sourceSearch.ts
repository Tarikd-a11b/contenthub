import type { SupabaseClient } from '@supabase/supabase-js';

export type Candidate = {
  type: string;
  name: string;
  url_or_handle: string;
  platform: string | null;
};

export function extractCandidates(assistantText: string): { text: string; candidates: Candidate[] } {
  const match = assistantText.match(/```json\s*([\s\S]*?)```/);
  if (!match) {
    return { text: assistantText.trim(), candidates: [] };
  }

  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) {
      return { text: assistantText.trim(), candidates: [] };
    }

    const candidates: Candidate[] = parsed
      .filter(
        (c: unknown): c is { type: string; name: string; url_or_handle: string; platform?: unknown } =>
          typeof c === 'object' &&
          c !== null &&
          typeof (c as Record<string, unknown>).type === 'string' &&
          ((c as Record<string, unknown>).type === 'blog' ||
            (c as Record<string, unknown>).type === 'youtube' ||
            (c as Record<string, unknown>).type === 'x' ||
            (c as Record<string, unknown>).type === 'academic') &&
          typeof (c as Record<string, unknown>).name === 'string' &&
          typeof (c as Record<string, unknown>).url_or_handle === 'string'
      )
      .map((c) => ({
        type: c.type,
        name: c.name,
        url_or_handle: c.url_or_handle,
        platform: typeof c.platform === 'string' ? c.platform : null,
      }));

    return { text: assistantText.slice(0, match.index).trim(), candidates };
  } catch {
    return { text: assistantText.trim(), candidates: [] };
  }
}

export async function followCandidate(supabase: SupabaseClient, userId: string, candidate: Candidate) {
  const { data: existing, error: lookupError } = await supabase
    .from('sources')
    .select('id')
    .eq('url_or_handle', candidate.url_or_handle)
    .maybeSingle();
  if (lookupError) throw lookupError;

  let sourceId = existing?.id;
  if (!sourceId) {
    const { data: created, error: insertError } = await supabase
      .from('sources')
      .insert({ type: candidate.type, name: candidate.name, url_or_handle: candidate.url_or_handle, platform: candidate.platform })
      .select('id')
      .single();
    if (insertError) throw insertError;
    sourceId = created.id;
  }

  const { error: followError } = await supabase.from('follows').insert({ user_id: userId, source_id: sourceId });
  if (followError && followError.code !== '23505') throw followError;
}
