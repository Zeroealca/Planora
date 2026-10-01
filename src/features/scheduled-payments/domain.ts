import { fromCents, toCents } from '@/features/monthly-budget/money'
import type { FinancialCategory, MonthlyPeriod } from '@/features/monthly-budget/domain'

export type ScheduledPaymentFrequency = 'monthly' | 'annual'
export type ScheduledPaymentAmountType = 'fixed' | 'variable'
export type ScheduledPaymentOccurrenceStatus = 'pending' | 'paid' | 'skipped'

export type ScheduledPayment = {
  id: string
  userId: string
  name: string
  financialCategoryId: string
  frequency: ScheduledPaymentFrequency
  amountType: ScheduledPaymentAmountType
  expectedAmount: number | null
  startDate: string
  endDate: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type ScheduledPaymentOccurrence = {
  id: string
  userId: string
  scheduledPaymentId: string
  dueDate: string
  expectedAmount: number | null
  status: ScheduledPaymentOccurrenceStatus
  transactionId: string | null
  createdAt: string
  updatedAt: string
}

export type ScheduledPaymentInput = Omit<ScheduledPayment, 'id' | 'createdAt' | 'updatedAt'>

export type ScheduledPaymentSummary = {
  total: number
  pending: number
  paid: number
  skipped: number
  overdue: number
  pendingKnownAmount: number
  pendingUnknownAmountCount: number
}

type DateParts = { year: number; month: number; day: number }

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, month: number): number {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month === 2 && isLeapYear(year) ? 29 : days[month - 1]!
}

function parseDate(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
    ? { year, month, day }
    : null
}

function parsePeriod(value: string): { year: number; month: number } | null {
  const match = PERIOD_PATTERN.exec(value)
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null
}

