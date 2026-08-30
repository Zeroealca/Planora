import { describe, expect, it } from 'vitest'
import type { BudgetItem } from './calculations'
import {
  calculateActualSpent,
  calculateBudgetByCategory,
  calculateBudgetByPriority,
  calculateCompletionPercentage,
  calculatePendingBudget,
  calculatePlannedBudget,
  calculateRemainingBudget,
  countCompletedItems,
  filterItems,
} from './calculations'
import { formatPercent } from '@/utils/format'

function item(partial: Partial<BudgetItem> & Pick<BudgetItem, 'status'>): BudgetItem {
  return {
    priority: 'Medium',
    category_id: null,
    estimated_cost: null,
    actual_cost: null,
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

describe('budget calculations', () => {
  it('sums only Pending estimated costs as pending budget', () => {
    const items = [
      item({ status: 'Pending', estimated_cost: 100 }),
      item({ status: 'Pending', estimated_cost: 50 }),
    ]
    expect(calculatePendingBudget(items)).toBe(150)
    expect(calculateActualSpent(items)).toBe(0)
    expect(calculatePlannedBudget(items)).toBe(150)
    expect(calculateCompletionPercentage(items)).toBe(0)
  })

  it('sums only Purchased actual costs as spent', () => {
    const items = [
      item({ status: 'Purchased', estimated_cost: 200, actual_cost: 180 }),
      item({ status: 'Purchased', estimated_cost: 90, actual_cost: 90 }),
    ]
    expect(calculatePendingBudget(items)).toBe(0)
    expect(calculateActualSpent(items)).toBe(270)
    expect(calculatePlannedBudget(items)).toBe(270)
    expect(calculateCompletionPercentage(items)).toBe(100)
  })

  it('excludes AlreadyOwned from pending, spent, and planned', () => {
    const items = [item({ status: 'AlreadyOwned', estimated_cost: 180, actual_cost: 20 })]
    expect(calculatePendingBudget(items)).toBe(0)
    expect(calculateActualSpent(items)).toBe(0)
    expect(calculatePlannedBudget(items)).toBe(0)
    expect(calculateCompletionPercentage(items)).toBe(100)
  })

  it('excludes AlreadyOwned from money totals in a mixed list', () => {
    expect(calculatePendingBudget(canonical)).toBe(600)
    expect(calculateActualSpent(canonical)).toBe(620)
    expect(calculatePlannedBudget(canonical)).toBe(1220)
    expect(countCompletedItems(canonical)).toBe(2)
    expect(calculateCompletionPercentage(canonical)).toBeCloseTo(200 / 3, 5)
    expect(formatPercent(calculateCompletionPercentage(canonical))).toBe('66.67%')
  })

  it('uses actual cost when it is lower than estimated', () => {
    const items = [
      item({ status: 'Purchased', estimated_cost: 650, actual_cost: 620 }),
    ]
    expect(calculateActualSpent(items)).toBe(620)
    expect(calculatePlannedBudget(items)).toBe(620)
  })

  it('uses actual cost when it is higher than estimated', () => {
    const items = [
      item({ status: 'Purchased', estimated_cost: 100, actual_cost: 140 }),
    ]
    expect(calculateActualSpent(items)).toBe(140)
    expect(calculatePlannedBudget(items)).toBe(140)
  })

  it('treats null and non-finite costs as 0, including Purchased without actual', () => {
    const items = [
      item({ status: 'Pending', estimated_cost: null }),
      item({ status: 'Purchased', estimated_cost: 80, actual_cost: null }),
      item({ status: 'Purchased', estimated_cost: 10, actual_cost: Number.NaN }),
    ]
    expect(calculatePendingBudget(items)).toBe(0)
    expect(calculateActualSpent(items)).toBe(0)
    expect(calculatePlannedBudget(items)).toBe(0)
  })

  it('returns zeros for an empty list and never NaN', () => {
    expect(calculatePendingBudget([])).toBe(0)
    expect(calculateActualSpent([])).toBe(0)
    expect(calculatePlannedBudget([])).toBe(0)
    expect(calculateCompletionPercentage([])).toBe(0)
    expect(calculateRemainingBudget(1000, [])).toBe(1000)
    expect(Number.isNaN(calculateCompletionPercentage([]))).toBe(false)
  })

  it('returns null remaining when project budget is null', () => {
    expect(calculateRemainingBudget(null, canonical)).toBeNull()
  })

  it('subtracts spent from project budget for remaining', () => {
    expect(calculateRemainingBudget(2000, canonical)).toBe(1380)
  })

  it('breaks down budget by priority without changing other groups', () => {
    const items = [
      item({ status: 'Pending', priority: 'High', estimated_cost: 40 }),
      item({ status: 'Purchased', priority: 'Optional', actual_cost: 15 }),
    ]
    const byPriority = calculateBudgetByPriority(items)
    expect(byPriority.High).toEqual({ pending: 40, spent: 0, planned: 40 })
    expect(byPriority.Optional).toEqual({ pending: 0, spent: 15, planned: 15 })
    expect(byPriority.Critical).toEqual({ pending: 0, spent: 0, planned: 0 })
    expect(byPriority.Medium).toEqual({ pending: 0, spent: 0, planned: 0 })
  })

  it('breaks down budget by category including uncategorized items', () => {
    const items = [
      item({ status: 'Pending', category_id: 'a', estimated_cost: 10 }),
      item({ status: 'Pending', category_id: null, estimated_cost: 7 }),
    ]
    const byCategory = calculateBudgetByCategory(items)
    expect(byCategory).toEqual([
      { category_id: 'a', pending: 10, spent: 0, planned: 10 },
      { category_id: null, pending: 7, spent: 0, planned: 7 },
    ])
  })

  it('applies priority filter before calculating totals', () => {
    const filtered = filterItems(canonical, { priority: 'Critical' })
    expect(calculatePendingBudget(filtered)).toBe(600)
    const none = filterItems(
      [...canonical, item({ status: 'Pending', priority: 'Optional', estimated_cost: 5 })],
      { priority: 'Optional' },
    )
    expect(calculatePendingBudget(none)).toBe(5)
    expect(calculatePendingBudget(canonical)).toBe(600)
  })

  it('applies category filter before calculating totals', () => {
    const kitchen = filterItems(canonical, { categoryId: 'kitchen' })
    expect(calculateActualSpent(kitchen)).toBe(620)
    expect(calculatePendingBudget(kitchen)).toBe(0)
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
    expect(calculatePendingBudget(filtered)).toBe(30)
    expect(calculatePendingBudget(items)).toBe(630)
  })
})
