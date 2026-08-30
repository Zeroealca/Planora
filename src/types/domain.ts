/**
 * Domain types for Planora. Generic project planning — not houses, rooms, or furniture.
 *
 * Field names follow the future DB (`snake_case`) so they can align with
 * generated Supabase types later.
 *
 * UI labels (Spanish, presentation only):
 * - Status: Pendiente / Comprado / Ya lo tengo
 * - Priority: Crítica / Alta / Media / Opcional
 *
 * A later use-case may show different priority labels (e.g. Mudanza / Primer
 * mes / Después / Opcional). That mapping stays in the UI and must not enter
 * these types.
 */

export const ITEM_STATUSES = ['Pending', 'Purchased', 'AlreadyOwned'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

export const ITEM_STATUS_LABELS = {
  Pending: 'Pendiente',
  Purchased: 'Comprado',
  AlreadyOwned: 'Ya lo tengo',
} as const satisfies Record<ItemStatus, string>

export const ITEM_PRIORITIES = ['Critical', 'High', 'Medium', 'Optional'] as const
export type ItemPriority = (typeof ITEM_PRIORITIES)[number]

export const ITEM_PRIORITY_LABELS = {
  Critical: 'Crítica',
  High: 'Alta',
  Medium: 'Media',
  Optional: 'Opcional',
} as const satisfies Record<ItemPriority, string>

export const LABEL_PRESETS = ['default', 'move_in'] as const
export type LabelPreset = (typeof LABEL_PRESETS)[number]

export function isCompletedStatus(status: ItemStatus): boolean {
  return status === 'Purchased' || status === 'AlreadyOwned'
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  budget: number | null
  icon: string | null
  label_preset: LabelPreset
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  project_id: string
  name: string
  display_order: number
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  project_id: string
  category_id: string | null
  name: string
  description: string | null
  status: ItemStatus
  priority: ItemPriority
  estimated_cost: number | null
  actual_cost: number | null
  notes: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Purchase alternative for an item. At most one option per item may have
 * `selected: true` (enforced later in DB and UI).
 */
export interface ItemOption {
  id: string
  item_id: string
  name: string
  brand: string | null
  model: string | null
  price: number | null
  store: string | null
  product_url: string | null
  image_url: string | null
  description: string | null
  specifications: string | null
  notes: string | null
  selected: boolean
  created_at: string
  updated_at: string
}

export interface ItemWithOptions extends Item {
  options: ItemOption[]
}
