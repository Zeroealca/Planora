import {
  itemNeedsAttention,
  type AttentionContext,
} from '@/features/items/item-attention'
import type {
  ProjectPriorityOption,
  ProjectStatusOption,
} from '@/features/projects/project-options'
import type { ItemWithOptions } from '@/types/domain'

export type ItemSortKey = 'name' | 'priority' | 'status' | 'attention'

export const ITEM_SORT_OPTIONS: readonly { id: ItemSortKey; label: string }[] = [
  { id: 'name', label: 'Nombre' },
  { id: 'priority', label: 'Prioridad' },
  { id: 'status', label: 'Estado' },
  { id: 'attention', label: 'Atención primero' },
]

function optionOrder(
  id: string,
  options: readonly { id: string; display_order: number }[],
): number {
  const found = options.find((option) => option.id === id)
  return found?.display_order ?? Number.MAX_SAFE_INTEGER
}

export function sortProjectItems(
  items: readonly ItemWithOptions[],
  sort: ItemSortKey,
  priorityOptions: readonly ProjectPriorityOption[],
  statusOptions: readonly ProjectStatusOption[],
  attentionContext: AttentionContext,
): ItemWithOptions[] {
  const copy = [...items]

  copy.sort((a, b) => {
    if (sort === 'name') {
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    }
    if (sort === 'priority') {
      const byPriority =
        optionOrder(a.priority, priorityOptions) - optionOrder(b.priority, priorityOptions)
      if (byPriority !== 0) return byPriority
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    }
    if (sort === 'status') {
      const byStatus =
        optionOrder(a.status, statusOptions) - optionOrder(b.status, statusOptions)
      if (byStatus !== 0) return byStatus
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    }
    // attention first
    const aNeeds = itemNeedsAttention(a, attentionContext) ? 0 : 1
    const bNeeds = itemNeedsAttention(b, attentionContext) ? 0 : 1
    if (aNeeds !== bNeeds) return aNeeds - bNeeds
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  })

  return copy
}
