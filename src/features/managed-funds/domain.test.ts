import { describe, expect, it } from 'vitest'
import { calculateManagedFundPeriodSummary, type ManagedFundMovement } from './domain'
import { validateManagedFundMovementInput } from './managed-funds-api'

function movement(input: Partial<ManagedFundMovement>): ManagedFundMovement {
  return { id: 'movement', fundId: 'fund', occurredOn: '2026-01-01', amount: 0, type: 'income', description: null, createdAt: '', updatedAt: '', ...input }
}

describe('managed fund balances', () => {
  it('carries the final balance into later months and years without movements', () => {
    const movements = [movement({ id: 'income', occurredOn: '2026-12-20', amount: 100, type: 'income' }), movement({ id: 'expense', occurredOn: '2026-12-22', amount: 25.5, type: 'expense', description: 'Compra' })]
    expect(calculateManagedFundPeriodSummary(movements, '2026-12')).toMatchObject({ openingBalance: 0, income: 100, expenses: 25.5, closingBalance: 74.5, availableBalance: 74.5 })
    expect(calculateManagedFundPeriodSummary(movements, '2027-01')).toMatchObject({ openingBalance: 74.5, income: 0, expenses: 0, closingBalance: 74.5, availableBalance: 74.5 })
  })

  it('recalculates all later balances when a historical movement is edited or deleted', () => {
    const original = [movement({ id: 'income', occurredOn: '2026-01-05', amount: 100, type: 'income' }), movement({ id: 'expense', occurredOn: '2026-02-01', amount: 20, type: 'expense', description: 'Pago' })]
    expect(calculateManagedFundPeriodSummary(original, '2026-03').openingBalance).toBe(80)
    expect(calculateManagedFundPeriodSummary([{ ...original[0]!, amount: 150 }, original[1]!], '2026-03').openingBalance).toBe(130)
    expect(calculateManagedFundPeriodSummary([original[0]!], '2026-03').openingBalance).toBe(100)
  })
})

describe('managed fund movement validation', () => {
  it('requires a positive USD amount and a description for expenses', () => {
    expect(() => validateManagedFundMovementInput({ occurredOn: '2026-01-02', amount: 0, type: 'income', description: null })).toThrow(/mayor a cero/i)
    expect(() => validateManagedFundMovementInput({ occurredOn: '2026-01-02', amount: 5, type: 'expense', description: null })).toThrow(/describe/i)
    expect(() => validateManagedFundMovementInput({ occurredOn: '2026-02-30', amount: 5, type: 'income', description: null })).toThrow(/fecha/i)
    expect(validateManagedFundMovementInput({ occurredOn: '2026-01-02', amount: 5.129, type: 'income', description: null })).toMatchObject({ amount: 5.13 })
  })
})
