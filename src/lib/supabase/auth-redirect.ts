/** URL absoluta para callbacks de Supabase Auth (confirmación, recovery). */
export function getAuthRedirectUrl(path = '/auth/callback'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const configuredSite = import.meta.env.VITE_SITE_URL?.trim().replace(/\/$/, '')

  if (configuredSite) {
    return `${configuredSite}${base}${normalizedPath}`
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${base}${normalizedPath}`
  }

  return `${base}${normalizedPath}`
}
