const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
])

export function normalizeProductUrl(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

    url.hostname = url.hostname.toLowerCase()
    url.hash = ''

    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key)
      }
    }

    return url.toString()
  } catch {
    return null
  }
}
