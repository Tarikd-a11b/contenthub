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
