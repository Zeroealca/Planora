import {
  createPriorityOptionId,
  defaultPriorityId,
  defaultStatusId,
  getStatusBehavior,
  priorityLabel,
  statusLabel,
  type ProjectPriorityOption,
  type ProjectStatusOption,
} from '@/features/projects/project-options'
import { normalizeItemName } from './normalize-name'
import type {
  ResolvedCategory,
  ResolvedPriority,
  ResolvedStatus,
} from './import-types'
import type { Category } from '@/types/domain'

const STATUS_ALIASES: Record<string, string> = {
  pendiente: 'Pending',
  pending: 'Pending',
  comprado: 'Purchased',
  purchased: 'Purchased',
  'ya lo tengo': 'AlreadyOwned',
  'ya_lo_tengo': 'AlreadyOwned',
  alreadyowned: 'AlreadyOwned',
  owned: 'AlreadyOwned',
}

const PRIORITY_ALIASES: Record<string, string> = {
  critica: 'Critical',
  crítica: 'Critical',
  critical: 'Critical',
  mudanza: 'Critical',
  alta: 'High',
  high: 'High',
  'primer mes': 'High',
  primer_mes: 'High',
  media: 'Medium',
  medium: 'Medium',
  despues: 'Medium',
  después: 'Medium',
  opcional: 'Optional',
  optional: 'Optional',
}

function normalizeLookup(value: string): string {
  return normalizeItemName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function resolveCategory(
  categoryName: string | null,
  categories: readonly Category[],
): ResolvedCategory {
  if (!categoryName || categoryName.trim() === '') return { kind: 'none' }
  const key = normalizeLookup(categoryName)
  const existing = categories.find((c) => normalizeLookup(c.name) === key)
  if (existing) return { kind: 'existing', id: existing.id, name: existing.name }
  return { kind: 'create', name: categoryName.trim() }
}

export function resolvePriority(
  raw: string | null,
  options: readonly ProjectPriorityOption[],
): ResolvedPriority {
  if (!raw || raw.trim() === '') {
    const id = defaultPriorityId(options)
    return { kind: 'default', id, label: priorityLabel(id, options) }
  }
  const key = normalizeLookup(raw)
  const byId = options.find((o) => normalizeLookup(o.id) === key)
  if (byId) return { kind: 'existing', id: byId.id, label: byId.label }
  const byLabel = options.find((o) => normalizeLookup(o.label) === key)
  if (byLabel) return { kind: 'existing', id: byLabel.id, label: byLabel.label }

  const aliasId = PRIORITY_ALIASES[key] ?? PRIORITY_ALIASES[raw.trim().toLowerCase()]
  if (aliasId) {
    const known = options.find((o) => o.id === aliasId)
    if (known) return { kind: 'existing', id: known.id, label: known.label }
  }

  const id = createPriorityOptionId(raw)
  return { kind: 'create', id, label: raw.trim() }
}

export function resolveStatus(
  raw: string | null,
  options: readonly ProjectStatusOption[],
): ResolvedStatus {
  if (!raw || raw.trim() === '') {
    const id = defaultStatusId(options)
    return {
      kind: 'default',
      id,
      label: statusLabel(id, options),
      behavior: getStatusBehavior(id, options),
    }
  }
  const key = normalizeLookup(raw)
  const byId = options.find((o) => normalizeLookup(o.id) === key)
  if (byId) {
    return {
      kind: 'ok',
      id: byId.id,
      label: byId.label,
      behavior: byId.behavior,
    }
  }
  const byLabel = options.find((o) => normalizeLookup(o.label) === key)
  if (byLabel) {
    return {
      kind: 'ok',
      id: byLabel.id,
      label: byLabel.label,
      behavior: byLabel.behavior,
    }
  }
  const aliasId = STATUS_ALIASES[key] ?? STATUS_ALIASES[raw.trim().toLowerCase()]
  if (aliasId) {
    const known = options.find((o) => o.id === aliasId)
    if (known) {
      return {
        kind: 'ok',
        id: known.id,
        label: known.label,
        behavior: known.behavior,
      }
    }
  }
  return { kind: 'unknown', raw: raw.trim() }
}
