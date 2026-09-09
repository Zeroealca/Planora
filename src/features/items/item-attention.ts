/**
 * Lightweight incomplete-data detection for items.
 * These are warnings — not item status values.
 */

import {
  getStatusBehavior,
  type ProjectPriorityOption,
  type ProjectStatusOption,
} from '@/features/projects/project-options'
import type { Category, ItemWithOptions } from '@/types/domain'
import { getSelectedOption } from './item-summary'

export const ATTENTION_ISSUES = [
  'missing_category',
  'missing_budget',
  'purchased_without_actual',
  'missing_planned_price',
  'selected_option_without_price',
  'invalid_category',
  'invalid_priority',
  'invalid_status',
  'invalid_option',
] as const

export type AttentionIssue = (typeof ATTENTION_ISSUES)[number]

/** Filter presets for the project item list (not status). */
export type AttentionFilter =
  | 'All'
  | 'needs_attention'
  | 'missing_category'
  | 'missing_budget'
  | 'purchased_without_actual'
  | 'missing_planned_price'

export const ATTENTION_ISSUE_LABELS: Record<AttentionIssue, string> = {
  missing_category: 'Sin categoría',
  missing_budget: 'Sin presupuesto',
  purchased_without_actual: 'Comprado sin precio',
  missing_planned_price: 'Sin presupuesto',
  selected_option_without_price: 'Opción seleccionada sin precio',
  invalid_category: 'Categoría inválida',
  invalid_priority: 'Prioridad inválida',
  invalid_status: 'Estado inválido',
  invalid_option: 'Opción seleccionada inválida',
}

export type AttentionContext = {
  categories: readonly Category[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
}

function isFiniteCost(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value)
}

function selectedHasPrice(item: ItemWithOptions): boolean {
  const selected = getSelectedOption(item)
  return selected != null && isFiniteCost(selected.price)
}

export function collectItemAttentionIssues(
  item: ItemWithOptions,
  context: AttentionContext,
): AttentionIssue[] {
  const issues: AttentionIssue[] = []
  const behavior = getStatusBehavior(item.status, context.statusOptions)
  const statusKnown = context.statusOptions.some((option) => option.id === item.status)
  const priorityKnown = context.priorityOptions.some((option) => option.id === item.priority)
  const categoryIds = new Set(context.categories.map((category) => category.id))
  const selected = getSelectedOption(item)
  const selectedCount = item.options.filter((option) => option.selected).length

  if (item.category_id == null) {
    issues.push('missing_category')
  } else if (!categoryIds.has(item.category_id)) {
    issues.push('invalid_category')
  }

  // Owned items do not affect budget — skip money-related attention.
  if (behavior !== 'owned') {
    if (!isFiniteCost(item.estimated_cost)) {
      issues.push('missing_budget')
    }

    if (behavior === 'purchased' && !isFiniteCost(item.actual_cost)) {
      issues.push('purchased_without_actual')
    }

    if (behavior === 'pending' && !isFiniteCost(item.estimated_cost) && !selectedHasPrice(item)) {
      issues.push('missing_planned_price')
    }

    if (selected != null && !isFiniteCost(selected.price)) {
      issues.push('selected_option_without_price')
    }
  }

  if (!priorityKnown) {
    issues.push('invalid_priority')
  }

  if (!statusKnown) {
    issues.push('invalid_status')
  }

  if (selectedCount > 1) {
    issues.push('invalid_option')
  }

  return issues
}

export function itemNeedsAttention(
  item: ItemWithOptions,
  context: AttentionContext,
): boolean {
  return collectItemAttentionIssues(item, context).length > 0
}

export function countItemsNeedingAttention(
  items: readonly ItemWithOptions[],
  context: AttentionContext,
): number {
  let count = 0
  for (const item of items) {
    if (itemNeedsAttention(item, context)) count += 1
  }
  return count
}

export function itemMatchesAttentionFilter(
  item: ItemWithOptions,
  filter: AttentionFilter,
  context: AttentionContext,
): boolean {
  if (filter === 'All') return true
  const issues = collectItemAttentionIssues(item, context)
  if (filter === 'needs_attention') return issues.length > 0
  return issues.includes(filter)
}

export function filterItemsByAttention(
  items: readonly ItemWithOptions[],
  filter: AttentionFilter,
  context: AttentionContext,
): ItemWithOptions[] {
  if (filter === 'All') return [...items]
  return items.filter((item) => itemMatchesAttentionFilter(item, filter, context))
}
