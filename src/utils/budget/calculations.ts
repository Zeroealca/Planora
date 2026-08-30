/**
 * Pure budget and completion calculations. No React, DOM, or Supabase.
 *
 * Null / NaN policy (MVP, do not mix with other fallbacks):
 * - `estimated_cost` / `actual_cost` null or non-finite → 0 in sums.
 * - `Purchased` without `actual_cost` → 0 (UI should capture actual later).
 * - `AlreadyOwned` never contributes to pending, spent, or planned.
 * - Empty item list → money totals 0, completion 0.
 * - `project.budget` null or non-finite → remaining is `null` (no target).
 */

import type { Item, ItemPriority } from '@/types/domain'

export type PriorityFilter = 'All' | ItemPriority
export type CategoryFilter = 'All' | string

export function filterItems(
  items: readonly BudgetItem[],
  filters: {
    priority?: PriorityFilter
    categoryId?: CategoryFilter
  } = {},
): BudgetItem[] {
  const priority = filters.priority ?? 'All'
  const categoryId = filters.categoryId ?? 'All'

  return items.filter((item) => {
    if (priority !== 'All' && item.priority !== priority) return false
    if (categoryId !== 'All' && item.category_id !== categoryId) return false
    return true
  })
}

export function countCompletedItems(items: readonly BudgetItem[]): number {
  let completed = 0
  for (const item of items) {
    if (item.status === 'Purchased' || item.status === 'AlreadyOwned') {
      completed += 1
    }
  }
  return completed
}

export type BudgetItem = Pick<
  Item,
  'status' | 'priority' | 'category_id' | 'estimated_cost' | 'actual_cost'
>

export interface BudgetTotals {
  pending: number
  spent: number
  planned: number
}

export type BudgetByPriority = Record<ItemPriority, BudgetTotals>

export interface CategoryBudgetTotals extends BudgetTotals {
  category_id: string | null
}

function costOrZero(value: number | null): number {
  if (value == null || !Number.isFinite(value)) return 0
  return value
}

function emptyTotals(): BudgetTotals {
  return { pending: 0, spent: 0, planned: 0 }
}

function addItem(totals: BudgetTotals, item: BudgetItem): void {
  switch (item.status) {
    case 'Pending':
      totals.pending += costOrZero(item.estimated_cost)
      break
    case 'Purchased':
      totals.spent += costOrZero(item.actual_cost)
      break
    case 'AlreadyOwned':
      break
    default: {
      const exhaustive: never = item.status
      throw new Error(`Unexpected item status: ${exhaustive}`)
    }
  }

  totals.planned = totals.pending + totals.spent
}

function totalsFor(items: readonly BudgetItem[]): BudgetTotals {
  const totals = emptyTotals()
  for (const item of items) {
    addItem(totals, item)
  }
  return totals
}

export function calculatePendingBudget(items: readonly BudgetItem[]): number {
  return totalsFor(items).pending
}

export function calculateActualSpent(items: readonly BudgetItem[]): number {
  return totalsFor(items).spent
}

export function calculatePlannedBudget(items: readonly BudgetItem[]): number {
  return totalsFor(items).planned
}

export function calculateRemainingBudget(
  projectBudget: number | null,
  items: readonly BudgetItem[],
): number | null {
  if (projectBudget == null || !Number.isFinite(projectBudget)) return null
  return projectBudget - calculateActualSpent(items)
}

/** Completed share in `[0, 100]`. Empty list → 0. */
export function calculateCompletionPercentage(
  items: readonly BudgetItem[],
): number {
  if (items.length === 0) return 0
  return (countCompletedItems(items) / items.length) * 100
}

export function calculateBudgetByPriority(
  items: readonly BudgetItem[],
): BudgetByPriority {
  const byPriority: BudgetByPriority = {
    Critical: emptyTotals(),
    High: emptyTotals(),
    Medium: emptyTotals(),
    Optional: emptyTotals(),
  }

  for (const item of items) {
    addItem(byPriority[item.priority], item)
  }

  return byPriority
}

export function calculateBudgetByCategory(
  items: readonly BudgetItem[],
): CategoryBudgetTotals[] {
  const buckets = new Map<string | null, BudgetTotals>()

  for (const item of items) {
    const existing = buckets.get(item.category_id)
    if (existing) {
      addItem(existing, item)
    } else {
      const totals = emptyTotals()
      addItem(totals, item)
      buckets.set(item.category_id, totals)
    }
  }

  const result: CategoryBudgetTotals[] = []
  for (const [category_id, totals] of buckets) {
    result.push({ category_id, ...totals })
  }
  return result
}
