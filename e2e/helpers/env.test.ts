import { afterEach, describe, expect, it } from 'vitest'
import {
  assertSafeE2ESupabaseUrl,
  assertSafeLocalE2ESupabaseUrl,
  readE2EConfig,
} from './env'

const keys = [
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY',
  'E2E_USER_EMAIL',
  'E2E_USER_PASSWORD',
  'E2E_ALLOWED_SUPABASE_REF',
  'E2E_BLOCKED_SUPABASE_REFS',
  'E2E_LOCAL_SUPABASE',
  'E2E_USER_B_EMAIL',
  'E2E_USER_B_PASSWORD',
] as const

describe('E2E environment guards', () => {
  const previous = new Map<string, string | undefined>()

  afterEach(() => {
    for (const key of keys) {
      const value = previous.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    previous.clear()
  })

  function setEnv(values: Partial<Record<(typeof keys)[number], string>>) {
    for (const key of keys) {
      previous.set(key, process.env[key])
      if (key in values) process.env[key] = values[key]
      else delete process.env[key]
    }
  }

  it('returns null when no remote E2E variables are set', () => {
    setEnv({})
    expect(readE2EConfig()).toBeNull()
  })

  it('rejects a URL that does not match the allowed project ref', () => {
    expect(() =>
      assertSafeE2ESupabaseUrl('https://prodproject.supabase.co', 'e2eproject'),
    ).toThrow(/E2E_ALLOWED_SUPABASE_REF/)
  })

  it('rejects blocked production refs', () => {
    setEnv({ E2E_BLOCKED_SUPABASE_REFS: 'prodproject' })
    expect(() =>
      assertSafeE2ESupabaseUrl('https://prodproject.supabase.co', 'prodproject'),
    ).toThrow(/E2E_BLOCKED_SUPABASE_REFS/)
  })

  it('accepts a matching isolated project ref', () => {
    expect(() =>
      assertSafeE2ESupabaseUrl('https://e2eproject.supabase.co', 'e2eproject'),
    ).not.toThrow()
  })

  it('accepts localhost only after the explicit local opt-in', () => {
    setEnv({
      E2E_LOCAL_SUPABASE: 'true',
      E2E_SUPABASE_URL: 'http://127.0.0.1:54321',
      E2E_SUPABASE_ANON_KEY: 'local-anon',
      E2E_USER_EMAIL: 'planora-e2e-a@example.com',
      E2E_USER_PASSWORD: 'local-password',
    })
    expect(readE2EConfig()?.mode).toBe('local')
  })

  it('rejects a production URL in explicit local mode', () => {
    expect(() =>
      assertSafeLocalE2ESupabaseUrl('https://prodproject.supabase.co'),
    ).toThrow(/localhost o 127\.0\.0\.1/)
  })

  it('fails fast when remote variables are only partially set', () => {
    setEnv({ E2E_SUPABASE_URL: 'https://e2eproject.supabase.co' })
    expect(() => readE2EConfig()).toThrow(/E2E incompleto/)
  })
})
