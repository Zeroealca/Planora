import type { CSSProperties } from 'react'
import type { ProjectPriorityOption, ProjectStatusOption } from '@/types/domain'
import { getStatusBehavior } from '@/features/projects/project-options'

const STATUS_COLORS = {
  pending: '#f59e0b',
  purchased: '#0ea5e9',
  owned: '#10b981',
} as const

const PRIORITY_COLORS = ['#ef4444', '#f97316', '#8b5cf6', '#64748b'] as const

function fallbackPriorityColor(priorityId: string): string {
  let hash = 0
  for (const char of priorityId) hash = (hash + char.charCodeAt(0)) % PRIORITY_COLORS.length
  return PRIORITY_COLORS[hash]
}

export function itemToneStyle({
  statusId,
  priorityId,
  statusOptions,
  priorityOptions,
}: {
  statusId: string
  priorityId: string
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
}): CSSProperties {
  const behavior = getStatusBehavior(statusId, statusOptions)
  const priorityIndex = priorityOptions.findIndex((option) => option.id === priorityId)
  return {
    '--item-status-color': STATUS_COLORS[behavior],
    '--item-priority-color':
      priorityIndex >= 0
        ? PRIORITY_COLORS[priorityIndex % PRIORITY_COLORS.length]
        : fallbackPriorityColor(priorityId),
  } as CSSProperties
}
