/**
 * Pure budget and completion calculations. No React, DOM, or Supabase.
 *
 * Status behavior comes from per-project `ProjectStatusOption` lists.
 */

import type { ProjectStatusOption, StatusBehavior } from '@/features/projects/project-options'
import { getStatusBehavior, isCompletedBehavior } from '@/features/projects/project-options'

export type PriorityFilter = 'All' | string
export type CategoryFilter = 'All' | string
export type StatusFilter = 'All' | string

export function filterItems(
  items: readonly BudgetItem[],
  filters: {
    priority?: PriorityFilter
    categoryId?: CategoryFilter
    status?: StatusFilter
  } = {},
): BudgetItem[] {
  const priority = filters.priority ?? 'All'
  const categoryId = filters.categoryId ?? 'All'
  const status = filters.status ?? 'All'

  return items.filter((item) => {
    if (priority !== 'All' && item.priority !== priority) return false
    if (categoryId !== 'All' && item.category_id !== categoryId) return false
    if (status !== 'All' && item.status !== status) return false
    return true
  })
}

export function countCompletedItems(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  let completed = 0
  for (const item of items) {
    if (isCompletedBehavior(getStatusBehavior(item.status, statusOptions))) {
      completed += 1
    }
  }
  return completed
}

export type BudgetItem = {
  status: string
  priority: string
  category_id: string | null
  estimated_cost: number | null
  actual_cost: number | null
}

export interface BudgetTotals {
  pending: number
  spent: number
  planned: number
}

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

function addItem(
  totals: BudgetTotals,
  item: BudgetItem,
  behavior: StatusBehavior,
): void {
  switch (behavior) {
    case 'pending':
      totals.pending += costOrZero(item.estimated_cost)
      break
    case 'purchased':
      totals.spent += costOrZero(item.actual_cost)
      break
    case 'owned':
      break
    default: {
      const exhaustive: never = behavior
      throw new Error(`Unexpected status behavior: ${exhaustive}`)
    }
  }

  totals.planned = totals.pending + totals.spent
}

function totalsFor(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): BudgetTotals {
  const totals = emptyTotals()
  for (const item of items) {
    addItem(totals, item, getStatusBehavior(item.status, statusOptions))
  }
  return totals
}

export function calculatePendingBudget(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  return totalsFor(items, statusOptions).pending
}

export function calculateActualSpent(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  return totalsFor(items, statusOptions).spent
}

export function calculatePlannedBudget(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  return totalsFor(items, statusOptions).planned
}

export function calculateRemainingBudget(
  projectBudget: number | null,
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number | null {
  if (projectBudget == null || !Number.isFinite(projectBudget)) return null
  return projectBudget - calculateActualSpent(items, statusOptions)
}

export function calculateCompletionPercentage(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  if (items.length === 0) return 0
  return (countCompletedItems(items, statusOptions) / items.length) * 100
}

export function calculateBudgetByPriority(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): Record<string, BudgetTotals> {
  const byPriority: Record<string, BudgetTotals> = {}

  for (const item of items) {
    const bucket = byPriority[item.priority] ?? emptyTotals()
    addItem(bucket, item, getStatusBehavior(item.status, statusOptions))
    byPriority[item.priority] = bucket
  }

  return byPriority
}

export function calculateBudgetByCategory(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): CategoryBudgetTotals[] {
  const buckets = new Map<string | null, BudgetTotals>()

  for (const item of items) {
    const behavior = getStatusBehavior(item.status, statusOptions)
    const existing = buckets.get(item.category_id)
    if (existing) {
      addItem(existing, item, behavior)
    } else {
      const totals = emptyTotals()
      addItem(totals, item, behavior)
      buckets.set(item.category_id, totals)
    }
  }

  const result: CategoryBudgetTotals[] = []
  for (const [category_id, totals] of buckets) {
    result.push({ category_id, ...totals })
  }
  return result
}
