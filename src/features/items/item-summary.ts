/**
 * Derived display helpers for item cards/detail. No persisted fields.
 * Financial values use plannedPrice from utils/budget.
 */

import { getStatusBehavior, type ProjectStatusOption } from '@/features/projects/project-options'
import type { ItemOption, ItemWithOptions } from '@/types/domain'
import { plannedPrice, toBudgetItem } from '@/utils/budget/calculations'

export function getSelectedOption(item: ItemWithOptions): ItemOption | null {
  return item.options.find((option) => option.selected) ?? null
}

/** Store comes from the selected option only (not duplicated on the item). */
export function getItemStore(item: ItemWithOptions): string | null {
  const store = getSelectedOption(item)?.store
  if (store == null || store.trim() === '') return null
  return store
}

/**
 * Prefer selected option product_url for purchase actions.
 * Fall back to item.purchase_url when useful as a general/reference link.
 */
export function getItemPurchaseLink(item: ItemWithOptions): {
  href: string
  source: 'option' | 'item'
} | null {
  const selected = getSelectedOption(item)
  const optionUrl = selected?.product_url?.trim()
  if (optionUrl) return { href: optionUrl, source: 'option' }

  const itemUrl = item.purchase_url?.trim()
  if (itemUrl) return { href: itemUrl, source: 'item' }

  return null
}

export function getItemCostSummary(
  item: ItemWithOptions,
  statusOptions: readonly ProjectStatusOption[] = [],
): {
  budget: number | null
  quantity: number
  planned: number
  paid: number | null
  /** False when status behavior is owned — amounts are informational only. */
  contributesToBudget: boolean
} {
  const budgetItem = toBudgetItem(item)
  const behavior =
    statusOptions.length > 0
      ? getStatusBehavior(item.status, statusOptions)
      : item.status === 'AlreadyOwned'
        ? 'owned'
        : null
  return {
    budget: item.estimated_cost,
    quantity: budgetItem.quantity,
    planned:
      budgetItem.selected_option_price != null
        ? budgetItem.selected_option_price * budgetItem.quantity
        : plannedPrice(budgetItem),
    paid: item.actual_cost,
    contributesToBudget: behavior !== 'owned',
  }
}

/**
 * completed_at labeling by status behavior:
 * - purchased → fecha de compra
 * - owned → when marked complete (not a purchase)
 * - pending → null
 */
export function getItemCompletionDate(
  item: ItemWithOptions,
  statusOptions: readonly ProjectStatusOption[],
): { label: string; iso: string } | null {
  if (!item.completed_at) return null
  const behavior = getStatusBehavior(item.status, statusOptions)
  if (behavior === 'purchased') {
    return { label: 'Fecha de compra', iso: item.completed_at }
  }
  if (behavior === 'owned') {
    return { label: 'Marcado como “ya lo tengo”', iso: item.completed_at }
  }
  return null
}

export function formatItemDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function selectedOptionLabel(option: ItemOption): string {
  const parts = [option.name]
  if (option.brand) parts.push(option.brand)
  if (option.model) parts.push(option.model)
  return parts.join(' · ')
}
