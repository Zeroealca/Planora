import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_OPTIONS } from './project-options'
import { calculateSavingsPlanPurchaseSummary } from './savings-plan-purchases'

describe('calculateSavingsPlanPurchaseSummary', () => {
  it('separates pending estimates from actual prices paid', () => {
    expect(
      calculateSavingsPlanPurchaseSummary(
        [
          { status: 'Pending', estimated_cost: 120, actual_cost: null },
          { status: 'Purchased', estimated_cost: 80, actual_cost: 75 },
          { status: 'AlreadyOwned', estimated_cost: 40, actual_cost: 40 },
        ],
        DEFAULT_STATUS_OPTIONS,
      ),
    ).toEqual({ pendingEstimated: 120, spent: 75, projected: 195, purchasedCount: 1, totalCount: 2 })
  })

  it('returns zeros for an empty article list', () => {
    expect(calculateSavingsPlanPurchaseSummary([], DEFAULT_STATUS_OPTIONS)).toEqual({
      pendingEstimated: 0,
      spent: 0,
      projected: 0,
      purchasedCount: 0,
      totalCount: 0,
    })
  })

  it('uses internal articles instead of the parent item amounts', () => {
    expect(
      calculateSavingsPlanPurchaseSummary(
        [
          {
            status: 'Pending',
            estimated_cost: 999,
            actual_cost: 500,
            subarticles: [
              { status: 'purchased', estimated_cost: 80, actual_cost: 65 },
              { status: 'purchased', estimated_cost: 40, actual_cost: 32 },
              { status: 'pending', estimated_cost: 20, actual_cost: null },
            ],
          },
        ],
        DEFAULT_STATUS_OPTIONS,
      ),
    ).toEqual({ pendingEstimated: 20, spent: 97, projected: 117, purchasedCount: 2, totalCount: 3 })
  })
})
