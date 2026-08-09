import { describe, it, expect, vi } from 'vitest';
import { approveSuggestion, dismissSuggestion } from '@/lib/discovery';

function fakeSupabase() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  return {
    insert,
    update,
    from: vi.fn().mockReturnValue({ insert, update }),
  };
}

describe('approveSuggestion', () => {
  it('inserts a follow then marks the suggestion liked', async () => {
    const supabase = fakeSupabase();
    // deno-lint-ignore no-explicit-any
    await approveSuggestion(supabase as any, { id: 'sugg-1', source_id: 'src-1', user_id: 'user-1' });

    expect(supabase.insert).toHaveBeenCalledWith({ user_id: 'user-1', source_id: 'src-1' });
    expect(supabase.update).toHaveBeenCalledWith({ status: 'liked' });
  });
});

describe('dismissSuggestion', () => {
  it('marks the suggestion dismissed', async () => {
    const supabase = fakeSupabase();
    // deno-lint-ignore no-explicit-any
    await dismissSuggestion(supabase as any, 'sugg-1');

    expect(supabase.update).toHaveBeenCalledWith({ status: 'dismissed' });
  });
});
