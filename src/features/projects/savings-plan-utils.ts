import type { Project } from '@/types/domain'
import {
  isSavingsPlanComplete,
  type SavingsPlan,
} from '@/utils/budget/savings'
import { parseCost } from '@/utils/form'

export function savingsPlanFromProject(project?: Project): SavingsPlan {
  return {
    savings_amount: project?.savings_amount ?? null,
    savings_accrues_interest: project?.savings_accrues_interest ?? false,
    savings_interest_rate_annual: project?.savings_interest_rate_annual ?? null,
    savings_start_date: project?.savings_start_date ?? null,
    savings_end_date: project?.savings_end_date ?? null,
  }
}

export function parseSavingsPlanInput(input: {
  amount: string
  accruesInterest: boolean
  interestRate: string
  startDate: string
  endDate: string
}): SavingsPlan {
  const parsedAmount = parseCost(input.amount)
  const parsedRate = parseCost(input.interestRate)

  return {
    savings_amount: parsedAmount,
    savings_accrues_interest: input.accruesInterest,
    savings_interest_rate_annual: input.accruesInterest ? parsedRate : null,
    savings_start_date: input.startDate.trim() === '' ? null : input.startDate,
    savings_end_date: input.endDate.trim() === '' ? null : input.endDate,
  }
}

export function validateSavingsPlan(plan: SavingsPlan): string | null {
  const hasAnyField =
    plan.savings_amount != null ||
    plan.savings_start_date != null ||
    plan.savings_end_date != null ||
    plan.savings_accrues_interest

  if (!hasAnyField) {
    return 'Configura el plan de ahorro para calcular el presupuesto del proyecto.'
  }

  if (!isSavingsPlanComplete(plan)) {
    return 'Completa monto mensual, fechas de inicio y fin, y tasa si aplica interés.'
  }

  return null
}
