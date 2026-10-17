import { describe, expect, it } from 'vitest'
import { calculateAvailableAfterKnownCommitments, calculateCategoryCommitmentCoverage, calculateMonthlyScheduledCommitments } from './commitments'
import type { ScheduledPayment, ScheduledPaymentOccurrence } from './domain'

const category = new Map([['housing', { archivedAt: null }]])
const payment = (overrides: Partial<ScheduledPayment> = {}): ScheduledPayment => ({
  id: 'rent', userId: 'user', name: 'Renta', financialCategoryId: 'housing', frequency: 'monthly',
  amountType: 'fixed', expectedAmount: 300, startDate: '2026-01-05', endDate: null, active: true,
  reminderEnabled: false, reminderDaysBefore: 0, createdAt: '', updatedAt: '', ...overrides,
})
const occurrence = (overrides: Partial<ScheduledPaymentOccurrence> = {}): ScheduledPaymentOccurrence => ({
  id: 'rent-oct', userId: 'user', scheduledPaymentId: 'rent', dueDate: '2026-10-05', expectedAmount: 300,
  status: 'pending', transactionId: null, createdAt: '', updatedAt: '', ...overrides,
})

describe('monthly scheduled commitments', () => {
  it('groups pending commitments by category and calculates known coverage', () => {
    const result = calculateMonthlyScheduledCommitments({ period: '2026-10', today: '2026-10-01', payments: [payment()], categoriesById: category, occurrences: [occurrence()] })
    expect(result.knownAmount).toBe(300)
    expect(result.byCategory).toEqual([{ financialCategoryId: 'housing', knownAmount: 300, unknownAmountCount: 0, pendingCount: 1 }])
    expect(calculateAvailableAfterKnownCommitments(869.67, result.knownAmount)).toBe(569.67)
    expect(calculateCategoryCommitmentCoverage({ allocated: 280, spent: 10, commitment: result.byCategory[0] })).toMatchObject({ coverage: -30, isKnownShortfall: true })
  })

  it('does not count paid or skipped occurrences as pending commitments', () => {
    for (const status of ['paid', 'skipped'] as const) {
      const result = calculateMonthlyScheduledCommitments({ period: '2026-10', today: '2026-10-10', payments: [payment()], categoriesById: category, occurrences: [occurrence({ status })] })
      expect(result.knownAmount).toBe(0)
      expect(result.byCategory).toEqual([])
    }
  })

  it('uses the occurrence snapshot instead of an edited rule amount', () => {
    const result = calculateMonthlyScheduledCommitments({ period: '2026-10', today: '2026-10-01', payments: [payment({ expectedAmount: 500 })], categoriesById: category, occurrences: [occurrence({ expectedAmount: 300 })] })
    expect(result.knownAmount).toBe(300)
  })

  it('uses recurrence when no occurrence exists', () => {
    const result = calculateMonthlyScheduledCommitments({ period: '2026-10', today: '2026-10-01', payments: [payment()], categoriesById: category, occurrences: [] })
    expect(result.knownAmount).toBe(300)
    expect(result.nextPendingPayment?.dueDate).toBe('2026-10-05')
  })

  it('keeps variable payments without an amount out of totals and warnings', () => {
    const result = calculateMonthlyScheduledCommitments({ period: '2026-10', today: '2026-10-01', payments: [payment({ amountType: 'variable', expectedAmount: null })], categoriesById: category, occurrences: [] })
    expect(result).toMatchObject({ knownAmount: 0, unknownAmountCount: 1 })
    expect(calculateCategoryCommitmentCoverage({ allocated: 0, spent: 0, commitment: result.byCategory[0] })).toMatchObject({ coverage: 0, isKnownShortfall: false, unknownCommitmentCount: 1 })
  })

  it('keeps spending in the transaction month while commitments follow the due month', () => {
    const result = calculateMonthlyScheduledCommitments({ period: '2026-10', today: '2026-11-10', payments: [payment()], categoriesById: category, occurrences: [occurrence()] })
    expect(result.knownAmount).toBe(300)
    expect(result.overdueCount).toBe(1)
  })

  it('handles months with no applicable scheduled payments', () => {
    const result = calculateMonthlyScheduledCommitments({ period: '2026-10', today: '2026-10-01', payments: [payment({ frequency: 'annual', startDate: '2026-02-05' })], categoriesById: category, occurrences: [] })
    expect(result).toMatchObject({ knownAmount: 0, unknownAmountCount: 0, overdueCount: 0, nextPendingPayment: null })
  })
})
