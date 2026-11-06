import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_OPTIONS } from './project-options'
import {
  calculateSavingsPlanPrioritySummary,
  calculateSavingsPlanPurchaseSummary,
} from './savings-plan-purchases'

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

describe('calculateSavingsPlanPrioritySummary', () => {
  it('groups standalone items by priority and keeps estimated, spent, and pending distinct', () => {
    expect(calculateSavingsPlanPrioritySummary([
      { priority: 'High', status: 'Pending', estimated_cost: 200, actual_cost: null },
      { priority: 'High', status: 'Purchased', estimated_cost: 100, actual_cost: 80 },
      { priority: 'Medium', status: 'Purchased', estimated_cost: 50, actual_cost: 75 },
    ], DEFAULT_STATUS_OPTIONS, ['High', 'Medium'])).toEqual([
      { priority: 'High', estimated: 300, spent: 80, pending: 200 },
      { priority: 'Medium', estimated: 50, spent: 75, pending: 0 },
    ])
  })

  it('inherits parent priority for subarticles without counting parent amounts', () => {
    expect(calculateSavingsPlanPrioritySummary([
      { priority: 'Critical', status: 'Pending', estimated_cost: 999, actual_cost: 500, subarticles: [
        { status: 'purchased', estimated_cost: 80, actual_cost: 95 },
        { status: 'pending', estimated_cost: 20, actual_cost: null },
      ] },
    ], DEFAULT_STATUS_OPTIONS)).toEqual([
      { priority: 'Critical', estimated: 100, spent: 95, pending: 20 },
    ])
  })

  it('uses the no-priority bucket and creates zero rows for configured priorities', () => {
    expect(calculateSavingsPlanPrioritySummary([
      { priority: '', status: 'Pending', estimated_cost: 45, actual_cost: null },
    ], DEFAULT_STATUS_OPTIONS, ['High'])).toEqual([
      { priority: 'High', estimated: 0, spent: 0, pending: 0 },
      { priority: '__none__', estimated: 45, spent: 0, pending: 45 },
    ])
  })
})
