/**
 * Guards remote browser tests so they never point at production by accident.
 *
 * Authenticated Playwright specs require all of:
 * - E2E_SUPABASE_URL
 * - E2E_SUPABASE_ANON_KEY
 * - E2E_USER_EMAIL
 * - E2E_USER_PASSWORD
 * - E2E_ALLOWED_SUPABASE_REF (project ref of the isolated Supabase project)
 *
 * Never set these to the production project. Values must not be committed.
 */

const PLACEHOLDER_HOSTS = new Set(['e2e.invalid', 'unavailable.local', 'localhost'])

export type E2ERemoteConfig = {
  supabaseUrl: string
  supabaseAnonKey: string
  userEmail: string
  userPassword: string
  allowedRef: string
}

export function readE2ERemoteConfig(): E2ERemoteConfig | null {
  const supabaseUrl = process.env.E2E_SUPABASE_URL?.trim() ?? ''
  const supabaseAnonKey = process.env.E2E_SUPABASE_ANON_KEY?.trim() ?? ''
  const userEmail = process.env.E2E_USER_EMAIL?.trim() ?? ''
  const userPassword = process.env.E2E_USER_PASSWORD?.trim() ?? ''
  const allowedRef = process.env.E2E_ALLOWED_SUPABASE_REF?.trim() ?? ''

  if (!supabaseUrl && !supabaseAnonKey && !userEmail && !userPassword && !allowedRef) {
    return null
  }

  if (!supabaseUrl || !supabaseAnonKey || !userEmail || !userPassword || !allowedRef) {
    throw new Error(
      'E2E remoto incompleto: define E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_USER_EMAIL, E2E_USER_PASSWORD y E2E_ALLOWED_SUPABASE_REF, o ninguna de ellas.',
    )
  }

  assertSafeE2ESupabaseUrl(supabaseUrl, allowedRef)
  return { supabaseUrl, supabaseAnonKey, userEmail, userPassword, allowedRef }
}

export function assertSafeE2ESupabaseUrl(url: string, allowedRef: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`E2E_SUPABASE_URL no es una URL válida: ${url}`)
  }

  const host = parsed.hostname.toLowerCase()
  if (PLACEHOLDER_HOSTS.has(host) || host.endsWith('.invalid')) {
    throw new Error('E2E_SUPABASE_URL no puede ser un host de marcador / inválido.')
  }

  if (!host.endsWith('.supabase.co') && !host.endsWith('.supabase.in')) {
    throw new Error('E2E_SUPABASE_URL debe apuntar a un proyecto Supabase aislado.')
  }

  const projectRef = host.split('.')[0] ?? ''
  if (!projectRef || projectRef !== allowedRef) {
    throw new Error(
      `E2E_SUPABASE_URL (${projectRef}) no coincide con E2E_ALLOWED_SUPABASE_REF (${allowedRef}).`,
    )
  }

  const blocked = (process.env.E2E_BLOCKED_SUPABASE_REFS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (blocked.includes(projectRef)) {
    throw new Error(
      `El proyecto Supabase "${projectRef}" está en E2E_BLOCKED_SUPABASE_REFS y no puede usarse en E2E.`,
    )
  }
}

export function isE2ERemoteEnabled(): boolean {
  return readE2ERemoteConfig() !== null
}
