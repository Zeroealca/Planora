export type DetectedPriceValidation =
  | { status: 'valid' }
  | { status: 'suspicious'; reason: 'extreme_change' }
  | { status: 'invalid'; reason: 'not_finite' | 'not_positive' | 'above_limit' }

const MAX_REASONABLE_PRICE = 1_000_000
const EXTREME_DECREASE_RATIO = 0.2
const EXTREME_INCREASE_RATIO = 5

export function validateDetectedPrice(input: {
  previousPrice: number | null
  detectedPrice: number
}): DetectedPriceValidation {
  const { previousPrice, detectedPrice } = input

  if (!Number.isFinite(detectedPrice)) {
    return { status: 'invalid', reason: 'not_finite' }
  }

  if (detectedPrice <= 0) {
    return { status: 'invalid', reason: 'not_positive' }
  }

  if (detectedPrice > MAX_REASONABLE_PRICE) {
    return { status: 'invalid', reason: 'above_limit' }
  }

  if (previousPrice != null && Number.isFinite(previousPrice) && previousPrice > 0) {
    const ratio = detectedPrice / previousPrice
    if (ratio <= EXTREME_DECREASE_RATIO || ratio >= EXTREME_INCREASE_RATIO) {
      return { status: 'suspicious', reason: 'extreme_change' }
    }
  }

  return { status: 'valid' }
}
