/**
 * Pure savings-goal projection — independent from projects.budget.
 * Persist only config + movements; never store viable date / months / totals.
 */

import {
  monthlySavingsInterestRate,
  type SavingsCompoundingFrequency,
  type SavingsInterestRateType,
} from './savings'

export type SavingsMovementType = 'inflow' | 'outflow'

export type SavingsGoalConfig = {
  enabled: boolean
  initialBalance: number
  targetAmount: number
  minimumReserve: number
  monthlyContribution: number
  startDate: string
  accruesInterest: boolean
  interestRateAnnual: number | null
  interestRateType: SavingsInterestRateType
  interestCompoundingFrequency: SavingsCompoundingFrequency
}

export type SavingsMovementInput = {
  name: string
  date: string
  amount: number
  type: SavingsMovementType
  kind?: 'contribution' | 'interest'
}

export type SavingsGoalProjection = {
  requiredSavings: number
  monthsNeeded: number
  viableYearMonth: string
  viableDate: string
  projectedBalance: number
  remainingAfterGoal: number
  capitalContributed: number
  actualInterestReceived: number
  estimatedFutureInterest: number
}

export type SavingsProjectionComparison = {
  actual: SavingsGoalProjection | null
  simulation: SavingsGoalProjection | null
  monthsDelta: number | null
}

const MAX_PROJECTION_MONTHS = 600

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function yearMonthFromDate(date: string): string {
  return date.slice(0, 7)
}

