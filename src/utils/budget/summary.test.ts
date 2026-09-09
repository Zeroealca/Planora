import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_OPTIONS } from '@/features/projects/project-options'
import type { BudgetItem } from './calculations'
import {
  calculateActualSpent,
  calculateOriginalBudget,
  calculatePendingBudget,
  calculateProjectedCost,
} from './calculations'
import { calculateActualSavings, calculateExpectedSavings } from './item-savings'
import {
  calculateBudgetSliceMetrics,
  calculateMetricsByCategory,
  calculateMetricsByPriority,
  sumBudgetSliceMetrics,
} from './summary'

const statusOptions = DEFAULT_STATUS_OPTIONS

function item(partial: Partial<BudgetItem> & Pick<BudgetItem, 'status'>): BudgetItem {
  return {
    priority: 'Medium',
    category_id: null,
    estimated_cost: null,
    actual_cost: null,
    selected_option_price: null,
    ...partial,
  }
}

const catalog: BudgetItem[] = [
  item({
    status: 'Pending',
    priority: 'Critical',
    category_id: 'kitchen',
    estimated_cost: 800,
    selected_option_price: 723,
  }),
  item({
    status: 'Pending',
    priority: 'High',
    category_id: 'living',
    estimated_cost: 500,
    selected_option_price: 500,
  }),
  item({
    status: 'Purchased',
    priority: 'Critical',
    category_id: 'kitchen',
    estimated_cost: 650,
    actual_cost: 620,
  }),
  item({
    status: 'AlreadyOwned',
    priority: 'Optional',
    category_id: 'office',
    estimated_cost: 180,
  }),
]

describe('calculateBudgetSliceMetrics', () => {
  it('matches the same central totals used by the dashboard', () => {
    const slice = calculateBudgetSliceMetrics(catalog, statusOptions)
    expect(slice.itemCount).toBe(4)
    expect(slice.originalBudget).toBe(calculateOriginalBudget(catalog, statusOptions))
    expect(slice.pending).toBe(calculatePendingBudget(catalog, statusOptions))
    expect(slice.spent).toBe(calculateActualSpent(catalog, statusOptions))
    expect(slice.projectedCost).toBe(calculateProjectedCost(catalog, statusOptions))
    expect(slice.expectedSavings).toBe(calculateExpectedSavings(catalog, statusOptions))
    expect(slice.actualSavings).toBe(calculateActualSavings(catalog, statusOptions))
    expect(slice.projectedCost).toBe(slice.spent + slice.pending)
  })
})

describe('breakdown sums', () => {
  it('sum of category slices equals project totals when every item has a category', () => {
    const categorized = catalog.filter((entry) => entry.category_id != null)
    expect(categorized.every((entry) => entry.category_id != null)).toBe(true)

    const byCategory = calculateMetricsByCategory(categorized, statusOptions)
    const summed = sumBudgetSliceMetrics(byCategory)
    const totals = calculateBudgetSliceMetrics(categorized, statusOptions)

    expect(summed).toEqual(totals)
    expect(byCategory.find((slice) => slice.category_id === 'kitchen')).toMatchObject({
      itemCount: 2,
      originalBudget: 800 + 650,
      pending: 723,
      spent: 620,
      projectedCost: 723 + 620,
      expectedSavings: 77,
      actualSavings: 30,
    })
  })

  it('sum of priority slices equals project totals when every item has a priority', () => {
    expect(catalog.every((entry) => entry.priority !== '')).toBe(true)

    const byPriority = calculateMetricsByPriority(catalog, statusOptions, [
      'Critical',
      'High',
      'Medium',
      'Optional',
    ])
    const summed = sumBudgetSliceMetrics(byPriority)
    const totals = calculateBudgetSliceMetrics(catalog, statusOptions)

    expect(summed).toEqual(totals)
    expect(byPriority.find((slice) => slice.priority === 'Medium')?.itemCount).toBe(0)
  })

  it('includes uncategorized items in their own bucket so all buckets still sum to totals', () => {
    const withUncategorized = [
      ...catalog,
      item({
        status: 'Pending',
        priority: 'Medium',
        category_id: null,
        estimated_cost: 100,
      }),
    ]
    const byCategory = calculateMetricsByCategory(withUncategorized, statusOptions)
    expect(sumBudgetSliceMetrics(byCategory)).toEqual(
      calculateBudgetSliceMetrics(withUncategorized, statusOptions),
    )
  })
})
