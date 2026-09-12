export const TRACKED_PRICE_TYPES = [
  'primary',
  'regular',
  'promotional',
  'cash',
  'card',
] as const

export type TrackedPriceType = (typeof TRACKED_PRICE_TYPES)[number]

export const PRICE_TRACKING_STATUSES = [
  'inactive',
  'active',
  'success',
  'price_not_found',
  'unavailable',
  'error',
  'needs_review',
] as const

export type PriceTrackingStatus = (typeof PRICE_TRACKING_STATUSES)[number]

export type PriceObservationStatus =
  | 'success'
  | 'price_not_found'
  | 'unavailable'
  | 'error'
  | 'needs_review'

export type PriceAvailability = 'available' | 'unavailable' | 'unknown'
export type PriceObservationOrigin = 'automatic' | 'manual'
export type SupportedPriceSource =
  | 'kywi'
  | 'marcimex'
  | 'crecos'
  | 'frecuento'
  | 'casasmart'
  | 'electrolux'
  | 'generic'

export type PriceSource = SupportedPriceSource | (string & {})

export type DetectedPrice = {
  type: TrackedPriceType
  value: number
}

export type PriceExtractorSuccess = {
  success: true
  source: PriceSource
  currency: string
  availability: PriceAvailability
  prices: DetectedPrice[]
}

export type PriceExtractorFailure = {
  success: false
  source: PriceSource
  status: Exclude<PriceObservationStatus, 'success' | 'needs_review'>
  availability?: PriceAvailability
  currency?: string
  prices?: DetectedPrice[]
  message?: string
}

export type PriceExtractorResult =
  | PriceExtractorSuccess
  | PriceExtractorFailure
