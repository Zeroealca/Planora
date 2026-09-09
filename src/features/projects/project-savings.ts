import type { Project, SavingsMode } from '@/types/domain'
import type { SavingsGoalConfig } from '@/utils/budget/savings-goal'
import type { SavingsPlan } from '@/utils/budget/savings'

export type ProjectSavingsGoalInput = {
  enabled: boolean
  initialBalance: number | null
  targetAmount: number | null
  minimumReserve: number | null
  monthlyContribution: number | null
  startDate: string | null
}

/** Persist savings-goal fields only — never writes projects.budget or plan fields. */
export function buildSavingsGoalPayload(goal: ProjectSavingsGoalInput) {
  return {
    // Mode is immutable for goal projects; keep enabled mirror in sync when saving config.
    savings_goal_enabled: goal.enabled,
    savings_initial_balance: goal.initialBalance,
    savings_target_amount: goal.targetAmount,
    savings_minimum_reserve: goal.minimumReserve,
    savings_goal_monthly_amount: goal.monthlyContribution,
    savings_goal_start_date: goal.startDate,
  }
}

/** Persist legacy savings plan fields only — never writes goal or budget. */
export function buildSavingsPlanPayload(plan: SavingsPlan) {
  return {
    savings_mode: 'plan' as const,
    savings_goal_enabled: false,
    savings_amount: plan.savings_amount,
    savings_accrues_interest: plan.savings_accrues_interest,
    savings_interest_rate_annual: plan.savings_accrues_interest
      ? plan.savings_interest_rate_annual
      : null,
    savings_start_date: plan.savings_start_date,
    savings_end_date: plan.savings_end_date,
  }
}

export function buildSavingsModePayload(mode: SavingsMode) {
  return {
    savings_mode: mode,
    savings_goal_enabled: mode === 'goal',
  }
}

export function buildProjectPayload(input: {
  name: string
  description: string | null
  icon: string | null
  label_preset: Project['label_preset']
  budget: number | null
  savingsGoal?: ProjectSavingsGoalInput
}) {
  const emptyGoal: ProjectSavingsGoalInput = {
    enabled: false,
    initialBalance: null,
    targetAmount: null,
    minimumReserve: null,
    monthlyContribution: null,
    startDate: null,
  }

  return {
    name: input.name.trim(),
    description: input.description,
    icon: input.icon,
    label_preset: input.label_preset,
    budget: input.budget,
    ...buildSavingsGoalPayload(input.savingsGoal ?? emptyGoal),
  }
}

export function savingsGoalConfigFromProject(project: Project): SavingsGoalConfig {
  return {
    enabled: project.savings_mode === 'goal',
    initialBalance: project.savings_initial_balance ?? 0,
    targetAmount: project.savings_target_amount ?? 0,
    minimumReserve: project.savings_minimum_reserve ?? 0,
    monthlyContribution: project.savings_goal_monthly_amount ?? 0,
    startDate: project.savings_goal_start_date ?? '',
  }
}

export function savingsGoalInputFromProject(project: Project): ProjectSavingsGoalInput {
  return {
    enabled: project.savings_mode === 'goal',
    initialBalance: project.savings_initial_balance,
    targetAmount: project.savings_target_amount,
    minimumReserve: project.savings_minimum_reserve,
    monthlyContribution: project.savings_goal_monthly_amount,
    startDate: project.savings_goal_start_date,
  }
}

/** @deprecated Prefer buildSavingsPlanPayload / buildSavingsGoalPayload */
export function buildSavingsPayload(savings: {
  savings_amount: number | null
  savings_accrues_interest: boolean
  savings_interest_rate_annual: number | null
  savings_start_date: string | null
  savings_end_date: string | null
}) {
  return buildSavingsPlanPayload(savings)
}
