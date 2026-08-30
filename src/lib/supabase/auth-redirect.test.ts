import { describe, expect, it } from 'vitest'
import { getAuthRedirectUrl } from './auth-redirect'

describe('getAuthRedirectUrl', () => {
  it('uses VITE_SITE_URL when configured', () => {
    expect(
      getAuthRedirectUrl('/auth/callback'),
    ).toMatch(/auth\/callback$/)
  })
})
