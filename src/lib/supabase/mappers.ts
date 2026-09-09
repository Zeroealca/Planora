import type {
  Category,
  Item,
  ItemOption,
  LabelPreset,
  Profile,
  Project,
  ProjectSavingsMovement,
  SavingsMode,
  SavingsMovementType,
} from '@/types/domain'
import { LABEL_PRESETS } from '@/types/domain'
import type { Database } from '@/types/database'
import { DEFAULT_CURRENCY, isCurrencyCode } from '@/features/profile/currencies'
import {
  parsePriorityOptions,
  parseStatusOptions,
} from '@/features/projects/project-options'
import { parseNumeric } from './errors'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type CategoryRow = Database['public']['Tables']['categories']['Row']
type ItemRow = Database['public']['Tables']['items']['Row']
type OptionRow = Database['public']['Tables']['item_options']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type SavingsMovementRow =
  Database['public']['Tables']['project_savings_movements']['Row']

function asPreset(value: string): LabelPreset {
  return (LABEL_PRESETS as readonly string[]).includes(value)
    ? (value as LabelPreset)
    : 'default'
}

function asMovementType(value: string): SavingsMovementType {
  return value === 'outflow' ? 'outflow' : 'inflow'
}

function asSavingsMode(
  value: string | null | undefined,
  goalEnabled: boolean,
): SavingsMode {
  if (value === 'plan' || value === 'goal' || value === 'none') return value
  return goalEnabled ? 'goal' : 'none'
}

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    display_name: row.display_name,
    currency_code: isCurrencyCode(row.currency_code) ? row.currency_code : DEFAULT_CURRENCY,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
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
    status_options: parseStatusOptions(row.status_options ?? null),
    priority_options: parsePriorityOptions(row.priority_options ?? null),
    savings_mode: asSavingsMode(row.savings_mode, row.savings_goal_enabled ?? false),
    savings_goal_enabled: row.savings_goal_enabled ?? false,
    savings_initial_balance: parseNumeric(row.savings_initial_balance),
    savings_target_amount: parseNumeric(row.savings_target_amount),
    savings_minimum_reserve: parseNumeric(row.savings_minimum_reserve),
    savings_goal_monthly_amount: parseNumeric(row.savings_goal_monthly_amount),
    savings_goal_start_date: row.savings_goal_start_date,
    savings_amount: parseNumeric(row.savings_amount),
    savings_accrues_interest: row.savings_accrues_interest,
    savings_interest_rate_annual: parseNumeric(row.savings_interest_rate_annual),
    savings_start_date: row.savings_start_date,
    savings_end_date: row.savings_end_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapSavingsMovement(row: SavingsMovementRow): ProjectSavingsMovement {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    movement_date: row.movement_date,
    amount: parseNumeric(row.amount) ?? 0,
    movement_type: asMovementType(row.movement_type),
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
  selected_option_price?: number | null
  item_options?: Array<{ selected: boolean; price: string | number | null }> | null
}): import('@/utils/budget/calculations').BudgetItem {
  const options = (row.item_options ?? []).map((option) => ({
    selected: option.selected,
    price: parseNumeric(option.price),
  }))
  return {
    status: row.status,
    priority: row.priority,
    category_id: row.category_id,
    estimated_cost: parseNumeric(row.estimated_cost),
    actual_cost: parseNumeric(row.actual_cost),
    selected_option_price:
      row.selected_option_price != null && Number.isFinite(row.selected_option_price)
        ? row.selected_option_price
        : (options.find((option) => option.selected)?.price ?? null),
  }
}

export function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    project_id: row.project_id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority,
    estimated_cost: parseNumeric(row.estimated_cost),
    actual_cost: parseNumeric(row.actual_cost),
    purchase_url: row.purchase_url,
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
