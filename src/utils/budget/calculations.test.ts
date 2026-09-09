import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_OPTIONS } from '@/features/projects/project-options'
import type { BudgetItem } from './calculations'
import {
  calculateActualSpent,
  calculateBudgetByCategory,
  calculateBudgetByPriority,
  calculateCompletionPercentage,
  calculateOriginalBudget,
  calculatePendingBudget,
  calculatePlannedBudget,
  calculateProjectedBalance,
  calculateProjectedCost,
  calculateRemainingBudget,
  countCompletedItems,
  countItemsByBehavior,
  filterItems,
  plannedCost,
  plannedPrice,
} from './calculations'
import { formatPercent } from '@/utils/format'

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

const canonical: BudgetItem[] = [
  item({
    status: 'Pending',
    priority: 'Critical',
    category_id: 'living',
    estimated_cost: 600,
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
    priority: 'Critical',
    category_id: 'office',
    estimated_cost: 180,
  }),
]

describe('plannedPrice / plannedCost', () => {
  it('Pending: estimated 800, no option → plannedCost 800', () => {
    const fridge = item({ status: 'Pending', estimated_cost: 800 })
    expect(plannedPrice(fridge)).toBe(800)
    expect(plannedCost(fridge, statusOptions)).toBe(800)
  })

  it('Pending: estimated 800, selected option 723 → plannedCost 723', () => {
    const fridge = item({
      status: 'Pending',
      estimated_cost: 800,
      selected_option_price: 723,
    })
    expect(plannedPrice(fridge)).toBe(723)
    expect(plannedCost(fridge, statusOptions)).toBe(723)
  })

  it('Purchased: estimated 800, option 723, actual 699 → plannedCost 699', () => {
    const fridge = item({
      status: 'Purchased',
      estimated_cost: 800,
      selected_option_price: 723,
      actual_cost: 699,
    })
    expect(plannedCost(fridge, statusOptions)).toBe(699)
  })

  it('Purchased: estimated 800, option 723, actual null → plannedCost 723', () => {
    const fridge = item({
      status: 'Purchased',
      estimated_cost: 800,
      selected_option_price: 723,
      actual_cost: null,
    })
    expect(plannedCost(fridge, statusOptions)).toBe(723)
  })

  it('Already owned: estimated 800 → plannedCost 0', () => {
    const fridge = item({ status: 'AlreadyOwned', estimated_cost: 800 })
    expect(plannedCost(fridge, statusOptions)).toBe(0)
  })
})

