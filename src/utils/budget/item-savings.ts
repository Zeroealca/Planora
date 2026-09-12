/**
 * Derived purchase savings vs original item budget.
 * Separate from project savings-plan (monthly contributions) in ./savings.ts.
 * Not persisted — computed from item costs and selected option price.
 */

import type { ProjectStatusOption } from '@/features/projects/project-options'
import { getStatusBehavior } from '@/features/projects/project-options'
import type { BudgetItem } from './calculations'

function isFiniteCost(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value)
}

function quantityOrOne(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 1
  return value
}

/**
 * Ahorro esperado for one item.
 * Only pending with estimated_cost: estimated total − projected option total.
 * Positive = ahorro esperado; negative = sobrecosto esperado.
 * null = no aplica (faltan datos o status distinto).
 */
export function expectedSavingsForItem(
  item: BudgetItem,
  statusOptions: readonly ProjectStatusOption[],
): number | null {
  if (getStatusBehavior(item.status, statusOptions) !== 'pending') return null
  if (!isFiniteCost(item.estimated_cost)) return null
  const projected =
    item.selected_option_price != null && Number.isFinite(item.selected_option_price)
      ? item.selected_option_price * quantityOrOne(item.quantity)
      : item.estimated_cost
  return item.estimated_cost - projected
}

/**
 * Ahorro real for one item.
 * Only purchased with estimated_cost and actual_cost: estimated total − actual total.
 * Positive = ahorro real; negative = sobrecosto real.
 * null = no aplica.
 */
export function actualSavingsForItem(
  item: BudgetItem,
  statusOptions: readonly ProjectStatusOption[],
): number | null {
  if (getStatusBehavior(item.status, statusOptions) !== 'purchased') return null
  if (!isFiniteCost(item.estimated_cost) || !isFiniteCost(item.actual_cost)) return null
  return item.estimated_cost - item.actual_cost
}

function sumNullable(values: readonly (number | null)[]): number {
  let total = 0
  for (const value of values) {
    if (value != null) total += value
  }
  return total
}

/** Total ahorro esperado del conjunto (solo pending aplicables). */
export function calculateExpectedSavings(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  return sumNullable(items.map((item) => expectedSavingsForItem(item, statusOptions)))
}

/** Total ahorro real del conjunto (solo purchased aplicables). */
export function calculateActualSavings(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  return sumNullable(items.map((item) => actualSavingsForItem(item, statusOptions)))
}

export function calculateExpectedSavingsByPriority(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): Record<string, number> {
  const byPriority: Record<string, number> = {}
  for (const item of items) {
    const delta = expectedSavingsForItem(item, statusOptions)
    if (delta == null) continue
    byPriority[item.priority] = (byPriority[item.priority] ?? 0) + delta
  }
  return byPriority
}

export function calculateActualSavingsByPriority(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): Record<string, number> {
  const byPriority: Record<string, number> = {}
  for (const item of items) {
    const delta = actualSavingsForItem(item, statusOptions)
    if (delta == null) continue
    byPriority[item.priority] = (byPriority[item.priority] ?? 0) + delta
  }
  return byPriority
}

export type CategorySavingsTotal = {
  category_id: string | null
  amount: number
}

export function calculateExpectedSavingsByCategory(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): CategorySavingsTotal[] {
  const buckets = new Map<string | null, number>()
  for (const item of items) {
    const delta = expectedSavingsForItem(item, statusOptions)
    if (delta == null) continue
    buckets.set(item.category_id, (buckets.get(item.category_id) ?? 0) + delta)
  }
  const result: CategorySavingsTotal[] = []
  for (const [category_id, amount] of buckets) {
    result.push({ category_id, amount })
  }
  return result
}

export function calculateActualSavingsByCategory(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): CategorySavingsTotal[] {
  const buckets = new Map<string | null, number>()
  for (const item of items) {
    const delta = actualSavingsForItem(item, statusOptions)
    if (delta == null) continue
    buckets.set(item.category_id, (buckets.get(item.category_id) ?? 0) + delta)
  }
  const result: CategorySavingsTotal[] = []
  for (const [category_id, amount] of buckets) {
    result.push({ category_id, amount })
  }
  return result
}

/** Presentation helper: positive = ahorro, negative = sobrecosto. */
export function savingsKind(amount: number): 'savings' | 'overcost' | 'neutral' {
  if (amount > 0) return 'savings'
  if (amount < 0) return 'overcost'
  return 'neutral'
}
