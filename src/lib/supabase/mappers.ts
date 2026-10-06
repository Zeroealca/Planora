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
import type {
  FinancialCategory,
  PersistedMonthlyBudget,
  PersistedMonthlyBudgetAllocation,
  BudgetTemplate,
  BudgetTemplateAllocation,
} from '@/features/monthly-budget/domain'
import type { ScheduledPayment, ScheduledPaymentOccurrence } from '@/features/scheduled-payments/domain'
import type { ScheduledPaymentReminderDelivery } from '@/features/scheduled-payments/reminders'
import type { FinancialTransaction, TransactionType } from '@/features/transactions/domain'
import { LABEL_PRESETS } from '@/types/domain'
import type { Database } from '@/types/database'
import { DEFAULT_CURRENCY, isCurrencyCode } from '@/features/profile/currencies'
import {
  parsePriorityOptions,
  parseStatusOptions,
} from '@/features/projects/project-options'
import {
  PRICE_TRACKING_STATUSES,
  TRACKED_PRICE_TYPES,
  type PriceTrackingStatus,
  type TrackedPriceType,
} from '@/features/price-tracking/types'
import { parseNumeric } from './errors'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type CategoryRow = Database['public']['Tables']['categories']['Row']
type ItemRow = Database['public']['Tables']['items']['Row']
type OptionRow = Database['public']['Tables']['item_options']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type SavingsMovementRow =
  Database['public']['Tables']['project_savings_movements']['Row']
type FinancialCategoryRow = Database['public']['Tables']['financial_categories']['Row']
type MonthlyBudgetRow = Database['public']['Tables']['monthly_budgets']['Row']
type MonthlyBudgetAllocationRow =
  Database['public']['Tables']['monthly_budget_allocations']['Row']
type TransactionRow = Database['public']['Tables']['transactions']['Row']
type BudgetTemplateRow = Database['public']['Tables']['budget_templates']['Row']
type BudgetTemplateAllocationRow = Database['public']['Tables']['budget_template_allocations']['Row']
type ScheduledPaymentRow = Database['public']['Tables']['scheduled_payments']['Row']
type ScheduledPaymentOccurrenceRow = Database['public']['Tables']['scheduled_payment_occurrences']['Row']
type ScheduledPaymentReminderDeliveryRow =
  Database['public']['Tables']['scheduled_payment_reminder_deliveries']['Row']

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

function asTrackedPriceType(value: string): TrackedPriceType {
  return (TRACKED_PRICE_TYPES as readonly string[]).includes(value)
    ? (value as TrackedPriceType)
    : 'primary'
}

function asPriceTrackingStatus(value: string): PriceTrackingStatus {
  return (PRICE_TRACKING_STATUSES as readonly string[]).includes(value)
    ? (value as PriceTrackingStatus)
    : 'inactive'
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
  quantity?: string | number | null
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
    quantity: parseNumeric(row.quantity ?? null) ?? 1,
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
    quantity: parseNumeric(row.quantity) ?? 1,
    estimated_cost: parseNumeric(row.estimated_cost),
    actual_cost: parseNumeric(row.actual_cost),
    include_in_purchase_report: row.include_in_purchase_report,
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
    tracking_enabled: row.tracking_enabled,
    tracked_price_type: asTrackedPriceType(row.tracked_price_type),
    target_price: parseNumeric(row.target_price),
    alert_on_drop: row.alert_on_drop,
    alert_on_increase: row.alert_on_increase,
    alert_drop_percentage: parseNumeric(row.alert_drop_percentage),
    last_checked_at: row.last_checked_at,
    tracking_status: asPriceTrackingStatus(row.tracking_status),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapFinancialCategory(row: FinancialCategoryRow): FinancialCategory {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMonthlyBudget(row: MonthlyBudgetRow): PersistedMonthlyBudget {
  return {
    id: row.id,
    userId: row.user_id,
    period: row.period,
    availableAmount: parseNumeric(row.available_amount) ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMonthlyBudgetAllocation(
  row: MonthlyBudgetAllocationRow,
): PersistedMonthlyBudgetAllocation {
  return {
    id: row.id,
    monthlyBudgetId: row.monthly_budget_id,
    financialCategoryId: row.financial_category_id,
    amount: parseNumeric(row.amount) ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapBudgetTemplate(row: BudgetTemplateRow): BudgetTemplate { return { id: row.id, userId: row.user_id, name: row.name, suggestedAvailableAmount: parseNumeric(row.suggested_available_amount), createdAt: row.created_at, updatedAt: row.updated_at } }
export function mapBudgetTemplateAllocation(row: BudgetTemplateAllocationRow): BudgetTemplateAllocation { return { id: row.id, budgetTemplateId: row.budget_template_id, financialCategoryId: row.financial_category_id, amount: parseNumeric(row.amount) ?? 0, createdAt: row.created_at, updatedAt: row.updated_at } }

export function mapFinancialTransaction(row: TransactionRow): FinancialTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    occurredOn: row.occurred_on,
    amount: parseNumeric(row.amount) ?? 0,
    type: row.transaction_type === 'income' ? 'income' : ('expense' as TransactionType),
    financialCategoryId: row.financial_category_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapScheduledPayment(row: ScheduledPaymentRow): ScheduledPayment {
  return {
    id: row.id, userId: row.user_id, name: row.name, financialCategoryId: row.financial_category_id,
    frequency:
      row.frequency === 'annual'
        ? 'annual'
        : row.frequency === 'one_time'
          ? 'one_time'
          : 'monthly',
    amountType: row.amount_type === 'variable' ? 'variable' : 'fixed',
    expectedAmount: parseNumeric(row.expected_amount), startDate: row.start_date, endDate: row.end_date,
    active: row.active,
    reminderEnabled: row.reminder_enabled,
    reminderDaysBefore: row.reminder_days_before,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function mapScheduledPaymentOccurrence(
  row: ScheduledPaymentOccurrenceRow,
): ScheduledPaymentOccurrence {
  return {
    id: row.id, userId: row.user_id, scheduledPaymentId: row.scheduled_payment_id,
    dueDate: row.due_date, expectedAmount: parseNumeric(row.expected_amount),
    status: row.status === 'paid' || row.status === 'skipped' ? row.status : 'pending',
    transactionId: row.transaction_id, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function mapScheduledPaymentReminderDelivery(
  row: ScheduledPaymentReminderDeliveryRow,
): ScheduledPaymentReminderDelivery {
  const status =
    row.status === 'sent' || row.status === 'failed' || row.status === 'processing'
      ? row.status
      : 'pending'
  return {
    id: row.id,
    userId: row.user_id,
    scheduledPaymentId: row.scheduled_payment_id,
    occurrenceId: row.occurrence_id,
    reminderDate: row.reminder_date,
    daysBeforeDue: row.days_before_due,
    status,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
