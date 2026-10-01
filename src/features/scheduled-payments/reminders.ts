import type { FinancialCategory, MonthlyPeriod } from '@/features/monthly-budget/domain'
import {
  monthlyPeriodBounds,
  nextMonthlyPeriod,
  previousMonthlyPeriod,
} from '@/features/monthly-budget/period'
import type {
  ScheduledPayment,
  ScheduledPaymentOccurrence,
  ScheduledPaymentOccurrenceStatus,
} from './domain'
import { isCivilDate } from './domain'

export type ReminderDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed'

export type ScheduledPaymentReminderDelivery = {
  id: string
  userId: string
  scheduledPaymentId: string
  occurrenceId: string
  reminderDate: string
  daysBeforeDue: number
  status: ReminderDeliveryStatus
  attemptCount: number
  lastError: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

export type ReminderConfig = {
  reminderEnabled: boolean
  reminderDaysBefore: number
}

/** Soft cap so a permanently broken destination does not retry forever. */
export const REMINDER_MAX_ATTEMPTS = 10

/**
 * Window for reminder processing relative to today:
 * pending occurrences whose due_date falls in the previous, current, or next
 * civil month. Covers cross-month "days before" (e.g. due Jan 3, 7 days → Dec 27)
 * and a small overdue pouch for late job runs without reopening ancient history.
 */
export function reminderDueDateWindow(today: string): { start: string; endExclusive: string } {
  if (!isCivilDate(today)) throw new Error('La fecha actual debe tener el formato YYYY-MM-DD.')
  const current = today.slice(0, 7) as MonthlyPeriod
  const start = monthlyPeriodBounds(previousMonthlyPeriod(current)).start
  const endExclusive = monthlyPeriodBounds(nextMonthlyPeriod(current)).endExclusive
  return { start, endExclusive }
}

export function isDueDateInReminderWindow(dueDate: string, today: string): boolean {
  if (!isCivilDate(dueDate)) return false
  const window = reminderDueDateWindow(today)
  return dueDate >= window.start && dueDate < window.endExclusive
}

function dateOnly(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, month: number): number {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month === 2 && isLeapYear(year) ? 29 : days[month - 1]!
}

/** Civil-date arithmetic: reminderDate = dueDate − daysBeforeDue. */
export function calculateReminderDate(dueDate: string, daysBeforeDue: number): string {
  if (!isCivilDate(dueDate)) throw new Error('La fecha de vencimiento debe tener el formato YYYY-MM-DD.')
  if (!Number.isInteger(daysBeforeDue) || daysBeforeDue < 0) {
    throw new Error('Los días de anticipación deben ser un entero mayor o igual a cero.')
  }
  if (daysBeforeDue === 0) return dueDate

  const [year, month, day] = dueDate.split('-').map(Number) as [number, number, number]
  let y = year
  let m = month
  let d = day - daysBeforeDue

  while (d < 1) {
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
    d += daysInMonth(y, m)
  }

  return dateOnly(y, m, d)
}

export function validateReminderConfig(config: ReminderConfig): ReminderConfig {
  if (!Number.isInteger(config.reminderDaysBefore) || config.reminderDaysBefore < 0) {
    throw new Error('Los días de anticipación deben ser un entero mayor o igual a cero.')
  }
  return {
    reminderEnabled: Boolean(config.reminderEnabled),
    reminderDaysBefore: config.reminderDaysBefore,
  }
}

export function defaultReminderConfig(): ReminderConfig {
  return { reminderEnabled: false, reminderDaysBefore: 7 }
}

export type ReminderEligibilityInput = {
  payment: Pick<ScheduledPayment, 'active' | 'reminderEnabled' | 'reminderDaysBefore'>
  category: Pick<FinancialCategory, 'archivedAt'> | null
  occurrence: Pick<ScheduledPaymentOccurrence, 'status' | 'dueDate'>
  delivery: Pick<ScheduledPaymentReminderDelivery, 'status' | 'attemptCount'> | null
  today: string
}

export function isReminderEligible(input: ReminderEligibilityInput): boolean {
  const { payment, category, occurrence, delivery, today } = input
  if (!isCivilDate(today)) throw new Error('La fecha actual debe tener el formato YYYY-MM-DD.')
  if (!payment.reminderEnabled) return false
  if (!payment.active) return false
  if (category === null || category.archivedAt !== null) return false
  if (occurrence.status !== 'pending') return false
  if (!isDueDateInReminderWindow(occurrence.dueDate, today)) return false

  const reminderDate = calculateReminderDate(occurrence.dueDate, payment.reminderDaysBefore)
  if (reminderDate > today) return false

  if (delivery?.status === 'sent') return false
  if (delivery !== null && delivery.attemptCount >= REMINDER_MAX_ATTEMPTS) return false
  if (delivery?.status === 'processing') return false

  return true
}

/** Whether a delivery row can be claimed by a worker (including stale processing). */
export function canClaimReminderDelivery(
  status: ReminderDeliveryStatus | null,
  options: { processingIsStale?: boolean } = {},
): boolean {
  if (status === null || status === 'pending' || status === 'failed') return true
  if (status === 'sent') return false
  return Boolean(options.processingIsStale)
}

export type ReminderEmailContent = {
  subject: string
  text: string
}

export function buildScheduledPaymentReminderEmail(input: {
  paymentName: string
  dueDate: string
  expectedAmount: number | null
  amountLabel: string
  siteUrl: string | null
}): ReminderEmailContent {
  const dueLabel = formatCivilDateLong(input.dueDate)
  const amountLine =
    input.expectedAmount === null
      ? 'Importe:\nPor registrar'
      : `Importe esperado:\n${input.amountLabel}`

  const lines = [
    'Tienes un pago programado próximo.',
    '',
    input.paymentName,
    '',
    'Vencimiento:',
    dueLabel,
    '',
    amountLine,
  ]

  if (input.siteUrl) {
    lines.push('', `Abrir Planora: ${input.siteUrl}`)
  }

  lines.push('', 'Este correo es solo un recordatorio. No registra ningún pago.')

  return {
    subject: `Planora — ${input.paymentName} vence el ${dueLabel}`,
    text: lines.join('\n'),
  }
}

export function formatCivilDateLong(value: string): string {
  if (!isCivilDate(value)) return value
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function formatReminderSummary(config: ReminderConfig): string {
  if (!config.reminderEnabled) return 'Sin recordatorio'
  if (config.reminderDaysBefore === 0) return 'Recordatorio: el día del vencimiento'
  if (config.reminderDaysBefore === 1) return 'Recordatorio: 1 día antes'
  return `Recordatorio: ${config.reminderDaysBefore} días antes`
}

export function occurrenceStatusBlocksReminder(
  status: ScheduledPaymentOccurrenceStatus,
): boolean {
  return status === 'paid' || status === 'skipped'
}
