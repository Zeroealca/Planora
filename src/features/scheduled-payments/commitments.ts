import { fromCents, toCents } from '@/features/monthly-budget/money'
import type { FinancialCategory, MonthlyPeriod } from '@/features/monthly-budget/domain'
import {
  getProjectedPaymentsForPeriod,
  type ProjectedPaymentLine,
} from './forecast'
import type { ScheduledPayment, ScheduledPaymentOccurrence } from './domain'

export type CategoryScheduledCommitment = {
  financialCategoryId: string
  knownAmount: number
  unknownAmountCount: number
  pendingCount: number
}

export type MonthlyScheduledCommitments = {
  lines: readonly ProjectedPaymentLine[]
  knownAmount: number
  unknownAmountCount: number
  overdueCount: number
  nextPendingPayment: ProjectedPaymentLine | null
  byCategory: readonly CategoryScheduledCommitment[]
}

/**
 * Derives the obligations due in one month. It uses occurrence snapshots when
 * present and recurrence rules only when an occurrence has not been created.
 * This never creates transactions, allocations, or occurrences.
 */
export function calculateMonthlyScheduledCommitments(input: {
  period: MonthlyPeriod
  today: string
  payments: readonly ScheduledPayment[]
  categoriesById: ReadonlyMap<string, Pick<FinancialCategory, 'archivedAt'> | null>
  occurrences: readonly ScheduledPaymentOccurrence[]
}): MonthlyScheduledCommitments {
  const lines = getProjectedPaymentsForPeriod(
    input.payments,
    input.categoriesById,
    input.occurrences,
    input.period,
  )
  const byCategory = new Map<string, CategoryScheduledCommitment>()
  let knownAmount = 0
  let unknownAmountCount = 0
  let overdueCount = 0
  let nextPendingPayment: ProjectedPaymentLine | null = null
  const categoryIdByPaymentId = new Map(
    input.payments.map((payment) => [payment.id, payment.financialCategoryId] as const),
  )

  for (const line of lines) {
    if (line.status !== 'pending') continue
    if (nextPendingPayment === null) nextPendingPayment = line
    if (line.dueDate < input.today) overdueCount += 1
    // The line does not expose category because it remains a forecast-focused
    // contract. Resolve it from the source rule here, without duplicating recurrence.
    const categoryId = categoryIdByPaymentId.get(line.scheduledPaymentId)
    if (!categoryId) continue
    const current = byCategory.get(categoryId)
    const category = current ?? {
      financialCategoryId: categoryId,
      knownAmount: 0,
      unknownAmountCount: 0,
      pendingCount: 0,
    }
    category.pendingCount += 1
    if (line.expectedAmount === null) {
      category.unknownAmountCount += 1
      unknownAmountCount += 1
    } else {
      category.knownAmount = fromCents(toCents(category.knownAmount) + toCents(line.expectedAmount))
      knownAmount = fromCents(toCents(knownAmount) + toCents(line.expectedAmount))
    }
    byCategory.set(categoryId, category)
  }

  return {
    lines,
    knownAmount,
    unknownAmountCount,
    overdueCount,
    nextPendingPayment,
    byCategory: [...byCategory.values()],
  }
}

export type CategoryCommitmentCoverage = {
  knownCommitment: number
  unknownCommitmentCount: number
  coverage: number
  isKnownShortfall: boolean
}

/** Informational cash view only; it never changes monthly budget metrics. */
export function calculateAvailableAfterKnownCommitments(
  availableAmount: number,
  knownCommitments: number,
): number {
  return fromCents(toCents(availableAmount) - toCents(knownCommitments))
}

/** Budget allocation minus real spending and known pending obligations. */
export function calculateCategoryCommitmentCoverage(input: {
  allocated: number
  spent: number
  commitment: CategoryScheduledCommitment | undefined
}): CategoryCommitmentCoverage {
  const knownCommitment = input.commitment?.knownAmount ?? 0
  const unknownCommitmentCount = input.commitment?.unknownAmountCount ?? 0
  const coverage = fromCents(
    toCents(input.allocated) - toCents(input.spent) - toCents(knownCommitment),
  )
  return {
    knownCommitment,
    unknownCommitmentCount,
    coverage,
    isKnownShortfall: unknownCommitmentCount === 0 && coverage < 0,
  }
}
