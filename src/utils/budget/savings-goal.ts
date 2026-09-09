/**
 * Pure savings-goal projection — independent from projects.budget.
 * Persist only config + movements; never store viable date / months / totals.
 */

export type SavingsMovementType = 'inflow' | 'outflow'

export type SavingsGoalConfig = {
  enabled: boolean
  initialBalance: number
  targetAmount: number
  minimumReserve: number
  monthlyContribution: number
  startDate: string
}

export type SavingsMovementInput = {
  name: string
  date: string
  amount: number
  type: SavingsMovementType
}

export type SavingsGoalProjection = {
  requiredSavings: number
  monthsNeeded: number
  viableYearMonth: string
  viableDate: string
  projectedBalance: number
  remainingAfterGoal: number
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

export function addMonthsToYearMonth(yearMonth: string, months: number): string {
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

export function formatYearMonthLabel(
  yearMonth: string,
  locale = 'es',
): string {
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
    }
  }

  const canProgress =
    config.monthlyContribution > 0 ||
    movements.some((movement) => movement.type === 'inflow' && movement.amount > 0)

  if (!canProgress) return null

  for (let months = 1; months <= MAX_PROJECTION_MONTHS; months += 1) {
    const ym = addMonthsToYearMonth(startYm, months)
    balance = roundMoney(
      balance +
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
