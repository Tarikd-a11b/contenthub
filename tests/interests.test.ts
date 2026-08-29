import { describe, it, expect, vi } from 'vitest';
import { normalizeInterestLabel, toggleUserInterest, findOrCreateInterest } from '@/lib/interests';

describe('normalizeInterestLabel', () => {
  it('trims, collapses whitespace, and lowercases', () => {
    expect(normalizeInterestLabel('  Yapay   Zeka  ')).toBe('yapay zeka');
  });
});

describe('toggleUserInterest', () => {
  it('inserts the row when not selected', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ insert }) };

    // deno-lint-ignore no-explicit-any
    await toggleUserInterest(supabase as any, 'user-1', 'interest-1', false);

    expect(supabase.from).toHaveBeenCalledWith('user_interests');
    expect(insert).toHaveBeenCalledWith({ user_id: 'user-1', interest_id: 'interest-1' });
  });

  it('deletes the row when already selected', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const del = vi.fn().mockReturnValue({ eq: eq1 });
    const supabase = { from: vi.fn().mockReturnValue({ delete: del }) };

    // deno-lint-ignore no-explicit-any
    await toggleUserInterest(supabase as any, 'user-1', 'interest-1', true);

    expect(del).toHaveBeenCalled();
    expect(eq1).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eq2).toHaveBeenCalledWith('interest_id', 'interest-1');
  });
});

describe('findOrCreateInterest', () => {
  it('returns null for a blank label without touching supabase', async () => {
    const supabase = { from: vi.fn() };
    // deno-lint-ignore no-explicit-any
    expect(await findOrCreateInterest(supabase as any, '   ')).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('reuses an existing interest instead of creating a duplicate', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'existing-1' }, error: null });
    const ilike = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ ilike });
    const insert = vi.fn();
    const supabase = { from: vi.fn().mockReturnValue({ select, insert }) };

    // deno-lint-ignore no-explicit-any
    const result = await findOrCreateInterest(supabase as any, '  Yapay Zeka ');

    expect(ilike).toHaveBeenCalledWith('label', 'yapay zeka');
    expect(insert).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'existing-1', label: 'yapay zeka' });
  });

  it('creates a new non-preset interest when none matches', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const ilike = vi.fn().mockReturnValue({ maybeSingle });
    const select1 = vi.fn().mockReturnValue({ ilike });
    const single = vi.fn().mockResolvedValue({ data: { id: 'new-1' }, error: null });
    const select2 = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: select2 });
    const supabase = { from: vi.fn().mockReturnValue({ select: select1, insert }) };

    // deno-lint-ignore no-explicit-any
    const result = await findOrCreateInterest(supabase as any, 'roketler');

    expect(insert).toHaveBeenCalledWith({ label: 'roketler', is_preset: false });
    expect(result).toEqual({ id: 'new-1', label: 'roketler' });
  });
});
