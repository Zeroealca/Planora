import type { FinancialTransaction } from '@/features/transactions/domain'
import { addCents, fromCents, maxCents, subtractCents, toCents } from './money'
import type { MonthlyPeriod, PersistedMonthlyBudgetAllocation } from './domain'
import { monthlyPeriodBounds } from './period'

export type AllocationRelease = {
  allocationId: string
  amount: number
}

export type FreeMoneySummary = {
  unassigned: number
  released: number
  freeMoney: number
  releases: readonly AllocationRelease[]
}

function eligibleTransaction(
  transaction: FinancialTransaction | undefined,
  allocation: PersistedMonthlyBudgetAllocation,
  period: MonthlyPeriod,
): transaction is FinancialTransaction {
  if (!transaction || transaction.type !== 'expense') return false
  if (transaction.financialCategoryId !== allocation.financialCategoryId) return false
  const { start, endExclusive } = monthlyPeriodBounds(period)
  return transaction.occurredOn >= start && transaction.occurredOn < endExclusive
}

/**
 * Computes only released allocation leftovers. Existing assigned, spent and
 * actual-balance calculations deliberately remain unchanged.
 */
export function calculateFreeMoney(input: {
  period: MonthlyPeriod
  unassigned: number
  allocations: readonly PersistedMonthlyBudgetAllocation[]
  transactions: readonly FinancialTransaction[]
}): FreeMoneySummary {
  const releases: AllocationRelease[] = []

  for (const allocation of input.allocations) {
    if (allocation.paymentsCompletedAt === null) continue
    const expenses = input.transactions
      .filter((candidate) => eligibleTransaction(candidate, allocation, input.period))
    if (expenses.length === 0) continue
    const periodSpent = fromCents(addCents(...expenses.map((candidate) => toCents(candidate.amount))))

    releases.push({
      allocationId: allocation.id,
      amount: fromCents(maxCents(0, subtractCents(toCents(allocation.amount), toCents(periodSpent)))),
    })
  }

  const released = fromCents(addCents(...releases.map((release) => toCents(release.amount))))
  return {
    unassigned: input.unassigned,
    released,
    freeMoney: fromCents(addCents(toCents(input.unassigned), toCents(released))),
    releases,
  }
}
