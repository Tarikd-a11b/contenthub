import { describe, it, expect } from 'vitest';
import { normalizeInterestLabel } from '@/lib/interests';

describe('normalizeInterestLabel', () => {
  it('trims, collapses whitespace, and lowercases', () => {
    expect(normalizeInterestLabel('  Yapay   Zeka  ')).toBe('yapay zeka');
  });
});
