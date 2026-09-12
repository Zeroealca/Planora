import {
  itemNeedsAttention,
  type AttentionContext,
} from '@/features/items/item-attention'
import { getItemStore } from '@/features/items/item-summary'
import type {
  ProjectPriorityOption,
  ProjectStatusOption,
} from '@/features/projects/project-options'
import type { ItemWithOptions } from '@/types/domain'

export type ItemSortKey =
  | 'name'
  | 'status'
  | 'priority'
  | 'category'
  | 'store'
  | 'attention'
export type ItemSortDirection = 'asc' | 'desc'

export const ITEM_SORT_OPTIONS: readonly { id: ItemSortKey; label: string }[] = [
  { id: 'name', label: 'Nombre' },
  { id: 'status', label: 'Estado' },
  { id: 'priority', label: 'Prioridad' },
  { id: 'category', label: 'Categoría' },
  { id: 'store', label: 'Tienda' },
  { id: 'attention', label: 'Atención primero' },
]

function optionOrder(
  id: string,
  options: readonly { id: string; display_order: number }[],
): number {
  const found = options.find((option) => option.id === id)
  return found?.display_order ?? Number.MAX_SAFE_INTEGER
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

function compareNullableNames(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return compareNames(a, b)
}

function categoryOrder(
  categoryId: string | null,
  attentionContext: AttentionContext,
): number {
  if (categoryId == null) return Number.MAX_SAFE_INTEGER
  const category = attentionContext.categories.find((entry) => entry.id === categoryId)
  return category?.display_order ?? Number.MAX_SAFE_INTEGER
}

export function sortProjectItems(
  items: readonly ItemWithOptions[],
  sort: ItemSortKey,
  direction: ItemSortDirection,
  priorityOptions: readonly ProjectPriorityOption[],
  statusOptions: readonly ProjectStatusOption[],
  attentionContext: AttentionContext,
): ItemWithOptions[] {
  const copy = [...items]

  copy.sort((a, b) => {
    const result = compareItems(
      a,
      b,
      sort,
      priorityOptions,
      statusOptions,
      attentionContext,
    )
    return direction === 'asc' ? result : -result
  })

  return copy
}

function compareItems(
  a: ItemWithOptions,
  b: ItemWithOptions,
  sort: ItemSortKey,
  priorityOptions: readonly ProjectPriorityOption[],
  statusOptions: readonly ProjectStatusOption[],
  attentionContext: AttentionContext,
): number {
  if (sort === 'name') {
    return compareNames(a.name, b.name)
  }
  if (sort === 'priority') {
    const byPriority =
      optionOrder(a.priority, priorityOptions) - optionOrder(b.priority, priorityOptions)
    if (byPriority !== 0) return byPriority
    return compareNames(a.name, b.name)
  }
  if (sort === 'status') {
    const byStatus =
      optionOrder(a.status, statusOptions) - optionOrder(b.status, statusOptions)
    if (byStatus !== 0) return byStatus
    return compareNames(a.name, b.name)
  }
  if (sort === 'category') {
    const byCategory =
      categoryOrder(a.category_id, attentionContext) -
      categoryOrder(b.category_id, attentionContext)
    if (byCategory !== 0) return byCategory
    const byCategoryName = compareNullableNames(
      categoryName(a.category_id, attentionContext),
      categoryName(b.category_id, attentionContext),
    )
    if (byCategoryName !== 0) return byCategoryName
    return compareNames(a.name, b.name)
  }
  if (sort === 'store') {
    const byStore = compareNullableNames(getItemStore(a), getItemStore(b))
    if (byStore !== 0) return byStore
    return compareNames(a.name, b.name)
  }
  // attention first
  const aNeeds = itemNeedsAttention(a, attentionContext) ? 0 : 1
  const bNeeds = itemNeedsAttention(b, attentionContext) ? 0 : 1
  if (aNeeds !== bNeeds) return aNeeds - bNeeds
  return compareNames(a.name, b.name)
}

function categoryName(
  categoryId: string | null,
  attentionContext: AttentionContext,
): string | null {
  if (categoryId == null) return null
  return attentionContext.categories.find((category) => category.id === categoryId)?.name ?? null
}
