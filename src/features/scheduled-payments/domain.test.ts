import { describe, expect, it } from 'vitest'
import type { FinancialCategory } from '@/features/monthly-budget/domain'
import type { ScheduledPayment } from './domain'
import {
  annualDueDate,
  canMaterializeOccurrence,
  createOccurrenceSnapshot,
  getOccurrenceDueDateForPeriod,
  isOccurrenceOverdue,
  monthlyDueDate,
  oneTimeDueDate,
  summarizeOccurrences,
  validateOccurrencePayment,
  validateScheduledPayment,
} from './domain'

function payment(overrides: Partial<ScheduledPayment> = {}): ScheduledPayment {
  return {
    id: 'mortgage', userId: 'user', name: 'Mortgage', financialCategoryId: 'housing',
    frequency: 'monthly', amountType: 'fixed', expectedAmount: 308.97,
    startDate: '2027-01-31', endDate: null, active: true,
    reminderEnabled: false, reminderDaysBefore: 7,
    createdAt: '', updatedAt: '', ...overrides,
  }
}

const activeCategory: FinancialCategory = {
  id: 'housing', userId: 'user', name: 'Housing', archivedAt: null, createdAt: '', updatedAt: '',
}

describe('scheduled payment recurrence', () => {
  it('keeps the monthly base day across short months', () => {
    expect(monthlyDueDate('2027-10-05', '2027-11')).toBe('2027-11-05')
    expect(monthlyDueDate('2027-01-31', '2027-02')).toBe('2027-02-28')
    expect(monthlyDueDate('2027-01-31', '2027-03')).toBe('2027-03-31')
    expect(monthlyDueDate('2027-01-30', '2027-02')).toBe('2027-02-28')
    expect(monthlyDueDate('2027-01-30', '2027-03')).toBe('2027-03-30')
  })

  it('uses February 29 in leap years without permanently moving the base day', () => {
    expect(monthlyDueDate('2028-01-31', '2028-02')).toBe('2028-02-29')
    expect(monthlyDueDate('2028-01-31', '2028-03')).toBe('2028-03-31')
    expect(annualDueDate('2028-02-29', '2029-02')).toBe('2029-02-28')
    expect(annualDueDate('2028-02-29', '2032-02')).toBe('2032-02-29')
  })

  it('produces annual occurrences only in the start month', () => {
    expect(annualDueDate('2027-01-15', '2028-01')).toBe('2028-01-15')
    expect(annualDueDate('2027-01-15', '2028-02')).toBeNull()
  })

  it('respects start and end boundaries, including an occurrence exactly on the end date', () => {
    const rule = payment({ startDate: '2027-03-05', endDate: '2027-05-05' })
    expect(getOccurrenceDueDateForPeriod(rule, '2027-02')).toBeNull()
    expect(getOccurrenceDueDateForPeriod(rule, '2027-03')).toBe('2027-03-05')
    expect(getOccurrenceDueDateForPeriod(rule, '2027-05')).toBe('2027-05-05')
    expect(getOccurrenceDueDateForPeriod(rule, '2027-06')).toBeNull()
  })

  it('produces exactly one one_time due date in its month', () => {
    expect(oneTimeDueDate('2027-06-15', '2027-06')).toBe('2027-06-15')
    expect(oneTimeDueDate('2027-06-15', '2027-05')).toBeNull()
    expect(oneTimeDueDate('2027-06-15', '2027-07')).toBeNull()
    expect(getOccurrenceDueDateForPeriod(payment({
      frequency: 'one_time', startDate: '2027-06-15', endDate: null, expectedAmount: 500,
    }), '2027-06')).toBe('2027-06-15')
    expect(createOccurrenceSnapshot(payment({
      frequency: 'one_time', startDate: '2027-06-15', endDate: null, expectedAmount: 500,
    }), activeCategory, '2027-06')).toMatchObject({ dueDate: '2027-06-15', expectedAmount: 500 })
    expect(createOccurrenceSnapshot(payment({
      frequency: 'one_time', startDate: '2027-06-15', endDate: null, expectedAmount: 500,
    }), activeCategory, '2027-05')).toBeNull()
    expect(createOccurrenceSnapshot(payment({
      frequency: 'one_time', startDate: '2027-06-15', endDate: null, active: false, expectedAmount: 500,
    }), activeCategory, '2027-06')).toBeNull()
  })
})

