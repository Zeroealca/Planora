import type {
  DetectedPrice,
  PriceExtractorResult,
  TrackedPriceType,
} from './types'

export type TrackedPriceResolution =
  | {
      status: 'found'
      price: DetectedPrice
    }
  | {
      status: 'needs_review'
      reason: 'extraction_failed' | 'price_type_not_found'
      requestedType: TrackedPriceType
      availableTypes: TrackedPriceType[]
    }

export function resolveTrackedPrice(
  result: PriceExtractorResult,
  trackedPriceType: TrackedPriceType,
): TrackedPriceResolution {
  const availableTypes = (result.prices ?? []).map((price) => price.type)
  if (!result.success) {
    return {
      status: 'needs_review',
      reason: 'extraction_failed',
      requestedType: trackedPriceType,
      availableTypes,
    }
  }

  const price = result.prices.find((detected) => detected.type === trackedPriceType)
  if (!price) {
    return {
      status: 'needs_review',
      reason: 'price_type_not_found',
      requestedType: trackedPriceType,
      availableTypes,
    }
  }

  return { status: 'found', price }
}

