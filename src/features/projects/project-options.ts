export type StatusBehavior = 'pending' | 'purchased' | 'owned'

export interface ProjectStatusOption {
  id: string
  label: string
  behavior: StatusBehavior
  display_order: number
}

export interface ProjectPriorityOption {
  id: string
  label: string
  display_order: number
}

export const DEFAULT_STATUS_OPTIONS: ProjectStatusOption[] = [
  { id: 'Pending', label: 'Pendiente', behavior: 'pending', display_order: 0 },
  { id: 'Purchased', label: 'Comprado', behavior: 'purchased', display_order: 1 },
  { id: 'AlreadyOwned', label: 'Ya lo tengo', behavior: 'owned', display_order: 2 },
]

export const DEFAULT_PRIORITY_OPTIONS: ProjectPriorityOption[] = [
  { id: 'Critical', label: 'Crítica', display_order: 0 },
  { id: 'High', label: 'Alta', display_order: 1 },
  { id: 'Medium', label: 'Media', display_order: 2 },
  { id: 'Optional', label: 'Opcional', display_order: 3 },
]

export const MOVE_IN_PRIORITY_OPTIONS: ProjectPriorityOption[] = [
  { id: 'Critical', label: 'Mudanza', display_order: 0 },
  { id: 'High', label: 'Primer mes', display_order: 1 },
  { id: 'Medium', label: 'Después', display_order: 2 },
  { id: 'Optional', label: 'Opcional', display_order: 3 },
]

const STATUS_BEHAVIORS: StatusBehavior[] = ['pending', 'purchased', 'owned']

function isStatusBehavior(value: unknown): value is StatusBehavior {
  return typeof value === 'string' && STATUS_BEHAVIORS.includes(value as StatusBehavior)
}

function normalizeStatusOption(raw: unknown, index: number): ProjectStatusOption | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>
  if (typeof entry.id !== 'string' || typeof entry.label !== 'string') return null
  if (!isStatusBehavior(entry.behavior)) return null
  return {
    id: entry.id,
    label: entry.label.trim(),
    behavior: entry.behavior,
    display_order:
      typeof entry.display_order === 'number' ? entry.display_order : index,
  }
}

function normalizePriorityOption(raw: unknown, index: number): ProjectPriorityOption | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>
  if (typeof entry.id !== 'string' || typeof entry.label !== 'string') return null
  return {
    id: entry.id,
    label: entry.label.trim(),
    display_order:
      typeof entry.display_order === 'number' ? entry.display_order : index,
  }
}

export function parseStatusOptions(value: unknown): ProjectStatusOption[] {
  if (!Array.isArray(value)) return [...DEFAULT_STATUS_OPTIONS]
  const parsed = value
    .map((entry, index) => normalizeStatusOption(entry, index))
    .filter((entry): entry is ProjectStatusOption => entry != null && entry.label !== '')
  return parsed.length > 0 ? sortOptions(parsed) : [...DEFAULT_STATUS_OPTIONS]
}

export function parsePriorityOptions(value: unknown): ProjectPriorityOption[] {
  if (!Array.isArray(value)) return [...DEFAULT_PRIORITY_OPTIONS]
  const parsed = value
    .map((entry, index) => normalizePriorityOption(entry, index))
    .filter((entry): entry is ProjectPriorityOption => entry != null && entry.label !== '')
  return parsed.length > 0 ? sortOptions(parsed) : [...DEFAULT_PRIORITY_OPTIONS]
}

function sortOptions<T extends { display_order: number }>(options: T[]): T[] {
  return [...options].sort((a, b) => a.display_order - b.display_order)
}

export function statusLabel(
  statusId: string,
  options: readonly ProjectStatusOption[],
): string {
  return options.find((option) => option.id === statusId)?.label ?? statusId
}

export function priorityLabel(
  priorityId: string,
  options: readonly ProjectPriorityOption[],
): string {
  return options.find((option) => option.id === priorityId)?.label ?? priorityId
}

/** Fallback when a status id is missing from project options (legacy / import). */
const CANONICAL_STATUS_BEHAVIOR: Record<string, StatusBehavior> = {
  Pending: 'pending',
  Purchased: 'purchased',
  AlreadyOwned: 'owned',
}

export function getStatusBehavior(
  statusId: string,
  options: readonly ProjectStatusOption[],
): StatusBehavior {
  const fromOptions = options.find((option) => option.id === statusId)?.behavior
  if (fromOptions) return fromOptions
  return CANONICAL_STATUS_BEHAVIOR[statusId] ?? 'pending'
}

export function isCompletedBehavior(behavior: StatusBehavior): boolean {
  return behavior === 'purchased' || behavior === 'owned'
}

export function defaultStatusId(options: readonly ProjectStatusOption[]): string {
  return options.find((option) => option.behavior === 'pending')?.id ?? options[0]!.id
}

export function defaultPriorityId(options: readonly ProjectPriorityOption[]): string {
  return options.find((option) => option.id === 'Medium')?.id ?? options[0]!.id
}

export function createStatusOptionId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug === '' ? crypto.randomUUID() : slug
}

export function createPriorityOptionId(label: string): string {
  return createStatusOptionId(label)
}

export function validateStatusOptions(options: readonly ProjectStatusOption[]): string | null {
  if (options.length === 0) return 'Debe existir al menos un estado.'
  if (options.some((option) => option.label.trim() === '')) {
    return 'Todos los estados necesitan un nombre.'
  }
  const ids = new Set<string>()
  for (const option of options) {
    if (ids.has(option.id)) return 'Hay estados duplicados.'
    ids.add(option.id)
  }
  return null
}

export function validatePriorityOptions(
  options: readonly ProjectPriorityOption[],
): string | null {
  if (options.length === 0) return 'Debe existir al menos una prioridad.'
  if (options.some((option) => option.label.trim() === '')) {
    return 'Todas las prioridades necesitan un nombre.'
  }
  const ids = new Set<string>()
  for (const option of options) {
    if (ids.has(option.id)) return 'Hay prioridades duplicadas.'
    ids.add(option.id)
  }
  return null
}

export const STATUS_BEHAVIOR_LABELS: Record<StatusBehavior, string> = {
  pending: 'Pendiente (suma presupuesto esperado)',
  purchased: 'Comprado (suma precio real)',
  owned: 'Ya disponible (no suma al presupuesto)',
}
