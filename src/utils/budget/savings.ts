/**
 * Pure savings-plan calculations for project budgets.
 * Monthly contributions from start through end (inclusive calendar months),
 * plus optional extraordinary movements inside that window.
 */

export type SavingsPlan = {
  savings_amount: number | null
  savings_accrues_interest: boolean
  savings_interest_rate_annual: number | null
  savings_start_date: string | null
  savings_end_date: string | null
}

export type SavingsPlanMovement = {
  date: string
  amount: number
  type: 'inflow' | 'outflow'
}

export type SavingsBreakdown = {
  months: number
  /** Sum of recurring monthly contributions only. */
  contributions: number
  /** Net extraordinary movements inside the plan window (inflows − outflows). */
  extraordinaryNet: number
  interestEarned: number
  total: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function yearMonthFromDate(date: string): string {
  return date.slice(0, 7)
}

function addMonthsToYearMonth(yearMonth: string, months: number): string {
  const [yearPart, monthPart] = yearMonth.split('-')
  const year = Number(yearPart)
  const monthIndex = Number(monthPart) - 1
  const total = year * 12 + monthIndex + months
  const nextYear = Math.floor(total / 12)
  const nextMonth = (total % 12) + 1
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`
}

function netMovementsForMonth(
  movements: readonly SavingsPlanMovement[],
  yearMonth: string,
): number {
  let net = 0
  for (const movement of movements) {
    if (!movement.date || yearMonthFromDate(movement.date) !== yearMonth) continue
    if (!Number.isFinite(movement.amount) || movement.amount <= 0) continue
    net += movement.type === 'inflow' ? movement.amount : -movement.amount
  }
  return net
}

export function countSavingsMonths(
  startDate: string,
  endDate: string,
): number {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  if (end < start) return 0

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1

  return Math.max(0, months)
}

export function isSavingsPlanComplete(plan: SavingsPlan): boolean {
  if (plan.savings_amount == null || plan.savings_amount <= 0) return false
  if (!plan.savings_start_date || !plan.savings_end_date) return false
  if (plan.savings_end_date < plan.savings_start_date) return false
  if (countSavingsMonths(plan.savings_start_date, plan.savings_end_date) <= 0) {
    return false
  }
  if (plan.savings_accrues_interest) {
    if (
      plan.savings_interest_rate_annual == null ||
      !Number.isFinite(plan.savings_interest_rate_annual) ||
      plan.savings_interest_rate_annual < 0
    ) {
      return false
    }
  }
  return true
}

/**
 * Month-by-month projection over the plan window.
 * Each month: previous + monthly contribution + movements that month
 * (+ compound interest at month end when enabled).
 * Movements outside [start, end] year-months are ignored.
 */
export function calculateSavingsBreakdown(
  plan: SavingsPlan,
  movements: readonly SavingsPlanMovement[] = [],
): SavingsBreakdown | null {
  if (!isSavingsPlanComplete(plan)) return null

  const months = countSavingsMonths(plan.savings_start_date!, plan.savings_end_date!)
  const payment = plan.savings_amount!
  const startYm = yearMonthFromDate(plan.savings_start_date!)
  const endYm = yearMonthFromDate(plan.savings_end_date!)
  const monthlyRate =
    plan.savings_accrues_interest && plan.savings_interest_rate_annual
      ? plan.savings_interest_rate_annual / 100 / 12
      : 0

  let balance = 0
  let contributions = 0
  let extraordinaryNet = 0

  for (let index = 0; index < months; index += 1) {
    const yearMonth = addMonthsToYearMonth(startYm, index)
    if (yearMonth > endYm) break

    const net = netMovementsForMonth(movements, yearMonth)
    contributions = roundMoney(contributions + payment)
    extraordinaryNet = roundMoney(extraordinaryNet + net)
    // Ordinary annuity: prior balance compounds, then this month's cash flows land.
    balance = roundMoney(balance * (1 + monthlyRate) + payment + net)
  }

  const principal = roundMoney(contributions + extraordinaryNet)
  return {
    months,
    contributions: roundMoney(contributions),
    extraordinaryNet: roundMoney(extraordinaryNet),
    interestEarned: roundMoney(balance - principal),
    total: roundMoney(balance),
  }
}

export function calculateSavingsBudget(
  plan: SavingsPlan,
  movements: readonly SavingsPlanMovement[] = [],
): number | null {
  return calculateSavingsBreakdown(plan, movements)?.total ?? null
}

/**
 * Project available budget / ceiling. Source of truth: `projects.budget` only.
 * Savings plans are informational and must not override this value.
 */
export function resolveProjectBudget(project: {
  budget: number | null
}): number | null {
  if (project.budget == null || !Number.isFinite(project.budget)) return null
  return project.budget
}
