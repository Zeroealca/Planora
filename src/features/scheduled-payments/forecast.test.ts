import { describe, expect, it } from 'vitest'
import type { FinancialCategory } from '@/features/monthly-budget/domain'
import type { ScheduledPayment, ScheduledPaymentOccurrence } from './domain'
import { calculateReminderDate } from './reminders'
import {
  calculateExpenseProjection,
  calculateProjectedMonthSummary,
  getProjectedPaymentForPeriod,
  getProjectedPaymentsForPeriod,
  periodsForHorizon,
} from './forecast'

function payment(overrides: Partial<ScheduledPayment> = {}): ScheduledPayment {
  return {
    id: 'mortgage',
    userId: 'user',
    name: 'Hipoteca',
    financialCategoryId: 'housing',
    frequency: 'monthly',
    amountType: 'fixed',
    expectedAmount: 308.97,
    startDate: '2026-10-05',
    endDate: null,
    active: true,
    reminderEnabled: false,
    reminderDaysBefore: 7,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function occurrence(
  overrides: Partial<ScheduledPaymentOccurrence> = {},
): ScheduledPaymentOccurrence {
  return {
    id: 'occ',
    userId: 'user',
    scheduledPaymentId: 'mortgage',
    dueDate: '2026-10-05',
    expectedAmount: 308.97,
    status: 'pending',
    transactionId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

const activeCategory: FinancialCategory = {
  id: 'housing',
  userId: 'user',
  name: 'Housing',
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
}

const categories = new Map([['housing', activeCategory], ['utilities', activeCategory]])

describe('forecast horizon and monthly recurrence', () => {
  it('includes the start month in a 3-month horizon', () => {
    expect(periodsForHorizon('2026-10', 3)).toEqual(['2026-10', '2026-11', '2026-12'])
  })

  it('projects a monthly day-5 payment across three months', () => {
    const projection = calculateExpenseProjection({
      startPeriod: '2026-10',
      horizonMonths: 3,
      payments: [payment()],
      categoriesById: categories,
      occurrencesInHorizon: [],
    })
    expect(projection.months.map((month) => month.lines.map((line) => line.dueDate))).toEqual([
      ['2026-10-05'],
      ['2026-11-05'],
      ['2026-12-05'],
    ])
    expect(projection.totalKnownExpectedAmount).toBe(926.91)
    expect(projection.totalUnknownVariableCount).toBe(0)
  })

  it('keeps month-end clamping for day 31 monthly rules', () => {
    const line = getProjectedPaymentForPeriod(
      payment({ startDate: '2026-01-31' }),
      activeCategory,
      '2026-02',
      null,
    )
    expect(line?.dueDate).toBe('2026-02-28')
  })
})

describe('forecast annual and one_time', () => {
  it('includes annual only in its month', () => {
    const annual = payment({
      id: 'tax',
      name: 'Impuesto predial',
      frequency: 'annual',
      startDate: '2027-01-15',
      expectedAmount: 120,
    })
    const withJanuary = calculateExpenseProjection({
      startPeriod: '2026-12',
      horizonMonths: 3,
      payments: [annual],
      categoriesById: categories,
      occurrencesInHorizon: [],
    })
    expect(withJanuary.months[0]!.lines).toHaveLength(0)
    expect(withJanuary.months[1]!.lines).toEqual([
      expect.objectContaining({ dueDate: '2027-01-15', expectedAmount: 120 }),
    ])
    expect(withJanuary.months[2]!.lines).toHaveLength(0)

    const withoutJanuary = calculateExpenseProjection({
      startPeriod: '2026-10',
      horizonMonths: 3,
      payments: [annual],
      categoriesById: categories,
      occurrencesInHorizon: [],
    })
    expect(withoutJanuary.months.every((month) => month.lines.length === 0)).toBe(true)
  })

  it('respects leap-year annual Feb 29 clamping via existing recurrence', () => {
    const line = getProjectedPaymentForPeriod(
      payment({
        id: 'leap',
        frequency: 'annual',
        startDate: '2028-02-29',
        expectedAmount: 50,
      }),
      activeCategory,
      '2029-02',
      null,
    )
    expect(line?.dueDate).toBe('2029-02-28')
  })

  it('projects one_time only in its due month', () => {
    const oneTime = payment({
      id: 'cistern',
      name: 'Cisterna',
      frequency: 'one_time',
      startDate: '2027-06-15',
      expectedAmount: 500,
    })
    expect(getProjectedPaymentForPeriod(oneTime, activeCategory, '2027-05', null)).toBeNull()
    expect(getProjectedPaymentForPeriod(oneTime, activeCategory, '2027-06', null)).toMatchObject({
      dueDate: '2027-06-15',
      expectedAmount: 500,
      source: 'rule',
    })
    expect(getProjectedPaymentForPeriod(oneTime, activeCategory, '2027-07', null)).toBeNull()
  })
})

describe('forecast snapshots and statuses', () => {
  it('prefers the materialised occurrence amount over the current rule', () => {
    const line = getProjectedPaymentForPeriod(
      payment({ expectedAmount: 315 }),
      activeCategory,
      '2026-10',
      occurrence({ expectedAmount: 308.97, status: 'pending' }),
    )
    expect(line).toMatchObject({
      expectedAmount: 308.97,
      source: 'occurrence',
      status: 'pending',
    })
  })

  it('sums only pending known amounts and counts unknown variables separately', () => {
    const lines = getProjectedPaymentsForPeriod(
      [
        payment({ id: 'a', name: 'Hipoteca', expectedAmount: 308.97 }),
        payment({
          id: 'b',
          name: 'Internet',
          expectedAmount: 35,
          startDate: '2026-10-15',
        }),
        payment({
          id: 'c',
          name: 'Agua',
          amountType: 'variable',
          expectedAmount: null,
          startDate: '2026-10-20',
        }),
      ],
      categories,
      [
        occurrence({
          id: 'paid',
          scheduledPaymentId: 'a',
          expectedAmount: 308.97,
          status: 'paid',
          transactionId: 'tx',
        }),
        occurrence({
          id: 'skip',
          scheduledPaymentId: 'extra',
          dueDate: '2026-10-12',
          expectedAmount: 10,
          status: 'skipped',
        }),
      ],
      '2026-10',
    )

    // paid mortgage still listed from occurrence; skipped for unknown payment id is ignored
    // because no matching payment. Internet and Agua come from rules.
    const summary = calculateProjectedMonthSummary('2026-10', [
      ...lines,
      {
        scheduledPaymentId: 'skip-rule',
        name: 'Omitido',
        frequency: 'monthly',
        amountType: 'fixed',
        dueDate: '2026-10-12',
        expectedAmount: 10,
        status: 'skipped',
        occurrenceId: 'skip',
        source: 'occurrence',
      },
    ])

    expect(summary.knownExpectedAmount).toBe(35)
    expect(summary.unknownVariableCount).toBe(1)
    expect(summary.paidCount).toBe(1)
    expect(summary.skippedCount).toBe(1)
    expect(summary.pendingCount).toBe(2)
  })

  it('adds money with cents helpers without floating error', () => {
    const summary = calculateProjectedMonthSummary('2026-10', [
      {
        scheduledPaymentId: 'a',
        name: 'A',
        frequency: 'monthly',
        amountType: 'fixed',
        dueDate: '2026-10-05',
        expectedAmount: 308.97,
        status: 'pending',
        occurrenceId: null,
        source: 'rule',
      },
      {
        scheduledPaymentId: 'b',
        name: 'B',
        frequency: 'monthly',
        amountType: 'fixed',
        dueDate: '2026-10-10',
        expectedAmount: 35,
        status: 'pending',
        occurrenceId: null,
        source: 'rule',
      },
      {
        scheduledPaymentId: 'c',
        name: 'C',
        frequency: 'monthly',
        amountType: 'fixed',
        dueDate: '2026-10-15',
        expectedAmount: 10,
        status: 'pending',
        occurrenceId: null,
        source: 'rule',
      },
    ])
    expect(summary.knownExpectedAmount).toBe(353.97)
  })

  it('excludes inactive and archived-category rules from forecast', () => {
    expect(
      getProjectedPaymentForPeriod(payment({ active: false }), activeCategory, '2026-10', null),
    ).toBeNull()
    expect(
      getProjectedPaymentForPeriod(
        payment(),
        { archivedAt: '2026-01-01T00:00:00Z' },
        '2026-10',
        occurrence(),
      ),
    ).toBeNull()
  })

  it('does not invent side effects while calculating a projection', () => {
    const payments = [payment()]
    const before = structuredClone(payments)
    calculateExpenseProjection({
      startPeriod: '2026-10',
      horizonMonths: 12,
      payments,
      categoriesById: categories,
      occurrencesInHorizon: [],
    })
    expect(payments).toEqual(before)
  })
})

describe('reminder compatibility with one_time due dates', () => {
  it('reuses civil reminderDate arithmetic for a one_time due date', () => {
    expect(calculateReminderDate('2027-06-15', 7)).toBe('2027-06-08')
  })
})
