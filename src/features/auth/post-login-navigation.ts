type LocationParts = {
  pathname: string
  search: string
  hash: string
}

const INTERNAL_ORIGIN = 'https://planora.invalid'

/** Keeps the whole in-app destination so protected deep links survive sign-in. */
export function locationDestination({ pathname, search, hash }: LocationParts): string {
  return `${pathname}${search}${hash}`
}

/** Rejects absolute, protocol-relative and malformed destinations before navigation. */
export function safePostLoginDestination(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }
  if (value.includes('\\')) return fallback

  try {
    const target = new URL(value, INTERNAL_ORIGIN)
    if (target.origin !== INTERNAL_ORIGIN) return fallback
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}
