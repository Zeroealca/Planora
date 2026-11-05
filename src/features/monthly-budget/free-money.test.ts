import { describe, expect, it } from 'vitest'
import { calculateFreeMoney } from './free-money'
import type { PersistedMonthlyBudgetAllocation } from './domain'

const allocation = (overrides: Partial<PersistedMonthlyBudgetAllocation> = {}): PersistedMonthlyBudgetAllocation => ({
  id: 'allocation', monthlyBudgetId: 'budget', financialCategoryId: 'rent', amount: 500,
  paymentsCompletedAt: null, createdAt: 'created', updatedAt: 'updated', ...overrides,
})

const transaction = (overrides = {}) => ({
  id: 'transaction', userId: 'user', name: 'Rent', occurredOn: '2026-11-05', amount: 400,
  type: 'expense' as const, financialCategoryId: 'rent', notes: null, createdAt: 'created', updatedAt: 'updated', ...overrides,
})

type FreeMoneyInput = Parameters<typeof calculateFreeMoney>[0]

const calculate = (overrides: Partial<FreeMoneyInput> = {}) =>
  calculateFreeMoney({ ...overrides, period: overrides.period ?? '2026-11', unassigned: overrides.unassigned ?? 50, allocations: overrides.allocations ?? [], transactions: overrides.transactions ?? [] })

describe('free money', () => {
  it('releases a completed allocation from its period expenses', () => {
    const summary = calculate({
      allocations: [allocation({ paymentsCompletedAt: 'completed' })],
      transactions: [transaction()],
    })
    expect(summary).toEqual({ unassigned: 50, released: 100, freeMoney: 150, releases: [{ allocationId: 'allocation', amount: 100 }] })
  })

  it('releases no negative amount when the completed payment exceeds its allocation', () => {
    expect(calculate({
      allocations: [allocation({ paymentsCompletedAt: 'completed' })],
      transactions: [transaction({ amount: 600 })],
    }).freeMoney).toBe(50)
  })

  it('completes a payment without releasing money when its actual expense equals the allocation', () => {
    expect(calculate({
      allocations: [allocation({ paymentsCompletedAt: 'completed' })],
      transactions: [transaction({ amount: 500 })],
    }).released).toBe(0)
  })

  it('does not release an unconfirmed or cross-period expense', () => {
    expect(calculate({ allocations: [allocation()], transactions: [transaction()] }).released).toBe(0)
    expect(calculate({ allocations: [allocation({ paymentsCompletedAt: 'completed' })], transactions: [transaction({ occurredOn: '2026-12-01' })] }).released).toBe(0)
  })

  it('uses all period expenses when the final transaction completes a multiple-payment allocation', () => {
    const finalPayment = transaction({ id: 'second', amount: 45, occurredOn: '2026-11-15' })
    const summary = calculate({
      allocations: [allocation({ amount: 100, paymentsCompletedAt: 'completed' })],
      transactions: [transaction({ id: 'first', amount: 30 }), finalPayment],
    })
    expect(summary.released).toBe(25)
    expect(summary.freeMoney).toBe(75)
  })

  it('recalculates a definitive payment when another period expense is added or the allocation changes', () => {
    const completed = allocation({ amount: 100, paymentsCompletedAt: 'completed' })
    expect(calculate({ allocations: [completed], transactions: [transaction({ amount: 75 })] }).released).toBe(25)
    expect(calculate({ allocations: [completed], transactions: [transaction({ amount: 75 }), transaction({ id: 'later', amount: 15, occurredOn: '2026-11-20' })] }).released).toBe(10)
    expect(calculate({ allocations: [{ ...completed, amount: 80 }], transactions: [transaction({ amount: 75 })] }).released).toBe(5)
  })

  it('drops a manual release when its linked transaction is edited away or removed', () => {
    const completed = allocation({ paymentsCompletedAt: 'completed' })
    expect(calculate({ allocations: [completed], transactions: [transaction({ financialCategoryId: 'other' })] }).released).toBe(0)
    expect(calculate({ allocations: [completed] }).released).toBe(0)
  })

})
