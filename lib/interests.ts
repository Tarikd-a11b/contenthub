export function normalizeInterestLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}
