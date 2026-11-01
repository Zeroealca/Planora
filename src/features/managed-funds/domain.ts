import { addCents, fromCents, subtractCents, toCents } from '@/features/monthly-budget/money'

export type ManagedFund = {
  id: string
  userId: string
  name: string
  description: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ManagedFundMovementType = 'income' | 'expense'

export type ManagedFundMovement = {
  id: string
  fundId: string
  occurredOn: string
  amount: number
  type: ManagedFundMovementType
  description: string | null
  createdAt: string
  updatedAt: string
}

export type ManagedFundPeriodSummary = {
  openingBalance: number
  income: number
  expenses: number
  closingBalance: number
  availableBalance: number
}

function movementSignedCents(movement: ManagedFundMovement): number {
  const amount = toCents(movement.amount)
  return movement.type === 'income' ? amount : -amount
}

/** Derives balances from immutable movement facts; no monthly balance is stored. */
export function calculateManagedFundPeriodSummary(
  movements: readonly ManagedFundMovement[],
  period: string,
): ManagedFundPeriodSummary {
  const monthStart = `${period}-01`
  let openingCents = 0
  let incomeCents = 0
  let expensesCents = 0
  let availableCents = 0

  for (const movement of movements) {
    const signed = movementSignedCents(movement)
    availableCents = addCents(availableCents, signed)
    if (movement.occurredOn < monthStart) openingCents = addCents(openingCents, signed)
    if (!movement.occurredOn.startsWith(`${period}-`)) continue
    if (movement.type === 'income') incomeCents = addCents(incomeCents, toCents(movement.amount))
    else expensesCents = addCents(expensesCents, toCents(movement.amount))
  }

  return {
    openingBalance: fromCents(openingCents),
    income: fromCents(incomeCents),
    expenses: fromCents(expensesCents),
    closingBalance: fromCents(subtractCents(addCents(openingCents, incomeCents), expensesCents)),
    availableBalance: fromCents(availableCents),
  }
}
