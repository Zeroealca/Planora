import type { ProjectedPaymentLine } from '@/features/scheduled-payments/forecast'
import type { MonthlyBudgetSummary } from '@/features/monthly-budget/domain'
import type { ProjectSavingsMovement } from '@/types/domain'

export type GoalBalanceInput = {
  initialBalance: number | null
  movements: readonly Pick<ProjectSavingsMovement, 'amount' | 'movement_type'>[]
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Current accumulated balance for a savings-goal project (initial + movements). */
export function calculateGoalAccumulatedBalance(input: GoalBalanceInput): number {
  const initial = input.initialBalance ?? 0
  const net = input.movements.reduce((total, movement) => {
    if (!Number.isFinite(movement.amount)) return total
    return total + (movement.movement_type === 'inflow' ? movement.amount : -movement.amount)
  }, 0)
  return roundMoney(initial + net)
}

export function calculateGoalRemaining(
  targetAmount: number | null,
  accumulated: number,
): number | null {
  if (targetAmount == null || !Number.isFinite(targetAmount) || targetAmount <= 0) return null
  return roundMoney(Math.max(0, targetAmount - accumulated))
}

export function calculateGoalProgressPercent(
  targetAmount: number | null,
  accumulated: number,
): number {
  if (targetAmount == null || !Number.isFinite(targetAmount) || targetAmount <= 0) return 0
  return Math.min(100, Math.max(0, (accumulated / targetAmount) * 100))
}

/**
 * Pending commitments only, soonest first. Paid/skipped never appear.
 * Overdue pendings stay first because lines are already sorted by due date.
 */
export function selectUpcomingPendingPayments(
  lines: readonly ProjectedPaymentLine[],
  limit: number,
): ProjectedPaymentLine[] {
  if (limit <= 0) return []
  return lines.filter((line) => line.status === 'pending').slice(0, limit)
}

export function isPaymentOverdue(dueDate: string, today: string): boolean {
  return dueDate < today
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function firstNameFromDisplay(displayName: string | null | undefined, email: string | null | undefined): string | null {
  const trimmed = displayName?.trim()
  if (trimmed) return trimmed.split(/\s+/)[0] ?? trimmed
  const local = email?.split('@')[0]?.trim()
  return local || null
}

export function monthlyFinancialContext(
  metrics: Pick<MonthlyBudgetSummary, 'actualRemaining'> | null,
  formatMoney: (value: number) => string,
): string {
  if (!metrics) {
    return 'Crea tu presupuesto mensual para empezar a ver tu situación financiera.'
  }
  if (metrics.actualRemaining >= 0) {
    return `Te quedan ${formatMoney(metrics.actualRemaining)} disponibles este mes tras los gastos reales.`
  }
  return `Este mes llevas ${formatMoney(Math.abs(metrics.actualRemaining))} por encima de tu disponible.`
}

/** Relative bar widths so assigned/spent amounts are comparable across categories. */
export function categoryComparisonScale(
  categories: readonly { budget: number; spent: number }[],
): number {
  let max = 0
  for (const category of categories) {
    max = Math.max(max, category.budget, category.spent)
  }
  return max
}

export function relativeBarPercent(value: number, scale: number): number {
  if (scale <= 0 || !Number.isFinite(value) || value <= 0) return 0
  return Math.min(100, Math.max(0, (value / scale) * 100))
}
