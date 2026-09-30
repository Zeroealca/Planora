/**
 * Contracts for the monthly-budget domain. They deliberately have no Project,
 * Supabase, or persistence concerns.
 */

export type MonthlyPeriod = string

export type MonthlyBudgetAllocation = {
  financialCategoryId: string
  amount: number
}

export type MonthlyBudget = {
  period: MonthlyPeriod
  availableAmount: number
  allocations: readonly MonthlyBudgetAllocation[]
}

/** A reusable financial category, scoped to one user rather than a Project. */
export type FinancialCategory = {
  id: string
  userId: string
  name: string
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Persisted budget metadata; allocations are loaded independently. */
export type PersistedMonthlyBudget = Omit<MonthlyBudget, 'allocations'> & {
  id: string
  userId: string
  createdAt: string
  updatedAt: string
}

export type PersistedMonthlyBudgetAllocation = MonthlyBudgetAllocation & {
  id: string
  monthlyBudgetId: string
  createdAt: string
  updatedAt: string
}

export type BudgetTemplate = {
  id: string
  userId: string
  name: string
  suggestedAvailableAmount: number | null
  createdAt: string
  updatedAt: string
}

export type BudgetTemplateAllocation = MonthlyBudgetAllocation & {
  id: string
  budgetTemplateId: string
  createdAt: string
  updatedAt: string
}

/** Bridges persisted records to the calculation-only MonthlyBudget contract. */
export function toMonthlyBudgetDomain(
  budget: PersistedMonthlyBudget,
  allocations: readonly PersistedMonthlyBudgetAllocation[],
): MonthlyBudget {
  return {
    period: budget.period,
    availableAmount: budget.availableAmount,
    allocations: allocations.map(({ financialCategoryId, amount }) => ({
      financialCategoryId,
      amount,
    })),
  }
}

/**
 * Minimal transaction-shaped input needed by budget calculations. The future
 * persistence model may add dates, accounts, and refund links without changing
 * the meaning of these fields.
 */
export type BudgetTransactionType = 'expense' | 'income' | 'transfer' | 'refund'

export type BudgetTransaction = {
  type: BudgetTransactionType
  amount: number
  financialCategoryId: string | null
}

export type MonthlyBudgetSummary = {
  availableAmount: number
  assigned: number
  unassigned: number
  spent: number
  actualRemaining: number
}

export type CategoryBudgetMetrics = {
  budget: number
  spent: number
  remaining: number
  /** Null means that a percentage would be undefined because budget is zero. */
  usage: number | null
  overBudget: number
}
