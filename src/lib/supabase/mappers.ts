import type { Category, Item, ItemOption, ItemPriority, ItemStatus, LabelPreset, Project } from '@/types/domain'
import { ITEM_PRIORITIES, ITEM_STATUSES, LABEL_PRESETS } from '@/types/domain'
import type { Database } from '@/types/database'
import { parseNumeric } from './errors'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type CategoryRow = Database['public']['Tables']['categories']['Row']
type ItemRow = Database['public']['Tables']['items']['Row']
type OptionRow = Database['public']['Tables']['item_options']['Row']

function asStatus(value: string): ItemStatus {
  return (ITEM_STATUSES as readonly string[]).includes(value)
    ? (value as ItemStatus)
    : 'Pending'
}

function asPriority(value: string): ItemPriority {
  return (ITEM_PRIORITIES as readonly string[]).includes(value)
    ? (value as ItemPriority)
    : 'Medium'
}

function asPreset(value: string): LabelPreset {
  return (LABEL_PRESETS as readonly string[]).includes(value)
    ? (value as LabelPreset)
    : 'default'
}

export function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    budget: parseNumeric(row.budget),
    icon: row.icon,
    label_preset: asPreset(row.label_preset),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapBudgetItem(row: {
  status: string
  priority: string
  category_id: string | null
  estimated_cost: string | number | null
  actual_cost: string | number | null
}): import('@/utils/budget/calculations').BudgetItem {
  return {
    status: asStatus(row.status),
    priority: asPriority(row.priority),
    category_id: row.category_id,
    estimated_cost: parseNumeric(row.estimated_cost),
    actual_cost: parseNumeric(row.actual_cost),
  }
}

export function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    project_id: row.project_id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    status: asStatus(row.status),
    priority: asPriority(row.priority),
    estimated_cost: parseNumeric(row.estimated_cost),
    actual_cost: parseNumeric(row.actual_cost),
    notes: row.notes,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapOption(row: OptionRow): ItemOption {
  return {
    id: row.id,
    item_id: row.item_id,
    name: row.name,
    brand: row.brand,
    model: row.model,
    price: parseNumeric(row.price),
    store: row.store,
    product_url: row.product_url,
    image_url: row.image_url,
    description: row.description,
    specifications: row.specifications,
    notes: row.notes,
    selected: row.selected,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
