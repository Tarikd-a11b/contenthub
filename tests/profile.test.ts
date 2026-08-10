import { describe, it, expect, vi } from 'vitest';
import { updateProfileName, unfollowSource } from '@/lib/profile';

describe('updateProfileName', () => {
  it('upserts the profile row for the user', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };

    // deno-lint-ignore no-explicit-any
    await updateProfileName(supabase as any, 'user-1', 'Bilal');

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(upsert).toHaveBeenCalledWith({ user_id: 'user-1', name: 'Bilal' }, { onConflict: 'user_id' });
  });
});

describe('unfollowSource', () => {
  it('deletes the follow row for the user and source', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const del = vi.fn().mockReturnValue({ eq: eq1 });
    const supabase = { from: vi.fn().mockReturnValue({ delete: del }) };

    // deno-lint-ignore no-explicit-any
    await unfollowSource(supabase as any, 'user-1', 'src-1');

    expect(supabase.from).toHaveBeenCalledWith('follows');
    expect(eq1).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eq2).toHaveBeenCalledWith('source_id', 'src-1');
  });
});
