import { describe, expect, it } from 'vitest'
import { validateDetectedPrice } from './price-validation'

describe('validateDetectedPrice', () => {
  it('accepts a normal price change', () => {
    expect(
      validateDetectedPrice({ previousPrice: 723, detectedPrice: 699 }),
    ).toEqual({ status: 'valid' })
  })

  it('rejects zero', () => {
    expect(validateDetectedPrice({ previousPrice: 723, detectedPrice: 0 })).toEqual({
      status: 'invalid',
      reason: 'not_positive',
    })
  })

  it('rejects negative prices', () => {
    expect(
      validateDetectedPrice({ previousPrice: 723, detectedPrice: -50 }),
    ).toEqual({
      status: 'invalid',
      reason: 'not_positive',
    })
  })

  it('rejects NaN', () => {
    expect(
      validateDetectedPrice({ previousPrice: 723, detectedPrice: Number.NaN }),
    ).toEqual({
      status: 'invalid',
      reason: 'not_finite',
    })
  })

  it('marks a very large decrease as suspicious', () => {
    expect(validateDetectedPrice({ previousPrice: 723, detectedPrice: 7 })).toEqual({
      status: 'suspicious',
      reason: 'extreme_change',
    })
  })

  it('marks a very large increase as suspicious', () => {
    expect(
      validateDetectedPrice({ previousPrice: 723, detectedPrice: 7000 }),
    ).toEqual({
      status: 'suspicious',
      reason: 'extreme_change',
    })
  })

  it('accepts a positive first detected price without previous price', () => {
    expect(
      validateDetectedPrice({ previousPrice: null, detectedPrice: 699 }),
    ).toEqual({ status: 'valid' })
  })
})
