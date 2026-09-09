/** Normalize item names for duplicate equivalence (case/space insensitive). */
export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}
