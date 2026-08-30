import { describe, expect, it } from 'vitest'
import { formatMoney } from './format'

describe('formatMoney', () => {
  it('formats USD by default', () => {
    expect(formatMoney(1234.5)).toContain('US$')
    expect(formatMoney(1234.5)).toMatch(/1234,5|1\.234,5/)
  })

  it('formats EUR when specified', () => {
    expect(formatMoney(100, 'EUR')).toContain('€')
    expect(formatMoney(100, 'EUR')).toMatch(/100/)
  })
})
