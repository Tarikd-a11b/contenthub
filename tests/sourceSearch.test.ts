import { describe, it, expect } from 'vitest';
import { extractCandidates } from '@/lib/sourceSearch';

describe('extractCandidates', () => {
  it('splits the reply text from a trailing JSON code block', () => {
    const input =
      'Merhaba! İşte bulduklarım.\n\n```json\n[{"type":"blog","name":"Test Blog","url_or_handle":"https://example.com","platform":"web"}]\n```';

    const result = extractCandidates(input);

    expect(result.text).toBe('Merhaba! İşte bulduklarım.');
    expect(result.candidates).toEqual([
      { type: 'blog', name: 'Test Blog', url_or_handle: 'https://example.com', platform: 'web' },
    ]);
  });

  it('defaults a missing platform to null', () => {
    const input = 'Buldum.\n\n```json\n[{"type":"youtube","name":"Chan","url_or_handle":"@chan"}]\n```';

    const result = extractCandidates(input);

    expect(result.candidates).toEqual([{ type: 'youtube', name: 'Chan', url_or_handle: '@chan', platform: null }]);
  });

  it('returns the full text unchanged when there is no JSON block', () => {
    const input = 'Üzgünüm, bu konuda takip edilebilir bir kaynak bulamadım.';

    const result = extractCandidates(input);

    expect(result.text).toBe(input);
    expect(result.candidates).toEqual([]);
  });

  it('returns the full text unchanged when the JSON block is malformed', () => {
    const input = 'Buldum ama biraz garip oldu.\n\n```json\n{not valid json\n```';

    const result = extractCandidates(input);

    expect(result.text).toBe(input);
    expect(result.candidates).toEqual([]);
  });

  it('drops candidate entries missing required fields', () => {
    const input =
      'İşte.\n\n```json\n[{"type":"blog","name":"Ok","url_or_handle":"https://ok.com"},{"name":"Missing type"}]\n```';

    const result = extractCandidates(input);

    expect(result.candidates).toEqual([{ type: 'blog', name: 'Ok', url_or_handle: 'https://ok.com', platform: null }]);
  });
});
