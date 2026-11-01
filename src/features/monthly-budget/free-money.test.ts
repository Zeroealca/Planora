import { describe, expect, it } from 'vitest'
import { calculateFreeMoney } from './free-money'
import type { PersistedMonthlyBudgetAllocation } from './domain'

const allocation = (overrides: Partial<PersistedMonthlyBudgetAllocation> = {}): PersistedMonthlyBudgetAllocation => ({
  id: 'allocation', monthlyBudgetId: 'budget', financialCategoryId: 'rent', amount: 500,
  paymentMode: 'single', scheduledPaymentId: null, manualCompletionTransactionId: null,
  manualCompletedAt: null, createdAt: 'created', updatedAt: 'updated', ...overrides,
})

const transaction = (overrides = {}) => ({
  id: 'transaction', userId: 'user', name: 'Rent', occurredOn: '2026-11-05', amount: 400,
  type: 'expense' as const, financialCategoryId: 'rent', notes: null, createdAt: 'created', updatedAt: 'updated', ...overrides,
})

type FreeMoneyInput = Parameters<typeof calculateFreeMoney>[0]

const calculate = (overrides: Partial<FreeMoneyInput> = {}) =>
  calculateFreeMoney({ ...overrides, period: overrides.period ?? '2026-11', unassigned: overrides.unassigned ?? 50, allocations: overrides.allocations ?? [], transactions: overrides.transactions ?? [], occurrences: overrides.occurrences ?? [] })

describe('free money', () => {
  it('adds a scheduled single-payment leftover once when its paid occurrence and transaction are in period', () => {
    const summary = calculate({
      allocations: [allocation({ scheduledPaymentId: 'payment' })],
      transactions: [transaction()],
      occurrences: [{ id: 'occurrence', userId: 'user', scheduledPaymentId: 'payment', dueDate: '2026-11-03', expectedAmount: 500, status: 'paid', transactionId: 'transaction', createdAt: 'created', updatedAt: 'updated' }],
    })
    expect(summary).toEqual({ unassigned: 50, released: 100, freeMoney: 150, releases: [{ allocationId: 'allocation', transactionId: 'transaction', source: 'scheduled', amount: 100 }] })
  })

  it('releases no negative amount when the completed payment exceeds its allocation', () => {
    expect(calculate({
      allocations: [allocation({ manualCompletionTransactionId: 'transaction', manualCompletedAt: 'completed' })],
      transactions: [transaction({ amount: 600 })],
    }).freeMoney).toBe(50)
  })

  it('completes a payment without releasing money when its actual expense equals the allocation', () => {
    expect(calculate({
      allocations: [allocation({ manualCompletionTransactionId: 'transaction', manualCompletedAt: 'completed' })],
      transactions: [transaction({ amount: 500 })],
    }).released).toBe(0)
  })

  it('does not release a partial, unconfirmed, multiple-payment, or cross-period expense', () => {
    expect(calculate({ allocations: [allocation()], transactions: [transaction()] }).released).toBe(0)
    expect(calculate({ allocations: [allocation({ paymentMode: 'multiple', manualCompletionTransactionId: 'transaction', manualCompletedAt: 'completed' })], transactions: [transaction()] }).released).toBe(0)
    expect(calculate({ allocations: [allocation({ manualCompletionTransactionId: 'transaction', manualCompletedAt: 'completed' })], transactions: [transaction({ occurredOn: '2026-12-01' })] }).released).toBe(0)
  })

  it('drops a manual release when its linked transaction is edited away or removed', () => {
    const completed = allocation({ manualCompletionTransactionId: 'transaction', manualCompletedAt: 'completed' })
    expect(calculate({ allocations: [completed], transactions: [transaction({ financialCategoryId: 'other' })] }).released).toBe(0)
    expect(calculate({ allocations: [completed] }).released).toBe(0)
  })

  it('keeps annual occurrences separated by the budget period', () => {
    expect(calculate({
      allocations: [allocation({ scheduledPaymentId: 'annual' })], transactions: [transaction()],
      occurrences: [{ id: 'occurrence', userId: 'user', scheduledPaymentId: 'annual', dueDate: '2027-11-03', expectedAmount: 500, status: 'paid', transactionId: 'transaction', createdAt: 'created', updatedAt: 'updated' }],
    }).released).toBe(0)
  })
})
