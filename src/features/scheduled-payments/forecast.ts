import { fromCents, toCents } from '@/features/monthly-budget/money'
import type { FinancialCategory, MonthlyPeriod } from '@/features/monthly-budget/domain'
import { nextMonthlyPeriod } from '@/features/monthly-budget/period'
import {
  getOccurrenceDueDateForPeriod,
  type ScheduledPayment,
  type ScheduledPaymentFrequency,
  type ScheduledPaymentOccurrence,
  type ScheduledPaymentOccurrenceStatus,
} from './domain'

export type ForecastHorizonMonths = 3 | 6 | 12

export const FORECAST_HORIZON_OPTIONS = [3, 6, 12] as const satisfies readonly ForecastHorizonMonths[]

export type ProjectedPaymentSource = 'occurrence' | 'rule'

export type ProjectedPaymentLine = {
  scheduledPaymentId: string
  name: string
  frequency: ScheduledPaymentFrequency
  amountType: ScheduledPayment['amountType']
  dueDate: string
  expectedAmount: number | null
  status: ScheduledPaymentOccurrenceStatus
  occurrenceId: string | null
  source: ProjectedPaymentSource
}

export type ProjectedMonthSummary = {
  period: MonthlyPeriod
  lines: ProjectedPaymentLine[]
  /** Pending expected amounts only; paid/skipped never contribute. */
  knownExpectedAmount: number
  unknownVariableCount: number
  paymentCount: number
  pendingCount: number
  paidCount: number
  skippedCount: number
}

export type ExpenseProjection = {
  startPeriod: MonthlyPeriod
  horizonMonths: ForecastHorizonMonths
  months: ProjectedMonthSummary[]
  totalKnownExpectedAmount: number
  totalUnknownVariableCount: number
}

export function isForecastHorizonMonths(value: number): value is ForecastHorizonMonths {
  return value === 3 || value === 6 || value === 12
}

/** Inclusive civil-month window: start + (horizonMonths − 1) following months. */
export function periodsForHorizon(
  startPeriod: MonthlyPeriod,
  horizonMonths: ForecastHorizonMonths,
): MonthlyPeriod[] {
  const periods: MonthlyPeriod[] = [startPeriod]
  let current = startPeriod
  for (let index = 1; index < horizonMonths; index += 1) {
    current = nextMonthlyPeriod(current)
    periods.push(current)
  }
  return periods
}

export function canIncludeInForecast(
  payment: Pick<ScheduledPayment, 'active'>,
  category: Pick<FinancialCategory, 'archivedAt'> | null,
): boolean {
  return payment.active && category !== null && category.archivedAt === null
}

/**
 * One projected obligation for a period.
 * Existing occurrence snapshots win over the current rule amount/status.
 */
export function getProjectedPaymentForPeriod(
  payment: ScheduledPayment,
  category: Pick<FinancialCategory, 'archivedAt'> | null,
  period: MonthlyPeriod,
  occurrence: ScheduledPaymentOccurrence | null,
): ProjectedPaymentLine | null {
  if (!canIncludeInForecast(payment, category)) return null

  if (occurrence) {
    return {
      scheduledPaymentId: payment.id,
      name: payment.name,
      frequency: payment.frequency,
      amountType: payment.amountType,
      dueDate: occurrence.dueDate,
      expectedAmount: occurrence.expectedAmount,
      status: occurrence.status,
      occurrenceId: occurrence.id,
      source: 'occurrence',
    }
  }

  const dueDate = getOccurrenceDueDateForPeriod(payment, period)
  if (!dueDate) return null

  return {
    scheduledPaymentId: payment.id,
    name: payment.name,
    frequency: payment.frequency,
    amountType: payment.amountType,
    dueDate,
    expectedAmount: payment.expectedAmount,
    status: 'pending',
    occurrenceId: null,
    source: 'rule',
  }
}

