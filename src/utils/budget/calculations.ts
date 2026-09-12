/**
 * Pure budget and completion calculations. No React, DOM, or Supabase.
 *
 * Status behavior comes from per-project `ProjectStatusOption` lists.
 * Financial item costs go through plannedPrice / plannedCost only.
 */

import type { ProjectStatusOption, StatusBehavior } from '@/features/projects/project-options'
import { getStatusBehavior } from '@/features/projects/project-options'

export type PriorityFilter = 'All' | string
export type CategoryFilter = 'All' | string
export type StatusFilter = 'All' | string

export type BudgetItem = {
  status: string
  priority: string
  category_id: string | null
  quantity: number
  estimated_cost: number | null
  actual_cost: number | null
  /** Price of the selected option, if any (derived; not a DB column). */
  selected_option_price: number | null
}

export interface BudgetTotals {
  pending: number
  spent: number
  planned: number
}

export interface CategoryBudgetTotals extends BudgetTotals {
  category_id: string | null
}

export type BudgetItemInput = {
  status: string
  priority: string
  category_id: string | null
  quantity?: number | null
  estimated_cost: number | null
  actual_cost: number | null
  selected_option_price?: number | null
  options?: readonly { selected: boolean; price: number | null }[] | null
}

function costOrZero(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return value
}

function quantityOrOne(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 1
  return value
}

/** Selected option price when present and finite; otherwise null. */
export function getSelectedOptionPrice(
  options: readonly { selected: boolean; price: number | null }[] | null | undefined,
): number | null {
  const selected = options?.find((option) => option.selected)
  if (!selected) return null
  if (selected.price == null || !Number.isFinite(selected.price)) return null
  return selected.price
}

/** Normalize any item-like row into a BudgetItem for financial functions. */
export function toBudgetItem(item: BudgetItemInput): BudgetItem {
  const fromField =
    item.selected_option_price != null && Number.isFinite(item.selected_option_price)
      ? item.selected_option_price
      : null
  return {
    status: item.status,
    priority: item.priority,
    category_id: item.category_id,
    quantity: quantityOrOne(item.quantity),
    estimated_cost: item.estimated_cost,
    actual_cost: item.actual_cost,
    selected_option_price: fromField ?? getSelectedOptionPrice(item.options),
  }
}

/**
 * Derived expected purchase price (ignores status).
 * selected option unit price → else estimated total budget → else 0.
 * When this comes from an option, plannedCost applies quantity.
 */
export function plannedPrice(
  item: Pick<BudgetItem, 'estimated_cost' | 'selected_option_price'>,
): number {
  if (item.selected_option_price != null && Number.isFinite(item.selected_option_price)) {
    return item.selected_option_price
  }
  return costOrZero(item.estimated_cost)
}

/**
 * Derived cost contribution of an item according to status behavior.
 * already_owned → 0
 * purchased → actual total ?? selected option unit price × quantity ?? estimated total ?? 0
 * pending → selected option unit price × quantity ?? estimated total ?? 0
 */
export function plannedCost(
  item: BudgetItem,
  statusOptions: readonly ProjectStatusOption[],
): number {
  const behavior = getStatusBehavior(item.status, statusOptions)
  const quantity = quantityOrOne(item.quantity)
  switch (behavior) {
    case 'owned':
      return 0
    case 'purchased': {
      if (item.actual_cost != null && Number.isFinite(item.actual_cost)) {
        return item.actual_cost
      }
      if (item.selected_option_price != null && Number.isFinite(item.selected_option_price)) {
        return item.selected_option_price * quantity
      }
      return costOrZero(item.estimated_cost)
    }
    case 'pending':
      if (item.selected_option_price != null && Number.isFinite(item.selected_option_price)) {
        return item.selected_option_price * quantity
      }
      return costOrZero(item.estimated_cost)
    default: {
      const exhaustive: never = behavior
      throw new Error(`Unexpected status behavior: ${exhaustive}`)
    }
  }
}

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

export function countItemsByBehavior(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): {
  pending: number
  purchased: number
  owned: number
  completed: number
  total: number
} {
  let pending = 0
  let purchased = 0
  let owned = 0
  for (const item of items) {
    const behavior = getStatusBehavior(item.status, statusOptions)
    switch (behavior) {
      case 'pending':
        pending += 1
        break
      case 'purchased':
        purchased += 1
        break
      case 'owned':
        owned += 1
        break
      default: {
        const exhaustive: never = behavior
        throw new Error(`Unexpected status behavior: ${exhaustive}`)
      }
    }
  }
  return {
    pending,
    purchased,
    owned,
    completed: purchased + owned,
    total: items.length,
  }
}

export function countPendingItems(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  return countItemsByBehavior(items, statusOptions).pending
}

export function countPurchasedItems(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  return countItemsByBehavior(items, statusOptions).purchased
}

export function countOwnedItems(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  return countItemsByBehavior(items, statusOptions).owned
}

export function countCompletedItems(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  return countItemsByBehavior(items, statusOptions).completed
}

function emptyTotals(): BudgetTotals {
  return { pending: 0, spent: 0, planned: 0 }
}

function addItem(
  totals: BudgetTotals,
  item: BudgetItem,
  behavior: StatusBehavior,
  statusOptions: readonly ProjectStatusOption[],
): void {
  switch (behavior) {
    case 'pending':
      totals.pending += plannedCost(item, statusOptions)
      break
    case 'purchased':
      // Spent stays actual_cost only (dashboard contract).
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
    addItem(totals, item, getStatusBehavior(item.status, statusOptions), statusOptions)
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

/**
 * Original item budgets (estimated_cost) for items that still require purchase
 * money: pending + purchased. Excludes already_owned.
 */
export function calculateOriginalBudget(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  let total = 0
  for (const item of items) {
    if (getStatusBehavior(item.status, statusOptions) === 'owned') continue
    total += costOrZero(item.estimated_cost)
  }
  return total
}

/** Costo proyectado = spent + pending. */
export function calculateProjectedCost(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  const totals = totalsFor(items, statusOptions)
  return totals.spent + totals.pending
}

/**
 * Alias de costo proyectado (métrica “Planeado” del dashboard).
 * No duplicar: siempre igual a calculateProjectedCost.
 */
export function calculatePlannedBudget(
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number {
  return calculateProjectedCost(items, statusOptions)
}

/** Saldo proyectado = budget − projectedCost. Negativo = supera el tope. */
export function calculateProjectedBalance(
  projectBudget: number | null,
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number | null {
  if (projectBudget == null || !Number.isFinite(projectBudget)) return null
  return projectBudget - calculateProjectedCost(items, statusOptions)
}

/** @deprecated Prefer calculateProjectedBalance (misma fórmula). */
export function calculateRemainingBudget(
  projectBudget: number | null,
  items: readonly BudgetItem[],
  statusOptions: readonly ProjectStatusOption[],
): number | null {
  return calculateProjectedBalance(projectBudget, items, statusOptions)
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
    addItem(bucket, item, getStatusBehavior(item.status, statusOptions), statusOptions)
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
      addItem(existing, item, behavior, statusOptions)
    } else {
      const totals = emptyTotals()
      addItem(totals, item, behavior, statusOptions)
      buckets.set(item.category_id, totals)
    }
  }

  const result: CategoryBudgetTotals[] = []
  for (const [category_id, totals] of buckets) {
    result.push({ category_id, ...totals })
  }
  return result
}
