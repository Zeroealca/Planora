import type { FinancialTransaction } from '@/features/transactions/domain'
import { toBudgetTransaction } from '@/features/transactions/domain'
import type {
  CategoryBudgetMetrics,
  MonthlyBudget,
  MonthlyBudgetSummary,
} from './domain'
import { calculateCategoryMetrics, calculateMonthlyBudgetSummary } from './calculations'
import { monthlyPeriodBounds } from './period'

export type MonthlyBudgetCategorySummary = CategoryBudgetMetrics & {
  financialCategoryId: string
  hasAllocation: boolean
}

export type MonthlyBudgetPeriodSummary = {
  metrics: MonthlyBudgetSummary
  categories: MonthlyBudgetCategorySummary[]
}

/**
 * The only domain rule that assigns transactions to a budget month. Inputs use
 * civil date-only strings, so comparisons never involve timezone conversion.
 */
export function getBudgetTransactionsForPeriod(
  transactions: readonly FinancialTransaction[],
  period: MonthlyBudget['period'],
): FinancialTransaction[] {
  const { start, endExclusive } = monthlyPeriodBounds(period)
  return transactions.filter(
    (transaction) => transaction.occurredOn >= start && transaction.occurredOn < endExclusive,
  )
}

export function calculateMonthlyBudgetPeriodSummary(
  budget: MonthlyBudget,
  transactions: readonly FinancialTransaction[],
): MonthlyBudgetPeriodSummary {
  const applicable = getBudgetTransactionsForPeriod(transactions, budget.period)
  const budgetTransactions = applicable.map(toBudgetTransaction)
  const allocationByCategory = new Map<string, number>()
  for (const allocation of budget.allocations) {
    allocationByCategory.set(allocation.financialCategoryId, allocation.amount)
  }

  const expenseCategoryIds = applicable
    .filter(
      (transaction) =>
        transaction.type === 'expense' && transaction.financialCategoryId != null,
    )
    .map((transaction) => transaction.financialCategoryId!)
  const categoryIds = new Set([...allocationByCategory.keys(), ...expenseCategoryIds])

  return {
    metrics: calculateMonthlyBudgetSummary(budget, budgetTransactions),
    categories: [...categoryIds].map((financialCategoryId) => {
      const hasAllocation = allocationByCategory.has(financialCategoryId)
      const categoryTransactions = applicable
        .filter((transaction) => transaction.financialCategoryId === financialCategoryId)
        .map(toBudgetTransaction)
      return {
        financialCategoryId,
        hasAllocation,
        ...calculateCategoryMetrics(
          allocationByCategory.get(financialCategoryId) ?? 0,
          categoryTransactions,
        ),
      }
    }),
  }
}
