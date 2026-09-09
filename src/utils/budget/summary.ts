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

/** Partition by category_id, then apply calculateBudgetSliceMetrics per group. */
export function calculateMetricsByCategory(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): CategorySliceMetrics[] {
  const ids = new Set<string | null>()
  for (const item of items) {
    ids.add(item.category_id)
  }

  const result: CategorySliceMetrics[] = []
  for (const category_id of ids) {
    const sliceItems =
      category_id == null
        ? items.filter((item) => item.category_id == null)
        : filterItems(items, { categoryId: category_id })
    result.push({
      category_id,
      ...calculateBudgetSliceMetrics(sliceItems, statusOptions),
    })
  }
  return result
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
