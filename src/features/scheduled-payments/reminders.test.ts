import { describe, expect, it } from 'vitest'
import {
  buildScheduledPaymentReminderEmail,
  calculateReminderDate,
  canClaimReminderDelivery,
  formatReminderSummary,
  isDueDateInReminderWindow,
  isReminderEligible,
  reminderDueDateWindow,
  validateReminderConfig,
} from './reminders'

describe('calculateReminderDate', () => {
  it('subtracts civil days across month and year boundaries', () => {
    expect(calculateReminderDate('2027-01-15', 7)).toBe('2027-01-08')
    expect(calculateReminderDate('2027-01-03', 7)).toBe('2026-12-27')
    expect(calculateReminderDate('2028-03-01', 1)).toBe('2028-02-29')
    expect(calculateReminderDate('2027-01-15', 0)).toBe('2027-01-15')
  })
})

describe('reminder eligibility', () => {
  const base = {
    payment: { active: true, reminderEnabled: true, reminderDaysBefore: 7 },
    category: { archivedAt: null as string | null },
    occurrence: { status: 'pending' as const, dueDate: '2027-01-15' },
    delivery: null as null | { status: 'pending' | 'processing' | 'sent' | 'failed'; attemptCount: number },
    today: '2027-01-08',
  }

  it('is eligible when pending, enabled, due, and not yet sent', () => {
    expect(isReminderEligible(base)).toBe(true)
  })

  it('rejects paid, skipped, disabled, inactive, archived, future, and already sent', () => {
    expect(isReminderEligible({ ...base, occurrence: { ...base.occurrence, status: 'paid' } })).toBe(false)
    expect(isReminderEligible({ ...base, occurrence: { ...base.occurrence, status: 'skipped' } })).toBe(false)
    expect(isReminderEligible({ ...base, payment: { ...base.payment, reminderEnabled: false } })).toBe(false)
    expect(isReminderEligible({ ...base, payment: { ...base.payment, active: false } })).toBe(false)
    expect(
      isReminderEligible({ ...base, category: { archivedAt: '2027-01-01T00:00:00Z' } }),
    ).toBe(false)
    expect(isReminderEligible({ ...base, category: null })).toBe(false)
    expect(isReminderEligible({ ...base, today: '2027-01-07' })).toBe(false)
    expect(
      isReminderEligible({ ...base, delivery: { status: 'sent', attemptCount: 1 } }),
    ).toBe(false)
  })

  it('uses the current reminder config when not yet sent', () => {
    expect(
      isReminderEligible({
        ...base,
        payment: { ...base.payment, reminderDaysBefore: 3 },
        today: '2027-01-12',
      }),
    ).toBe(true)
    expect(
      isReminderEligible({
        ...base,
        payment: { ...base.payment, reminderDaysBefore: 3 },
        today: '2027-01-11',
      }),
    ).toBe(false)
  })

  it('does not become eligible again after a sent delivery even if daysBefore changes', () => {
    expect(
      isReminderEligible({
        ...base,
        payment: { ...base.payment, reminderDaysBefore: 3 },
        delivery: { status: 'sent', attemptCount: 1 },
        today: '2027-01-12',
      }),
    ).toBe(false)
  })
})

describe('reminder window', () => {
  it('covers previous, current, and next civil months only', () => {
    expect(reminderDueDateWindow('2027-01-10')).toEqual({
      start: '2026-12-01',
      endExclusive: '2027-03-01',
    })
    expect(isDueDateInReminderWindow('2026-12-27', '2027-01-10')).toBe(true)
    expect(isDueDateInReminderWindow('2027-02-28', '2027-01-10')).toBe(true)
    expect(isDueDateInReminderWindow('2026-11-30', '2027-01-10')).toBe(false)
    expect(isDueDateInReminderWindow('2027-03-01', '2027-01-10')).toBe(false)
  })
})

describe('reminder config and claim helpers', () => {
  it('validates non-negative integer days and formats list copy', () => {
    expect(validateReminderConfig({ reminderEnabled: true, reminderDaysBefore: 0 })).toEqual({
      reminderEnabled: true,
      reminderDaysBefore: 0,
    })
    expect(() => validateReminderConfig({ reminderEnabled: true, reminderDaysBefore: -1 })).toThrow(
      /mayor o igual/i,
    )
    expect(formatReminderSummary({ reminderEnabled: false, reminderDaysBefore: 7 })).toBe(
      'Sin recordatorio',
    )
    expect(formatReminderSummary({ reminderEnabled: true, reminderDaysBefore: 7 })).toBe(
      'Recordatorio: 7 días antes',
    )
  })

  it('allows claiming missing, pending, failed, or stale processing deliveries only', () => {
    expect(canClaimReminderDelivery(null)).toBe(true)
    expect(canClaimReminderDelivery('pending')).toBe(true)
    expect(canClaimReminderDelivery('failed')).toBe(true)
    expect(canClaimReminderDelivery('sent')).toBe(false)
    expect(canClaimReminderDelivery('processing')).toBe(false)
    expect(canClaimReminderDelivery('processing', { processingIsStale: true })).toBe(true)
  })
})

describe('reminder email content', () => {
  it('builds the same shape for fixed and variable amounts', () => {
    const fixed = buildScheduledPaymentReminderEmail({
      paymentName: 'Hipoteca',
      dueDate: '2026-10-05',
      expectedAmount: 308.97,
      amountLabel: '$308.97',
      siteUrl: 'https://example.github.io/Planora/',
    })
    expect(fixed.subject).toContain('Hipoteca')
    expect(fixed.text).toContain('Importe esperado:')
    expect(fixed.text).toContain('$308.97')
    expect(fixed.text).toContain('https://example.github.io/Planora/')

    const variable = buildScheduledPaymentReminderEmail({
      paymentName: 'Impuesto predial',
      dueDate: '2027-01-15',
      expectedAmount: null,
      amountLabel: '',
      siteUrl: null,
    })
    expect(variable.subject).toContain('Impuesto predial')
    expect(variable.text).toContain('Por registrar')
    expect(variable.text).not.toContain('Abrir Planora')
  })
})
