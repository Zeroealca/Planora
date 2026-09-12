import { describe, expect, it } from 'vitest'
import { resolveTrackedPrice } from './price-resolution'
import type { PriceExtractorResult } from './types'

describe('resolveTrackedPrice', () => {
  const result: PriceExtractorResult = {
    success: true,
    source: 'kywi',
    currency: 'USD',
    availability: 'available',
    prices: [
      { type: 'primary', value: 749 },
      { type: 'promotional', value: 699 },
    ],
  }

  it('resolves the primary price', () => {
    expect(resolveTrackedPrice(result, 'primary')).toEqual({
      status: 'found',
      price: { type: 'primary', value: 749 },
    })
  })

  it('resolves the promotional price', () => {
    expect(resolveTrackedPrice(result, 'promotional')).toEqual({
      status: 'found',
      price: { type: 'promotional', value: 699 },
    })
  })

  it('does not silently choose another price when requested type is missing', () => {
    expect(resolveTrackedPrice(result, 'cash')).toEqual({
      status: 'needs_review',
      reason: 'price_type_not_found',
      requestedType: 'cash',
      availableTypes: ['primary', 'promotional'],
    })
  })

  it('marks extraction failures as needing review', () => {
    const failed: PriceExtractorResult = {
      success: false,
      source: 'kywi',
      status: 'price_not_found',
      availability: 'unknown',
      prices: [{ type: 'primary', value: 749 }],
    }

    expect(resolveTrackedPrice(failed, 'primary')).toEqual({
      status: 'needs_review',
      reason: 'extraction_failed',
      requestedType: 'primary',
      availableTypes: ['primary'],
    })
  })
})