export function addMonthsToYearMonth(
  yearMonth: string,
  months: number,
): string {
  const [yearPart, monthPart] = yearMonth.split('-')
  const year = Number(yearPart)
  const monthIndex = Number(monthPart) - 1
  const total = year * 12 + monthIndex + months
  const nextYear = Math.floor(total / 12)
  const nextMonth = (total % 12) + 1
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`
}

export function dateForYearMonth(yearMonth: string, day = 1): string {
  return `${yearMonth}-${String(day).padStart(2, '0')}`
}

export function formatYearMonthLabel(yearMonth: string, locale = 'es'): string {
  const date = new Date(`${dateForYearMonth(yearMonth)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return yearMonth
  const label = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function requiredSavings(
  targetAmount: number,
  minimumReserve: number,
): number {
  return roundMoney(targetAmount + minimumReserve)
}

export function isSavingsGoalConfigComplete(
  config: Pick<
    SavingsGoalConfig,
    | 'initialBalance'
    | 'targetAmount'
    | 'minimumReserve'
    | 'monthlyContribution'
    | 'startDate'
    | 'accruesInterest'
    | 'interestRateAnnual'
  >,
): boolean {
  if (!config.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(config.startDate)) {
    return false
  }
  if (!Number.isFinite(config.initialBalance) || config.initialBalance < 0) {
    return false
  }
  if (!Number.isFinite(config.targetAmount) || config.targetAmount < 0) {
    return false
  }
  if (!Number.isFinite(config.minimumReserve) || config.minimumReserve < 0) {
    return false
  }
  if (
    !Number.isFinite(config.monthlyContribution) ||
    config.monthlyContribution < 0
  ) {
    return false
  }
  if (
    config.accruesInterest &&
    (config.interestRateAnnual == null ||
      !Number.isFinite(config.interestRateAnnual) ||
      config.interestRateAnnual < 0 ||
      config.interestRateAnnual > 100)
  )
    return false
  return true
}

function netMovementsForMonth(
  movements: readonly SavingsMovementInput[],
  yearMonth: string,
): number {
  let net = 0
  for (const movement of movements) {
    if (yearMonthFromDate(movement.date) !== yearMonth) continue
    if (!Number.isFinite(movement.amount) || movement.amount <= 0) continue
    net += movement.type === 'inflow' ? movement.amount : -movement.amount
  }
  return net
}

export function actualInterestReceived(
  movements: readonly SavingsMovementInput[],
): number {
  return roundMoney(
    movements.reduce(
      (total, movement) =>
        total +
        (movement.kind === 'interest' &&
        movement.type === 'inflow' &&
        Number.isFinite(movement.amount)
          ? movement.amount
          : 0),
      0,
    ),
  )
}

/**
 * Month 0 = start month: initial balance + movements that month (no monthly contribution).
 * Months 1..N: previous + monthly contribution + movements of that month.
 * First month where balance >= target + reserve is the viable month.
 */
export function projectSavingsGoal(
  config: SavingsGoalConfig,
  movements: readonly SavingsMovementInput[] = [],
): SavingsGoalProjection | null {
  if (!isSavingsGoalConfigComplete(config)) return null

  const needed = requiredSavings(config.targetAmount, config.minimumReserve)
  const monthlyRate = monthlySavingsInterestRate({
    savings_accrues_interest: config.accruesInterest,
    savings_interest_rate_annual: config.interestRateAnnual,
    savings_interest_rate_type: config.interestRateType,
    savings_interest_compounding_frequency: config.interestCompoundingFrequency,
  })
  const actualInterest = actualInterestReceived(movements)
  const movementsNet = movements.reduce(
    (total, movement) =>
      total + (movement.type === 'inflow' ? movement.amount : -movement.amount),
    0,
  )
  const nonInterestMovementsNet = movements.reduce(
    (total, movement) =>
      total +
      (movement.kind === 'interest'
        ? 0
        : movement.type === 'inflow'
          ? movement.amount
          : -movement.amount),
    0,
  )
  const startYm = yearMonthFromDate(config.startDate)
  let balance = roundMoney(
    config.initialBalance + netMovementsForMonth(movements, startYm),
  )

  if (balance >= needed) {
    return {
      requiredSavings: needed,
      monthsNeeded: 0,
      viableYearMonth: startYm,
      viableDate: dateForYearMonth(startYm),
      projectedBalance: balance,
      remainingAfterGoal: roundMoney(balance - config.targetAmount),
      capitalContributed: roundMoney(
        config.initialBalance + nonInterestMovementsNet,
      ),
      actualInterestReceived: actualInterest,
      estimatedFutureInterest: 0,
    }
  }

  const canProgress =
    config.monthlyContribution > 0 ||
    movements.some(
      (movement) => movement.type === 'inflow' && movement.amount > 0,
    )

  if (!canProgress) return null

  for (let months = 1; months <= MAX_PROJECTION_MONTHS; months += 1) {
    const ym = addMonthsToYearMonth(startYm, months)
    balance = roundMoney(
      balance * (1 + monthlyRate) +
        config.monthlyContribution +
        netMovementsForMonth(movements, ym),
    )
    if (balance >= needed) {
      return {
        requiredSavings: needed,
        monthsNeeded: months,
        viableYearMonth: ym,
        viableDate: dateForYearMonth(ym),
        projectedBalance: balance,
        remainingAfterGoal: roundMoney(balance - config.targetAmount),
        capitalContributed: roundMoney(
          config.initialBalance +
            nonInterestMovementsNet +
            config.monthlyContribution * months,
        ),
        actualInterestReceived: actualInterest,
        estimatedFutureInterest: roundMoney(
          balance -
            (config.initialBalance +
              movementsNet +
              config.monthlyContribution * months),
        ),
      }
    }
  }

  return null
}

/** Positive monthsDelta = simulation reaches the goal later than actual. */
export function compareSavingsProjections(
  actual: SavingsGoalProjection | null,
  simulation: SavingsGoalProjection | null,
): SavingsProjectionComparison {
  const monthsDelta =
    actual != null && simulation != null
      ? simulation.monthsNeeded - actual.monthsNeeded
      : null

  return { actual, simulation, monthsDelta }
}

export function describeMonthsDelta(monthsDelta: number | null): string | null {
  if (monthsDelta == null) return null
  if (monthsDelta === 0) return 'Misma cantidad de meses'
  if (monthsDelta < 0) {
    const n = Math.abs(monthsDelta)
    return n === 1 ? '1 mes antes' : `${n} meses antes`
  }
  return monthsDelta === 1 ? '1 mes después' : `${monthsDelta} meses después`
}
