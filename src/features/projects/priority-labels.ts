import {
  ITEM_PRIORITY_LABELS,
  type ItemPriority,
  type LabelPreset,
} from '@/types/domain'

/** Presentation-only overlay for the optional move-in template. */
const MOVE_IN_PRIORITY_LABELS = {
  Critical: 'Mudanza',
  High: 'Primer mes',
  Medium: 'Después',
  Optional: 'Opcional',
} as const satisfies Record<ItemPriority, string>

export function priorityLabel(
  priority: ItemPriority,
  preset: LabelPreset,
): string {
  if (preset === 'move_in') return MOVE_IN_PRIORITY_LABELS[priority]
  return ITEM_PRIORITY_LABELS[priority]
}
