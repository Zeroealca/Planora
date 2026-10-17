import { describe, expect, it } from 'vitest'
import { calculateMonthlyBudgetPeriodSummary } from '@/features/monthly-budget/transaction-summary'
import type { FinancialTransaction } from '@/features/transactions/domain'
import { calculateMonthlyScheduledCommitments } from './commitments'
import type { ScheduledPayment, ScheduledPaymentOccurrence } from './domain'

const payment: ScheduledPayment = {
  id: 'rent', userId: 'user', name: 'Renta', financialCategoryId: 'housing',
  frequency: 'monthly', amountType: 'fixed', expectedAmount: 300, startDate: '2026-01-05',
  endDate: null, active: true, reminderEnabled: false, reminderDaysBefore: 0,
  createdAt: '', updatedAt: '',
}

const paidOccurrence: ScheduledPaymentOccurrence = {
  id: 'oct-rent', userId: 'user', scheduledPaymentId: 'rent', dueDate: '2026-10-05',
  expectedAmount: 300, status: 'paid', transactionId: 'rent-transaction', createdAt: '', updatedAt: '',
}

const paidInNovember: FinancialTransaction = {
  id: 'rent-transaction', userId: 'user', name: 'Renta', occurredOn: '2026-11-02', amount: 310,
  type: 'expense', financialCategoryId: 'housing', notes: null, createdAt: '', updatedAt: '',
}

describe('scheduled payment to monthly budget flow', () => {
  it('counts a confirmed occurrence once, in the transaction month, and never as a pending commitment', () => {
    const categories = new Map([['housing', { archivedAt: null }]])
    const octoberCommitments = calculateMonthlyScheduledCommitments({
      period: '2026-10', today: '2026-11-02', payments: [payment], categoriesById: categories,
      occurrences: [paidOccurrence],
    })
    const octoberBudget = calculateMonthlyBudgetPeriodSummary(
      { period: '2026-10', availableAmount: 500, allocations: [{ financialCategoryId: 'housing', amount: 350 }] },
      [paidInNovember],
    )
    const novemberBudget = calculateMonthlyBudgetPeriodSummary(
      { period: '2026-11', availableAmount: 500, allocations: [{ financialCategoryId: 'housing', amount: 350 }] },
      [paidInNovember],
    )

    expect(octoberCommitments).toMatchObject({ knownAmount: 0, nextPendingPayment: null })
    expect(octoberBudget.metrics.spent).toBe(0)
    expect(novemberBudget.metrics).toMatchObject({ spent: 310, actualRemaining: 190 })
  })
})