function dateOnly(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isCivilDate(value: string): boolean {
  return parseDate(value) !== null
}

export function validateScheduledPayment(input: ScheduledPaymentInput): ScheduledPaymentInput {
  const name = input.name.trim()
  if (name === '') throw new Error('El nombre del pago programado es obligatorio.')
  if (!input.financialCategoryId) throw new Error('El pago programado requiere una categoría financiera.')
  if (input.frequency !== 'monthly' && input.frequency !== 'annual') {
    throw new Error('La frecuencia del pago programado no es válida.')
  }
  if (input.amountType !== 'fixed' && input.amountType !== 'variable') {
    throw new Error('El tipo de importe no es válido.')
  }
  if (!isCivilDate(input.startDate)) throw new Error('La fecha de inicio debe tener el formato YYYY-MM-DD.')
  if (input.endDate !== null && !isCivilDate(input.endDate)) {
    throw new Error('La fecha de fin debe tener el formato YYYY-MM-DD.')
  }
  if (input.endDate !== null && input.endDate < input.startDate) {
    throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio.')
  }
  if (input.expectedAmount !== null && (!Number.isFinite(input.expectedAmount) || input.expectedAmount <= 0)) {
    throw new Error('El importe esperado debe ser mayor a cero.')
  }
  if (input.amountType === 'fixed' && input.expectedAmount === null) {
    throw new Error('Un pago fijo requiere un importe esperado.')
  }

  return {
    ...input,
    name,
    expectedAmount: input.expectedAmount === null ? null : fromCents(toCents(input.expectedAmount)),
  }
}

/** The original day is always retained, so short months never shift later due dates. */
export function monthlyDueDate(startDate: string, period: MonthlyPeriod): string | null {
  const start = parseDate(startDate)
  const target = parsePeriod(period)
  if (!start || !target) return null
  return dateOnly(target.year, target.month, Math.min(start.day, daysInMonth(target.year, target.month)))
}

/** Feb 29 returns to Feb 29 in later leap years because the start date remains the base day. */
export function annualDueDate(startDate: string, period: MonthlyPeriod): string | null {
  const start = parseDate(startDate)
  const target = parsePeriod(period)
  if (!start || !target || start.month !== target.month) return null
  return dateOnly(target.year, target.month, Math.min(start.day, daysInMonth(target.year, target.month)))
}

export function getOccurrenceDueDateForPeriod(
  payment: Pick<ScheduledPayment, 'frequency' | 'startDate' | 'endDate'>,
  period: MonthlyPeriod,
): string | null {
  const dueDate = payment.frequency === 'monthly'
    ? monthlyDueDate(payment.startDate, period)
    : annualDueDate(payment.startDate, period)
  if (!dueDate || dueDate < payment.startDate || (payment.endDate !== null && dueDate > payment.endDate)) {
    return null
  }
  return dueDate
}

export function appliesToPeriod(
  payment: Pick<ScheduledPayment, 'frequency' | 'startDate' | 'endDate'>,
  period: MonthlyPeriod,
): boolean {
  return getOccurrenceDueDateForPeriod(payment, period) !== null
}

/** Returns the one due date a monthly period can contain for this rule, if any. */
export function getOccurrencesForPeriod(
  payment: Pick<ScheduledPayment, 'frequency' | 'startDate' | 'endDate'>,
  period: MonthlyPeriod,
): readonly string[] {
  const dueDate = getOccurrenceDueDateForPeriod(payment, period)
  return dueDate === null ? [] : [dueDate]
}

export function canMaterializeOccurrence(
  payment: Pick<ScheduledPayment, 'active'>,
  category: Pick<FinancialCategory, 'archivedAt'> | null,
): boolean {
  return payment.active && category !== null && category.archivedAt === null
}

export function createOccurrenceSnapshot(
  payment: Pick<ScheduledPayment, 'id' | 'userId' | 'expectedAmount' | 'frequency' | 'startDate' | 'endDate' | 'active'>,
  category: Pick<FinancialCategory, 'archivedAt'> | null,
  period: MonthlyPeriod,
): Omit<ScheduledPaymentOccurrence, 'id' | 'createdAt' | 'updatedAt'> | null {
  if (!canMaterializeOccurrence(payment, category)) return null
  const dueDate = getOccurrenceDueDateForPeriod(payment, period)
  if (!dueDate) return null
  return { userId: payment.userId, scheduledPaymentId: payment.id, dueDate, expectedAmount: payment.expectedAmount, status: 'pending', transactionId: null }
}

export function isOccurrenceOverdue(
  occurrence: Pick<ScheduledPaymentOccurrence, 'status' | 'dueDate'>,
  today: string,
): boolean {
  if (!isCivilDate(today)) throw new Error('La fecha actual debe tener el formato YYYY-MM-DD.')
  return occurrence.status === 'pending' && occurrence.dueDate < today
}

export function summarizeOccurrences(
  occurrences: readonly ScheduledPaymentOccurrence[],
  today: string,
): ScheduledPaymentSummary {
  let pending = 0; let paid = 0; let skipped = 0; let overdue = 0
  let pendingKnownAmount = 0; let pendingUnknownAmountCount = 0
  for (const occurrence of occurrences) {
    if (occurrence.status === 'paid') paid += 1
    if (occurrence.status === 'skipped') skipped += 1
    if (occurrence.status !== 'pending') continue
    pending += 1
    if (isOccurrenceOverdue(occurrence, today)) overdue += 1
    if (occurrence.expectedAmount === null) pendingUnknownAmountCount += 1
    else pendingKnownAmount = fromCents(toCents(pendingKnownAmount) + toCents(occurrence.expectedAmount))
  }
  return { total: occurrences.length, pending, paid, skipped, overdue, pendingKnownAmount, pendingUnknownAmountCount }
}

export function validateOccurrencePayment(
  occurrence: Pick<ScheduledPaymentOccurrence, 'status'>,
  amount: number | null,
  occurredOn: string,
): { amount: number; occurredOn: string } {
  if (occurrence.status !== 'pending') throw new Error('Solo se puede pagar una occurrence pendiente.')
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('El importe pagado debe ser mayor a cero.')
  }
  if (!isCivilDate(occurredOn)) throw new Error('La fecha de pago debe tener el formato YYYY-MM-DD.')
  return { amount: fromCents(toCents(amount)), occurredOn }
}
