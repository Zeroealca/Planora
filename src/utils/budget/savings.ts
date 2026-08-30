/**
 * Pure savings-plan calculations for project budgets.
 * Monthly contributions from start through end (inclusive calendar months).
 */

export type SavingsPlan = {
  savings_amount: number | null
  savings_accrues_interest: boolean
  savings_interest_rate_annual: number | null
  savings_start_date: string | null
  savings_end_date: string | null
}

export type SavingsBreakdown = {
  months: number
  contributions: number
  interestEarned: number
  total: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
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

export function calculateSavingsBreakdown(plan: SavingsPlan): SavingsBreakdown | null {
  if (!isSavingsPlanComplete(plan)) return null

  const months = countSavingsMonths(plan.savings_start_date!, plan.savings_end_date!)
  const payment = plan.savings_amount!
  const contributions = roundMoney(payment * months)

  if (!plan.savings_accrues_interest || plan.savings_interest_rate_annual === 0) {
    return {
      months,
      contributions,
      interestEarned: 0,
      total: contributions,
    }
  }

  const monthlyRate = plan.savings_interest_rate_annual! / 100 / 12
  const total = roundMoney(
    payment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate),
  )

  return {
    months,
    contributions,
    interestEarned: roundMoney(total - contributions),
    total,
  }
}

export function calculateSavingsBudget(plan: SavingsPlan): number | null {
  return calculateSavingsBreakdown(plan)?.total ?? null
}

export function resolveProjectBudget(
  project: SavingsPlan & { budget: number | null },
): number | null {
  const fromSavings = calculateSavingsBudget(project)
  if (fromSavings != null) return fromSavings
  if (project.budget == null || !Number.isFinite(project.budget)) return null
  return project.budget
}
