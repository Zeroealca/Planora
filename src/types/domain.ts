/**
 * Domain types for Planora. Generic project planning — not houses, rooms, or furniture.
 */

import type {
  ProjectPriorityOption,
  ProjectStatusOption,
} from '@/features/projects/project-options'
import {
  getStatusBehavior,
  isCompletedBehavior,
} from '@/features/projects/project-options'

export type { CurrencyCode } from '@/features/profile/currencies'
export { DEFAULT_CURRENCY } from '@/features/profile/currencies'
export type { ProjectPriorityOption, ProjectStatusOption, StatusBehavior } from '@/features/projects/project-options'

/** @deprecated Use per-project priority_options instead. */
export const LABEL_PRESETS = ['default', 'move_in'] as const
export type LabelPreset = (typeof LABEL_PRESETS)[number]

export function isCompletedStatus(
  statusId: string,
  statusOptions: readonly ProjectStatusOption[],
): boolean {
  return isCompletedBehavior(getStatusBehavior(statusId, statusOptions))
}

export interface Profile {
  id: string
  display_name: string | null
  currency_code: import('@/features/profile/currencies').CurrencyCode
  created_at: string
  updated_at: string
}

/** Per project: only one savings approach at a time (or none). */
export type SavingsMode = 'none' | 'plan' | 'goal'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  budget: number | null
  icon: string | null
  label_preset: LabelPreset
  status_options: ProjectStatusOption[]
  priority_options: ProjectPriorityOption[]
  /**
   * Exclusive savings approach for this project.
   * - `plan`: monthly contributions window (informational / optional apply to budget)
   * - `goal`: target + reserve + projection (independent from budget)
   * - `none`: no savings tooling
   */
  savings_mode: SavingsMode
  /** Mirror of `savings_mode === 'goal'` for convenience. */
  savings_goal_enabled: boolean
  savings_initial_balance: number | null
  savings_target_amount: number | null
  savings_minimum_reserve: number | null
  /** Goal monthly contribution (separate from plan `savings_amount`). */
  savings_goal_monthly_amount: number | null
  savings_goal_start_date: string | null
  /** Plan: monthly contribution. */
  savings_amount: number | null
  savings_accrues_interest: boolean
  savings_interest_rate_annual: number | null
  savings_start_date: string | null
  savings_end_date: string | null
  created_at: string
  updated_at: string
}

export type SavingsMovementType = 'inflow' | 'outflow'

export interface ProjectSavingsMovement {
  id: string
  project_id: string
  name: string
  movement_date: string
  amount: number
  movement_type: SavingsMovementType
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
  status: string
  priority: string
  estimated_cost: number | null
  actual_cost: number | null
  purchase_url: string | null
  notes: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

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
