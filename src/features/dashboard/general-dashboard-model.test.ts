import { describe, expect, it } from 'vitest'
import {
  calculateGoalAccumulatedBalance,
  calculateGoalProgressPercent,
  calculateGoalRemaining,
  categoryComparisonScale,
  firstNameFromDisplay,
  greetingForHour,
  isPaymentOverdue,
  monthlyFinancialContext,
  relativeBarPercent,
  selectUpcomingPendingPayments,
} from './general-dashboard-model'
import type { ProjectedPaymentLine } from '@/features/scheduled-payments/forecast'

function payment(overrides: Partial<ProjectedPaymentLine> = {}): ProjectedPaymentLine {
  return {
    scheduledPaymentId: 'pay',
    name: 'Renta',
    frequency: 'monthly',
    amountType: 'fixed',
    dueDate: '2026-10-05',
    expectedAmount: 300,
    status: 'pending',
    occurrenceId: 'occ',
    source: 'occurrence',
    ...overrides,
  }
}

describe('general dashboard model', () => {
  it('accumulates goal balance from initial amount and movements only', () => {
    expect(
      calculateGoalAccumulatedBalance({
        initialBalance: 100,
        movements: [
          { amount: 50, movement_type: 'inflow' },
          { amount: 20, movement_type: 'outflow' },
        ],
      }),
    ).toBe(130)
  })

  it('treats a null initial balance as zero and ignores non-finite amounts', () => {
    expect(
      calculateGoalAccumulatedBalance({
        initialBalance: null,
        movements: [
          { amount: 40, movement_type: 'inflow' },
          { amount: Number.NaN, movement_type: 'outflow' },
        ],
      }),
    ).toBe(40)
  })

  it('computes remaining and progress against a positive target', () => {
    expect(calculateGoalRemaining(200, 75)).toBe(125)
    expect(calculateGoalProgressPercent(200, 50)).toBe(25)
    expect(calculateGoalRemaining(null, 75)).toBeNull()
    expect(calculateGoalProgressPercent(0, 75)).toBe(0)
    expect(calculateGoalProgressPercent(100, 150)).toBe(100)
  })

  it('keeps only pending payments and never surfaces paid or skipped ones', () => {
    const selected = selectUpcomingPendingPayments(
      [
        payment({ scheduledPaymentId: 'a', status: 'paid', dueDate: '2026-10-01' }),
        payment({ scheduledPaymentId: 'b', status: 'pending', dueDate: '2026-10-03', expectedAmount: null }),
        payment({ scheduledPaymentId: 'c', status: 'skipped', dueDate: '2026-10-04' }),
        payment({ scheduledPaymentId: 'd', status: 'pending', dueDate: '2026-10-08' }),
        payment({ scheduledPaymentId: 'e', status: 'pending', dueDate: '2026-10-12' }),
      ],
      2,
    )
    expect(selected.map((line) => line.scheduledPaymentId)).toEqual(['b', 'd'])
    expect(selected[0]?.expectedAmount).toBeNull()
  })

  it('marks overdue only when the civil due date is before today', () => {
    expect(isPaymentOverdue('2026-10-09', '2026-10-10')).toBe(true)
    expect(isPaymentOverdue('2026-10-10', '2026-10-10')).toBe(false)
  })

  it('builds a contextual monthly summary without inventing a budget', () => {
    expect(monthlyFinancialContext(null, (value) => `$${value}`)).toMatch(/presupuesto mensual/)
    expect(monthlyFinancialContext({ actualRemaining: 120 }, (value) => `$${value}`)).toContain('$120')
    expect(monthlyFinancialContext({ actualRemaining: -40 }, (value) => `$${value}`)).toContain('$40')
  })

  it('scales category bars so absolute amounts remain comparable', () => {
    expect(categoryComparisonScale([{ budget: 100, spent: 40 }, { budget: 50, spent: 80 }])).toBe(100)
    expect(relativeBarPercent(40, 100)).toBe(40)
    expect(relativeBarPercent(0, 100)).toBe(0)
    expect(relativeBarPercent(20, 0)).toBe(0)
  })

  it('derives greeting and first name for the hero', () => {
    expect(greetingForHour(8)).toBe('Buenos días')
    expect(greetingForHour(15)).toBe('Buenas tardes')
    expect(greetingForHour(21)).toBe('Buenas noches')
    expect(firstNameFromDisplay('Elena Alcivar', 'e@example.com')).toBe('Elena')
    expect(firstNameFromDisplay(null, 'planora.user@example.com')).toBe('planora.user')
    expect(firstNameFromDisplay(null, null)).toBeNull()
  })
})
