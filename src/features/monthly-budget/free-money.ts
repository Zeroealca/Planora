import type { ScheduledPaymentOccurrence } from '@/features/scheduled-payments/domain'
import type { FinancialTransaction } from '@/features/transactions/domain'
import { addCents, fromCents, maxCents, subtractCents, toCents } from './money'
import type { MonthlyPeriod, PersistedMonthlyBudgetAllocation } from './domain'
import { monthlyPeriodBounds } from './period'

export type AllocationRelease = {
  allocationId: string
  amount: number
  source: 'scheduled' | 'manual'
  transactionId: string
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
  occurrences: readonly ScheduledPaymentOccurrence[]
}): FreeMoneySummary {
  const transactionById = new Map(input.transactions.map((transaction) => [transaction.id, transaction]))
  const releases: AllocationRelease[] = []

  for (const allocation of input.allocations) {
    let source: AllocationRelease['source'] | null = null
    let transactionId: string | null = null

    if (allocation.scheduledPaymentId !== null) {
      const occurrence = input.occurrences.find(
        (candidate) =>
          candidate.scheduledPaymentId === allocation.scheduledPaymentId
          && candidate.status === 'paid'
          && candidate.transactionId !== null
          && candidate.dueDate >= `${input.period}-01`
          && candidate.dueDate < monthlyPeriodBounds(input.period).endExclusive,
      )
      if (occurrence?.transactionId) {
        source = 'scheduled'
        transactionId = occurrence.transactionId
      }
    } else if (allocation.manualCompletionTransactionId !== null) {
      source = 'manual'
      transactionId = allocation.manualCompletionTransactionId
    }

    const transaction = transactionId === null ? undefined : transactionById.get(transactionId)
    if (!source || !transactionId || !eligibleTransaction(transaction, allocation, input.period)) continue

    const periodSpent = fromCents(addCents(...input.transactions
      .filter((candidate) => eligibleTransaction(candidate, allocation, input.period))
      .map((candidate) => toCents(candidate.amount))))

    releases.push({
      allocationId: allocation.id,
      transactionId,
      source,
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
