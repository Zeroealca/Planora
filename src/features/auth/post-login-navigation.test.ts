import { describe, expect, it } from 'vitest'
import { locationDestination, safePostLoginDestination } from './post-login-navigation'

describe('post-login navigation', () => {
  it('preserves an internal path, query and fragment from a protected route', () => {
    const destination = locationDestination({
      pathname: '/budget/transactions',
      search: '?period=2026-10&create=1&type=income',
      hash: '#form',
    })

    expect(safePostLoginDestination(destination)).toBe(
      '/budget/transactions?period=2026-10&create=1&type=income#form',
    )
  })

  it('falls back for external, protocol-relative and malformed destinations', () => {
    expect(safePostLoginDestination('https://example.com')).toBe('/')
    expect(safePostLoginDestination('//example.com/path')).toBe('/')
    expect(safePostLoginDestination('/\\example.com')).toBe('/')
    expect(safePostLoginDestination(null)).toBe('/')
  })
})