describe('scheduled payment validation and occurrences', () => {
  it('requires a positive fixed amount while allowing a nullable variable reference', () => {
    expect(() => validateScheduledPayment(payment({ expectedAmount: null }))).toThrow(/fijo requiere/i)
    expect(validateScheduledPayment(payment({ amountType: 'variable', expectedAmount: null }))).toMatchObject({ expectedAmount: null })
    expect(validateScheduledPayment(payment({ amountType: 'variable', expectedAmount: 60 }))).toMatchObject({ expectedAmount: 60 })
    expect(() => validateScheduledPayment(payment({ expectedAmount: 0 }))).toThrow(/mayor a cero/i)
    expect(() => validateScheduledPayment(payment({ endDate: '2026-12-31' }))).toThrow(/fin no puede/i)
    expect(() => validateScheduledPayment(payment({
      frequency: 'one_time', startDate: '2027-06-15', endDate: '2027-06-20', expectedAmount: 500,
    }))).toThrow(/una sola vez no admite fecha final/i)
    expect(validateScheduledPayment(payment({
      frequency: 'one_time', startDate: '2027-06-15', endDate: null, expectedAmount: 500,
    }))).toMatchObject({ frequency: 'one_time', endDate: null, expectedAmount: 500 })
    expect(validateScheduledPayment(payment({
      frequency: 'one_time', amountType: 'variable', startDate: '2027-03-20', endDate: null, expectedAmount: null,
    }))).toMatchObject({ expectedAmount: null })
  })

  it('does not materialize inactive or archived-category rules', () => {
    expect(canMaterializeOccurrence(payment({ active: false }), activeCategory)).toBe(false)
    expect(canMaterializeOccurrence(payment(), { ...activeCategory, archivedAt: '2027-01-01T00:00:00Z' })).toBe(false)
    expect(createOccurrenceSnapshot(payment(), activeCategory, '2027-02')).toMatchObject({ dueDate: '2027-02-28', status: 'pending' })
    expect(createOccurrenceSnapshot(payment({ active: false }), activeCategory, '2027-02')).toBeNull()
  })

  it('creates a pending snapshot that does not change when the rule is later edited', () => {
    const october = createOccurrenceSnapshot(payment({ startDate: '2027-10-05' }), activeCategory, '2027-10')
    expect(october).toMatchObject({ expectedAmount: 308.97, status: 'pending', transactionId: null })
    const editedRule = payment({ startDate: '2027-10-05', expectedAmount: 315 })
    expect(editedRule.expectedAmount).toBe(315)
    expect(october?.expectedAmount).toBe(308.97)
  })

  it('derives overdue exclusively from pending status and a date before today', () => {
    expect(isOccurrenceOverdue({ status: 'pending', dueDate: '2027-09-09' }, '2027-09-10')).toBe(true)
    expect(isOccurrenceOverdue({ status: 'pending', dueDate: '2027-09-10' }, '2027-09-10')).toBe(false)
    expect(isOccurrenceOverdue({ status: 'paid', dueDate: '2027-09-09' }, '2027-09-10')).toBe(false)
    expect(isOccurrenceOverdue({ status: 'skipped', dueDate: '2027-09-09' }, '2027-09-10')).toBe(false)
  })

  it('accepts real payment dates around the due date and never changes expected amount', () => {
    const occurrence = { status: 'pending' as const, dueDate: '2027-10-05' }
    expect(validateOccurrencePayment(occurrence, 308.97, '2027-10-03')).toMatchObject({ occurredOn: '2027-10-03' })
    expect(validateOccurrencePayment(occurrence, 310, '2027-10-05')).toMatchObject({ amount: 310 })
    expect(validateOccurrencePayment(occurrence, 53.42, '2027-10-07')).toMatchObject({ amount: 53.42 })
    expect(() => validateOccurrencePayment(occurrence, null, '2027-10-05')).toThrow(/importe pagado/i)
    expect(() => validateOccurrencePayment({ status: 'skipped' }, 10, '2027-10-05')).toThrow(/pendiente/i)
  })

  it('summarizes pending known amounts without inventing zero for unknown variables', () => {
    const summary = summarizeOccurrences([
      { id: 'known', userId: 'user', scheduledPaymentId: 'a', dueDate: '2027-10-05', expectedAmount: 308.97, status: 'pending', transactionId: null, createdAt: '', updatedAt: '' },
      { id: 'variable', userId: 'user', scheduledPaymentId: 'b', dueDate: '2027-10-18', expectedAmount: null, status: 'pending', transactionId: null, createdAt: '', updatedAt: '' },
      { id: 'paid', userId: 'user', scheduledPaymentId: 'c', dueDate: '2027-10-01', expectedAmount: 35, status: 'paid', transactionId: 'tx', createdAt: '', updatedAt: '' },
    ], '2027-10-10')
    expect(summary).toMatchObject({ total: 3, pending: 2, paid: 1, overdue: 1, pendingKnownAmount: 308.97, pendingUnknownAmountCount: 1 })
  })
})