describe('budget calculations', () => {
  it('sums Pending via plannedCost (estimated when no option)', () => {
    const items = [
      item({ status: 'Pending', estimated_cost: 100 }),
      item({ status: 'Pending', estimated_cost: 50 }),
    ]
    expect(calculatePendingBudget(items, statusOptions)).toBe(150)
    expect(calculateActualSpent(items, statusOptions)).toBe(0)
    expect(calculatePlannedBudget(items, statusOptions)).toBe(150)
    expect(calculateCompletionPercentage(items, statusOptions)).toBe(0)
  })

  it('uses selected option price for Pending pending budget', () => {
    const items = [
      item({ status: 'Pending', estimated_cost: 800, selected_option_price: 723 }),
    ]
    expect(calculatePendingBudget(items, statusOptions)).toBe(723)
    expect(calculatePlannedBudget(items, statusOptions)).toBe(723)
  })

  it('sums only Purchased actual costs as spent', () => {
    const items = [
      item({ status: 'Purchased', estimated_cost: 200, actual_cost: 180 }),
      item({ status: 'Purchased', estimated_cost: 90, actual_cost: 90 }),
    ]
    expect(calculatePendingBudget(items, statusOptions)).toBe(0)
    expect(calculateActualSpent(items, statusOptions)).toBe(270)
    expect(calculatePlannedBudget(items, statusOptions)).toBe(270)
    expect(calculateCompletionPercentage(items, statusOptions)).toBe(100)
  })

  it('excludes AlreadyOwned from pending, spent, and planned', () => {
    const items = [item({ status: 'AlreadyOwned', estimated_cost: 180, actual_cost: 20 })]
    expect(calculatePendingBudget(items, statusOptions)).toBe(0)
    expect(calculateActualSpent(items, statusOptions)).toBe(0)
    expect(calculatePlannedBudget(items, statusOptions)).toBe(0)
    expect(calculateCompletionPercentage(items, statusOptions)).toBe(100)
  })

  it('excludes AlreadyOwned from money totals in a mixed list', () => {
    expect(calculatePendingBudget(canonical, statusOptions)).toBe(600)
    expect(calculateActualSpent(canonical, statusOptions)).toBe(620)
    expect(calculatePlannedBudget(canonical, statusOptions)).toBe(1220)
    expect(countCompletedItems(canonical, statusOptions)).toBe(2)
    expect(calculateCompletionPercentage(canonical, statusOptions)).toBeCloseTo(200 / 3, 5)
    expect(formatPercent(calculateCompletionPercentage(canonical, statusOptions))).toBe(
      '66.67%',
    )
  })

  it('uses actual cost when it is lower than estimated', () => {
    const items = [
      item({ status: 'Purchased', estimated_cost: 650, actual_cost: 620 }),
    ]
    expect(calculateActualSpent(items, statusOptions)).toBe(620)
    expect(calculatePlannedBudget(items, statusOptions)).toBe(620)
  })

  it('uses actual cost when it is higher than estimated', () => {
    const items = [
      item({ status: 'Purchased', estimated_cost: 100, actual_cost: 140 }),
    ]
    expect(calculateActualSpent(items, statusOptions)).toBe(140)
    expect(calculatePlannedBudget(items, statusOptions)).toBe(140)
  })

  it('treats null and non-finite costs as 0 for aggregates; spent ignores option fallback', () => {
    const items = [
      item({ status: 'Pending', estimated_cost: null }),
      item({ status: 'Purchased', estimated_cost: 80, actual_cost: null }),
      item({ status: 'Purchased', estimated_cost: 10, actual_cost: Number.NaN }),
    ]
    expect(calculatePendingBudget(items, statusOptions)).toBe(0)
    expect(calculateActualSpent(items, statusOptions)).toBe(0)
    expect(calculatePlannedBudget(items, statusOptions)).toBe(0)
    expect(plannedCost(items[1]!, statusOptions)).toBe(80)
  })

  it('returns null projected balance when project budget is null', () => {
    expect(calculateProjectedBalance(null, canonical, statusOptions)).toBeNull()
    expect(calculateRemainingBudget(null, canonical, statusOptions)).toBeNull()
  })

  it('projectedCost equals spent + pending; projectedBalance equals budget - projectedCost', () => {
    const spent = calculateActualSpent(canonical, statusOptions)
    const pending = calculatePendingBudget(canonical, statusOptions)
    const projected = calculateProjectedCost(canonical, statusOptions)
    expect(projected).toBe(spent + pending)
    expect(calculatePlannedBudget(canonical, statusOptions)).toBe(projected)
    expect(calculateProjectedBalance(2000, canonical, statusOptions)).toBe(2000 - projected)
    expect(calculateRemainingBudget(2000, canonical, statusOptions)).toBe(2000 - projected)
  })

  it('marks over-budget when projected cost exceeds available budget', () => {
    expect(calculateProjectedBalance(500, canonical, statusOptions)).toBe(500 - 1220)
    expect(calculateProjectedBalance(500, canonical, statusOptions)).toBeLessThan(0)
  })

  it('sums original budget from estimated_cost excluding already_owned', () => {
    // 600 pending + 650 purchased; 180 owned excluded
    expect(calculateOriginalBudget(canonical, statusOptions)).toBe(1250)
    expect(
      calculateOriginalBudget(
        [item({ status: 'AlreadyOwned', estimated_cost: 999 })],
        statusOptions,
      ),
    ).toBe(0)
  })

  it('counts items by status behavior', () => {
    const counts = countItemsByBehavior(canonical, statusOptions)
    expect(counts).toEqual({
      pending: 1,
      purchased: 1,
      owned: 1,
      completed: 2,
      total: 3,
    })
    expect(countCompletedItems(canonical, statusOptions)).toBe(2)
  })

  it('does not invent spent for purchased without actual_cost', () => {
    const items = [
      item({
        status: 'Purchased',
        estimated_cost: 800,
        selected_option_price: 723,
        actual_cost: null,
      }),
    ]
    expect(calculateActualSpent(items, statusOptions)).toBe(0)
    expect(calculateProjectedCost(items, statusOptions)).toBe(0)
  })

  it('returns zeros for empty projected metrics', () => {
    expect(calculatePendingBudget([], statusOptions)).toBe(0)
    expect(calculateActualSpent([], statusOptions)).toBe(0)
    expect(calculatePlannedBudget([], statusOptions)).toBe(0)
    expect(calculateProjectedCost([], statusOptions)).toBe(0)
    expect(calculateCompletionPercentage([], statusOptions)).toBe(0)
    expect(calculateProjectedBalance(1000, [], statusOptions)).toBe(1000)
    expect(Number.isNaN(calculateCompletionPercentage([], statusOptions))).toBe(false)
  })

  it('breaks down budget by priority without changing other groups', () => {
    const items = [
      item({ status: 'Pending', priority: 'High', estimated_cost: 40 }),
      item({ status: 'Purchased', priority: 'Optional', actual_cost: 15 }),
    ]
    const byPriority = calculateBudgetByPriority(items, statusOptions)
    expect(byPriority.High).toEqual({ pending: 40, spent: 0, planned: 40 })
    expect(byPriority.Optional).toEqual({ pending: 0, spent: 15, planned: 15 })
    expect(byPriority.Critical).toBeUndefined()
    expect(byPriority.Medium).toBeUndefined()
  })

  it('breaks down budget by category including uncategorized items', () => {
    const items = [
      item({ status: 'Pending', category_id: 'a', estimated_cost: 10 }),
      item({ status: 'Pending', category_id: null, estimated_cost: 7 }),
    ]
    const byCategory = calculateBudgetByCategory(items, statusOptions)
    expect(byCategory).toEqual([
      { category_id: 'a', pending: 10, spent: 0, planned: 10 },
      { category_id: null, pending: 7, spent: 0, planned: 7 },
    ])
  })

  it('applies priority filter before calculating totals', () => {
    const filtered = filterItems(canonical, { priority: 'Critical' })
    expect(calculatePendingBudget(filtered, statusOptions)).toBe(600)
    const none = filterItems(
      [...canonical, item({ status: 'Pending', priority: 'Optional', estimated_cost: 5 })],
      { priority: 'Optional' },
    )
    expect(calculatePendingBudget(none, statusOptions)).toBe(5)
    expect(calculatePendingBudget(canonical, statusOptions)).toBe(600)
  })

  it('applies category filter before calculating totals', () => {
    const kitchen = filterItems(canonical, { categoryId: 'kitchen' })
    expect(calculateActualSpent(kitchen, statusOptions)).toBe(620)
    expect(calculatePendingBudget(kitchen, statusOptions)).toBe(0)
  })

  it('combines priority and category filters without mutating the original list', () => {
    const extra = item({
      status: 'Pending',
      priority: 'High',
      category_id: 'kitchen',
      estimated_cost: 30,
    })
    const items = [...canonical, extra]
    const snapshot = [...items]
    const filtered = filterItems(items, { priority: 'High', categoryId: 'kitchen' })
    expect(filtered).toEqual([extra])
    expect(items).toEqual(snapshot)
    expect(calculatePendingBudget(filtered, statusOptions)).toBe(30)
    expect(calculatePendingBudget(items, statusOptions)).toBe(630)
  })
})