export function getProjectedPaymentsForPeriod(
  payments: readonly ScheduledPayment[],
  categoriesById: ReadonlyMap<string, Pick<FinancialCategory, 'archivedAt'> | null>,
  occurrences: readonly ScheduledPaymentOccurrence[],
  period: MonthlyPeriod,
): ProjectedPaymentLine[] {
  const occurrenceByPaymentId = new Map<string, ScheduledPaymentOccurrence>()
  for (const occurrence of occurrences) {
    occurrenceByPaymentId.set(occurrence.scheduledPaymentId, occurrence)
  }

  const lines: ProjectedPaymentLine[] = []
  for (const payment of payments) {
    const category = categoriesById.get(payment.financialCategoryId) ?? null
    const line = getProjectedPaymentForPeriod(
      payment,
      category,
      period,
      occurrenceByPaymentId.get(payment.id) ?? null,
    )
    if (line) lines.push(line)
  }

  return lines.sort((left, right) => {
    const byDate = left.dueDate.localeCompare(right.dueDate)
    if (byDate !== 0) return byDate
    return left.name.localeCompare(right.name, 'es')
  })
}

export function calculateProjectedMonthSummary(
  period: MonthlyPeriod,
  lines: readonly ProjectedPaymentLine[],
): ProjectedMonthSummary {
  let knownExpectedAmount = 0
  let unknownVariableCount = 0
  let pendingCount = 0
  let paidCount = 0
  let skippedCount = 0

  for (const line of lines) {
    if (line.status === 'paid') {
      paidCount += 1
      continue
    }
    if (line.status === 'skipped') {
      skippedCount += 1
      continue
    }
    pendingCount += 1
    if (line.expectedAmount === null) unknownVariableCount += 1
    else knownExpectedAmount = fromCents(toCents(knownExpectedAmount) + toCents(line.expectedAmount))
  }

  return {
    period,
    lines: [...lines],
    knownExpectedAmount,
    unknownVariableCount,
    paymentCount: lines.length,
    pendingCount,
    paidCount,
    skippedCount,
  }
}

/**
 * Pure forecast over a horizon. Does not materialize occurrences or create transactions.
 * Pass only occurrences whose due_date falls inside the requested horizon range.
 */
export function calculateExpenseProjection(input: {
  startPeriod: MonthlyPeriod
  horizonMonths: ForecastHorizonMonths
  payments: readonly ScheduledPayment[]
  categoriesById: ReadonlyMap<string, Pick<FinancialCategory, 'archivedAt'> | null>
  occurrencesInHorizon: readonly ScheduledPaymentOccurrence[]
}): ExpenseProjection {
  const periods = periodsForHorizon(input.startPeriod, input.horizonMonths)
  const occurrencesByPeriod = new Map<MonthlyPeriod, ScheduledPaymentOccurrence[]>()
  for (const period of periods) occurrencesByPeriod.set(period, [])

  for (const occurrence of input.occurrencesInHorizon) {
    const period = occurrence.dueDate.slice(0, 7) as MonthlyPeriod
    const bucket = occurrencesByPeriod.get(period)
    if (bucket) bucket.push(occurrence)
  }

  const months = periods.map((period) =>
    calculateProjectedMonthSummary(
      period,
      getProjectedPaymentsForPeriod(
        input.payments,
        input.categoriesById,
        occurrencesByPeriod.get(period) ?? [],
        period,
      ),
    ),
  )

  let totalKnownExpectedAmount = 0
  let totalUnknownVariableCount = 0
  for (const month of months) {
    totalKnownExpectedAmount = fromCents(
      toCents(totalKnownExpectedAmount) + toCents(month.knownExpectedAmount),
    )
    totalUnknownVariableCount += month.unknownVariableCount
  }

  return {
    startPeriod: input.startPeriod,
    horizonMonths: input.horizonMonths,
    months,
    totalKnownExpectedAmount,
    totalUnknownVariableCount,
  }
}
