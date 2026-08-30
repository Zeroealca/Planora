export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function parseCost(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : Number.NaN
}

export function normalizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function costInputValue(value: number | null): string {
  return value == null ? '' : String(value)
}
