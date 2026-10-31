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
})
