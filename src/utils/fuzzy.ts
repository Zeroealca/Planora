/**
 * Lightweight fuzzy text matching for product search (no deps).
 * Normalizes accents/case and allows subsequence + multi-token matches.
 */

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** True if every character of `needle` appears in order inside `haystack`. */
export function isSubsequence(needle: string, haystack: string): boolean {
  if (needle === '') return true
  let i = 0
  for (const ch of haystack) {
    if (ch === needle[i]) {
      i += 1
      if (i === needle.length) return true
    }
  }
  return false
}

/**
 * Fuzzy match: empty query matches everything.
 * Accepts substring, subsequence, or every query token matching the haystack.
 */
export function fuzzyMatch(query: string, haystack: string): boolean {
  const q = normalizeSearchText(query)
  if (q === '') return true
  const h = normalizeSearchText(haystack)
  if (h.includes(q)) return true
  if (isSubsequence(q, h)) return true

  const tokens = q.split(' ').filter(Boolean)
  if (tokens.length <= 1) return false
  return tokens.every((token) => h.includes(token) || isSubsequence(token, h))
}
