import { currentMonthlyPeriod, isMonthlyPeriod } from '@/features/monthly-budget/period'
import type { MonthlyPeriod } from '@/features/monthly-budget/domain'

/** Uses a valid URL period when present, otherwise safely falls back to the local month. */
export function dashboardPeriodFromSearch(value: string | null): MonthlyPeriod {
  return value !== null && isMonthlyPeriod(value) ? value : currentMonthlyPeriod()
}

export function transactionCreateHref(
  period: MonthlyPeriod,
  type: 'expense' | 'income',
): string {
  return `/budget/transactions?period=${encodeURIComponent(period)}&create=1&type=${type}`
}

export function budgetHref(period: MonthlyPeriod): string {
  return `/budget?period=${encodeURIComponent(period)}`
}

export function scheduledPaymentHref(period: MonthlyPeriod, paymentId?: string): string {
  const query = new URLSearchParams({ period })
  if (paymentId) query.set('payment', paymentId)
  return `/budget/scheduled-payments?${query.toString()}`
}

export function projectCreateHref(): string {
  return '/projects?create=1'
}
