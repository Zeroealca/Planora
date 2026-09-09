import type { ProjectSavingsMovement, SavingsMovementType } from '@/types/domain'
import {
  isSavingsGoalConfigComplete,
  type SavingsGoalConfig,
  type SavingsMovementInput,
} from '@/utils/budget/savings-goal'
import { parseCost } from '@/utils/form'
import type { ProjectSavingsGoalInput } from './project-savings'

export function parseGoalDraft(input: {
  enabled: boolean
  initialBalance: string
  targetAmount: string
  minimumReserve: string
  monthlyContribution: string
  startDate: string
}): ProjectSavingsGoalInput {
  return {
    enabled: input.enabled,
    initialBalance: parseCost(input.initialBalance),
    targetAmount: parseCost(input.targetAmount),
    minimumReserve: parseCost(input.minimumReserve),
    monthlyContribution: parseCost(input.monthlyContribution),
    startDate: input.startDate.trim() === '' ? null : input.startDate,
  }
}

export function toSavingsGoalConfig(input: ProjectSavingsGoalInput): SavingsGoalConfig {
  return {
    enabled: input.enabled,
    initialBalance: input.initialBalance ?? 0,
    targetAmount: input.targetAmount ?? 0,
    minimumReserve: input.minimumReserve ?? 0,
    monthlyContribution: input.monthlyContribution ?? 0,
    startDate: input.startDate ?? '',
  }
}

export function validateSavingsGoalInput(
  input: ProjectSavingsGoalInput,
): string | null {
  if (!input.enabled) return null

  const config = toSavingsGoalConfig(input)
  if (!isSavingsGoalConfigComplete(config)) {
    return 'Completa saldo inicial, cantidad objetivo, reserva mínima, aporte mensual y fecha de inicio.'
  }
  if (
    input.initialBalance == null ||
    input.targetAmount == null ||
    input.minimumReserve == null ||
    input.monthlyContribution == null
  ) {
    return 'Completa saldo inicial, cantidad objetivo, reserva mínima, aporte mensual y fecha de inicio.'
  }
  return null
}

export function movementsToProjectionInput(
  movements: readonly ProjectSavingsMovement[],
): SavingsMovementInput[] {
  return movements.map((movement) => ({
    name: movement.name,
    date: movement.movement_date,
    amount: movement.amount,
    type: movement.movement_type,
  }))
}

export function validateMovementInput(input: {
  name: string
  date: string
  amount: string
  type: SavingsMovementType
}): string | null {
  if (input.name.trim() === '') return 'El nombre del movimiento es obligatorio.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return 'La fecha del movimiento no es válida.'
  }
  const amount = parseCost(input.amount)
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return 'El monto debe ser mayor que cero.'
  }
  if (input.type !== 'inflow' && input.type !== 'outflow') {
    return 'Tipo de movimiento no válido.'
  }
  return null
}
