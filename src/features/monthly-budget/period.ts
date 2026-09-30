import type { MonthlyPeriod } from './domain'

export type MonthlyPeriodState = 'past' | 'current' | 'future'

const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

function periodParts(period: MonthlyPeriod): { year: number; month: number } {
  const match = PERIOD_PATTERN.exec(period)
  if (!match) throw new Error(`Invalid monthly period: ${period}`)
  return { year: Number(match[1]), month: Number(match[2]) }
}

export function isMonthlyPeriod(value: string): value is MonthlyPeriod {
  return PERIOD_PATTERN.test(value)
}

export function previousMonthlyPeriod(period: MonthlyPeriod): MonthlyPeriod {
  const { year, month } = periodParts(period)
  return month === 1
    ? `${String(year - 1).padStart(4, '0')}-12`
    : `${String(year).padStart(4, '0')}-${String(month - 1).padStart(2, '0')}`
}

export function nextMonthlyPeriod(period: MonthlyPeriod): MonthlyPeriod {
  const { year, month } = periodParts(period)
  return month === 12
    ? `${String(year + 1).padStart(4, '0')}-01`
    : `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`
}

export function monthlyPeriodBounds(period: MonthlyPeriod): {
  start: string
  endExclusive: string
} {
  return { start: `${period}-01`, endExclusive: `${nextMonthlyPeriod(period)}-01` }
}

export function compareMonthlyPeriods(left: MonthlyPeriod, right: MonthlyPeriod): number {
  return left.localeCompare(right)
}

/** Uses local calendar fields; it never parses a YYYY-MM value as a timestamp. */
export function currentMonthlyPeriod(now: Date = new Date()): MonthlyPeriod {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function monthlyPeriodState(
  period: MonthlyPeriod,
  currentPeriod: MonthlyPeriod = currentMonthlyPeriod(),
): MonthlyPeriodState {
  const comparison = compareMonthlyPeriods(period, currentPeriod)
  if (comparison < 0) return 'past'
  if (comparison > 0) return 'future'
  return 'current'
}
