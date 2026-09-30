import { listTransactions } from '@/features/transactions/transaction-api'
import type { MonthlyPeriod } from './domain'
import { toMonthlyBudgetDomain } from './domain'
import {
  fetchMonthlyBudgetByPeriod,
  listMonthlyBudgetAllocations,
} from './monthly-budget-api'
import { monthlyPeriodBounds } from './period'
import {
  calculateMonthlyBudgetPeriodSummary,
  type MonthlyBudgetPeriodSummary,
} from './transaction-summary'

/** Loads planning and real movements separately, then derives a period summary. */
export async function getMonthlyBudgetPeriodSummary(
  period: MonthlyPeriod,
): Promise<MonthlyBudgetPeriodSummary | null> {
  const budget = await fetchMonthlyBudgetByPeriod(period)
  if (!budget) return null

  const { start, endExclusive } = monthlyPeriodBounds(period)
  const [allocations, transactions] = await Promise.all([
    listMonthlyBudgetAllocations(budget.id),
    listTransactions({ fromDate: start, toDateExclusive: endExclusive }),
  ])

  return calculateMonthlyBudgetPeriodSummary(
    toMonthlyBudgetDomain(budget, allocations),
    transactions,
  )
}
