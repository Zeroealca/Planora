import { describe, expect, it } from 'vitest'
import { toMonthlyBudgetDomain, type PersistedMonthlyBudget, type PersistedMonthlyBudgetAllocation } from '@/features/monthly-budget/domain'
import {
  calculateMonthlyBudgetPeriodSummary,
  getBudgetTransactionsForPeriod,
} from '@/features/monthly-budget/transaction-summary'
import { validateTransactionInput } from './transaction-api'
import type { FinancialTransaction } from './domain'

function transaction(input: Partial<FinancialTransaction> = {}): FinancialTransaction {
  return {
    id: 'transaction',
    userId: 'user',
    name: 'Compra',
    occurredOn: '2027-09-10',
    amount: 50,
    type: 'expense',
    financialCategoryId: 'food',
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...input,
  }
}

const budget: PersistedMonthlyBudget = {
  id: 'budget', userId: 'user', period: '2027-09', availableAmount: 869.67, createdAt: '', updatedAt: '',
}

const allocations: PersistedMonthlyBudgetAllocation[] = [
  { id: 'food-allocation', monthlyBudgetId: 'budget', financialCategoryId: 'food', amount: 250, createdAt: '', updatedAt: '' },
  { id: 'internet-allocation', monthlyBudgetId: 'budget', financialCategoryId: 'internet', amount: 35, createdAt: '', updatedAt: '' },
]

describe('transaction input rules', () => {
  it('allows a categorized expense and an uncategorized income', () => {
    expect(validateTransactionInput({ name: 'Supermercado', occurredOn: '2027-09-10', amount: 186.42, type: 'expense', financialCategoryId: 'food', notes: null })).toMatchObject({ amount: 186.42 })
    expect(validateTransactionInput({ name: 'Sueldo', occurredOn: '2027-09-30', amount: 1000, type: 'income', financialCategoryId: null, notes: null })).toMatchObject({ type: 'income' })
  })

  it('rejects an expense without category and non-positive amounts', () => {
    expect(() => validateTransactionInput({ name: 'Supermercado', occurredOn: '2027-09-10', amount: 50, type: 'expense', financialCategoryId: null, notes: null })).toThrow(/requiere una categoría/i)
    expect(() => validateTransactionInput({ name: 'Error', occurredOn: '2027-09-10', amount: -1, type: 'income', financialCategoryId: null, notes: null })).toThrow(/mayor a cero/i)
    expect(() => validateTransactionInput({ name: 'Cero', occurredOn: '2027-09-10', amount: 0, type: 'income', financialCategoryId: null, notes: null })).toThrow(/mayor a cero/i)
  })
})

describe('monthly transaction integration', () => {
  it('selects exactly the civil dates inside a month', () => {
    const transactions = [
      transaction({ id: 'august', occurredOn: '2027-08-31' }),
      transaction({ id: 'first', occurredOn: '2027-09-01' }),
      transaction({ id: 'last', occurredOn: '2027-09-30' }),
      transaction({ id: 'october', occurredOn: '2027-10-01' }),
    ]
    expect(getBudgetTransactionsForPeriod(transactions, '2027-09').map(({ id }) => id)).toEqual([
      'first', 'last',
    ])
  })

  it('derives monthly and category metrics from expenses, not income', () => {
    const result = calculateMonthlyBudgetPeriodSummary(toMonthlyBudgetDomain(budget, allocations), [
      transaction({ id: 'food', amount: 195, financialCategoryId: 'food' }),
      transaction({ id: 'health', amount: 20, financialCategoryId: 'health' }),
      transaction({ id: 'income', name: 'Sueldo', amount: 1000, type: 'income', financialCategoryId: null }),
    ])
    expect(result.metrics).toEqual({
      availableAmount: 869.67, assigned: 285, unassigned: 584.67, spent: 215, actualRemaining: 654.67,
    })
    expect(result.categories).toEqual([
      { financialCategoryId: 'food', hasAllocation: true, budget: 250, spent: 195, remaining: 55, usage: 0.78, overBudget: 0 },
      { financialCategoryId: 'internet', hasAllocation: true, budget: 35, spent: 0, remaining: 35, usage: 0, overBudget: 0 },
      { financialCategoryId: 'health', hasAllocation: false, budget: 0, spent: 20, remaining: -20, usage: null, overBudget: 20 },
    ])
  })

  it('recalculates naturally after amount, category, date, and deletion changes', () => {
    const monthlyBudget = toMonthlyBudgetDomain(budget, allocations)
    const original = transaction({ amount: 186.42, financialCategoryId: 'food', occurredOn: '2027-09-30' })
    expect(calculateMonthlyBudgetPeriodSummary(monthlyBudget, [original]).metrics.spent).toBe(186.42)
    expect(calculateMonthlyBudgetPeriodSummary(monthlyBudget, [{ ...original, amount: 198.72 }]).metrics.spent).toBe(198.72)
    expect(calculateMonthlyBudgetPeriodSummary(monthlyBudget, [{ ...original, financialCategoryId: 'transport' }]).categories.find((category) => category.financialCategoryId === 'food')!.spent).toBe(0)
    expect(calculateMonthlyBudgetPeriodSummary(monthlyBudget, [{ ...original, occurredOn: '2027-10-01' }]).metrics.spent).toBe(0)
    expect(calculateMonthlyBudgetPeriodSummary(monthlyBudget, []).metrics.spent).toBe(0)
  })
})
