/**
 * Dashboard slice metrics: compose the same central budget/savings functions
 * used for project totals. No alternate plannedCost implementations.
 */

import type { ProjectStatusOption } from '@/features/projects/project-options'
import {
  calculateActualSpent,
  calculateOriginalBudget,
  calculatePendingBudget,
  calculateProjectedCost,
  filterItems,
  type BudgetItem,
} from './calculations'
import {
  calculateActualSavings,
  calculateExpectedSavings,
} from './item-savings'

export type BudgetSliceMetrics = {
  itemCount: number
  originalBudget: number
  projectedCost: number
  spent: number
  pending: number
  expectedSavings: number
  actualSavings: number
}

export type CategorySliceMetrics = BudgetSliceMetrics & {
  category_id: string | null
}

export type PrioritySliceMetrics = BudgetSliceMetrics & {
  priority: string
}

/** Same metrics as the dashboard totals, for any item subset. */
export function calculateBudgetSliceMetrics(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): BudgetSliceMetrics {
  return {
    itemCount: items.length,
    originalBudget: calculateOriginalBudget(items, statusOptions),
    projectedCost: calculateProjectedCost(items, statusOptions),
    spent: calculateActualSpent(items, statusOptions),
    pending: calculatePendingBudget(items, statusOptions),
    expectedSavings: calculateExpectedSavings(items, statusOptions),
    actualSavings: calculateActualSavings(items, statusOptions),
  }
}

function emptySlice(): BudgetSliceMetrics {
  return {
    itemCount: 0,
    originalBudget: 0,
    projectedCost: 0,
    spent: 0,
    pending: 0,
    expectedSavings: 0,
    actualSavings: 0,
  }
}

export function sumBudgetSliceMetrics(
  slices: readonly BudgetSliceMetrics[],
): BudgetSliceMetrics {
  const total = emptySlice()
  for (const slice of slices) {
    total.itemCount += slice.itemCount
    total.originalBudget += slice.originalBudget
    total.projectedCost += slice.projectedCost
    total.spent += slice.spent
    total.pending += slice.pending
    total.expectedSavings += slice.expectedSavings
    total.actualSavings += slice.actualSavings
  }
  return total
}

/**
 * Partition by category_id. Always includes `categoryIds` (e.g. project categories)
 * even when empty; also any category_id present on items but missing from that list
 * (including the uncategorized `null` bucket when needed).
 */
export function calculateMetricsByCategory(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
  categoryIds: readonly (string | null)[] = [],
): CategorySliceMetrics[] {
  const ids: (string | null)[] = []
  const seen = new Set<string | null>()
  for (const id of categoryIds) {
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  for (const item of items) {
    if (seen.has(item.category_id)) continue
    seen.add(item.category_id)
    ids.push(item.category_id)
  }

  return ids.map((category_id) => {
    const sliceItems =
      category_id == null
        ? items.filter((item) => item.category_id == null)
        : filterItems(items, { categoryId: category_id })
    return {
      category_id,
      ...calculateBudgetSliceMetrics(sliceItems, statusOptions),
    }
  })
}

/**
 * Partition by priority. Always includes `priorityIds` (e.g. project options)
 * even when empty; also any priorities present on items but missing from that list.
 */
export function calculateMetricsByPriority(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
  priorityIds: readonly string[] = [],
): PrioritySliceMetrics[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const id of priorityIds) {
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  for (const item of items) {
    if (seen.has(item.priority)) continue
    seen.add(item.priority)
    ids.push(item.priority)
  }

  return ids.map((priority) => ({
    priority,
    ...calculateBudgetSliceMetrics(filterItems(items, { priority }), statusOptions),
  }))
}
