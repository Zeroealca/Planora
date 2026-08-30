import type { Project } from '@/types/domain'
import { calculateSavingsBudget, type SavingsPlan } from '@/utils/budget/savings'

export type ProjectSavingsInput = SavingsPlan

export function buildSavingsPayload(savings: ProjectSavingsInput) {
  return {
    budget: calculateSavingsBudget(savings),
    savings_amount: savings.savings_amount,
    savings_accrues_interest: savings.savings_accrues_interest,
    savings_interest_rate_annual: savings.savings_accrues_interest
      ? savings.savings_interest_rate_annual
      : null,
    savings_start_date: savings.savings_start_date,
    savings_end_date: savings.savings_end_date,
  }
}

export function buildProjectPayload(input: {
  name: string
  description: string | null
  icon: string | null
  label_preset: Project['label_preset']
  savings: ProjectSavingsInput
}) {
  return {
    name: input.name.trim(),
    description: input.description,
    icon: input.icon,
    label_preset: input.label_preset,
    ...buildSavingsPayload(input.savings),
  }
}
