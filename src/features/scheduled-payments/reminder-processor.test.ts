import { describe, expect, it, vi } from 'vitest'
import {
  processScheduledPaymentReminders,
  type ReminderCandidate,
} from './reminder-processor'

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    occurrenceId: 'occ-1',
    userId: 'user',
    scheduledPaymentId: 'pay-1',
    paymentName: 'Hipoteca',
    dueDate: '2027-01-15',
    expectedAmount: 308.97,
    amountLabel: '$308.97',
    reminderEnabled: true,
    reminderDaysBefore: 7,
    paymentActive: true,
    categoryArchivedAt: null,
    occurrenceStatus: 'pending',
    delivery: null,
    ownerEmail: 'owner@example.com',
    ...overrides,
  }
}

describe('processScheduledPaymentReminders', () => {
  it('sends once across two job runs for the same occurrence', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true })
    const complete = vi.fn().mockResolvedValue(undefined)
    let delivery: ReminderCandidate['delivery'] = null

    const claim = vi.fn(async () => {
      if (delivery?.status === 'sent' || delivery?.status === 'processing') return null
      delivery = { id: 'del-1', status: 'processing', attemptCount: 1 }
      return {
        deliveryId: 'del-1',
        occurrenceId: 'occ-1',
        reminderDate: '2027-01-08',
        daysBeforeDue: 7,
        attemptCount: 1,
      }
    })

    const deps = {
      today: '2027-01-08',
      siteUrl: null,
      claim,
      send,
      complete: async (input: { deliveryId: string; status: 'sent' | 'failed'; error: string | null }) => {
        delivery = {
          id: input.deliveryId,
          status: input.status,
          attemptCount: delivery?.attemptCount ?? 1,
        }
        await complete(input)
      },
    }

    const first = await processScheduledPaymentReminders([candidate()], deps)
    expect(first.sent).toBe(1)
    expect(send).toHaveBeenCalledTimes(1)

    const second = await processScheduledPaymentReminders(
      [candidate({ delivery })],
      deps,
    )
    expect(second.sent).toBe(0)
    expect(second.skipped).toBe(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('allows only one concurrent claim to proceed', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true })
    const complete = vi.fn().mockResolvedValue(undefined)
    let claimed = false

    const claim = vi.fn(async () => {
      if (claimed) return null
      claimed = true
      return {
        deliveryId: 'del-1',
        occurrenceId: 'occ-1',
        reminderDate: '2027-01-08',
        daysBeforeDue: 7,
        attemptCount: 1,
      }
    })

    const deps = { today: '2027-01-08', siteUrl: null, claim, send, complete }
    const [a, b] = await Promise.all([
      processScheduledPaymentReminders([candidate()], deps),
      processScheduledPaymentReminders([candidate()], deps),
    ])

    expect(a.sent + b.sent).toBe(1)
    expect(a.skipped + b.skipped).toBe(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('records failed sends without marking sent and retries later', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'provider_down', retryable: true })
      .mockResolvedValueOnce({ ok: true })
    const complete = vi.fn().mockResolvedValue(undefined)
    let delivery: ReminderCandidate['delivery'] = null

    const claim = vi.fn(async () => {
      const attemptCount = (delivery?.attemptCount ?? 0) + 1
      delivery = { id: 'del-1', status: 'processing', attemptCount }
      return {
        deliveryId: 'del-1',
        occurrenceId: 'occ-1',
        reminderDate: '2027-01-08',
        daysBeforeDue: 7,
        attemptCount,
      }
    })

    const deps = {
      today: '2027-01-08',
      siteUrl: null,
      claim,
      send,
      complete: async (input: { deliveryId: string; status: 'sent' | 'failed'; error: string | null }) => {
        delivery = {
          id: input.deliveryId,
          status: input.status,
          attemptCount: delivery?.attemptCount ?? 1,
        }
        await complete(input)
      },
    }

    const failed = await processScheduledPaymentReminders([candidate()], deps)
    expect(failed.failed).toBe(1)
    expect(failed.sent).toBe(0)
    expect(complete).toHaveBeenLastCalledWith({
      deliveryId: 'del-1',
      status: 'failed',
      error: 'provider_down',
    })

    const retried = await processScheduledPaymentReminders(
      [candidate({ delivery })],
      deps,
    )
    expect(retried.sent).toBe(1)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('isolates one failure from other reminders in the same batch', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'boom', retryable: true })
      .mockResolvedValueOnce({ ok: true })
    const complete = vi.fn().mockResolvedValue(undefined)
    const claim = vi.fn(async (input: { occurrenceId: string }) => ({
      deliveryId: `del-${input.occurrenceId}`,
      occurrenceId: input.occurrenceId,
      reminderDate: '2027-01-08',
      daysBeforeDue: 7,
      attemptCount: 1,
    }))

    const result = await processScheduledPaymentReminders(
      [
        candidate({ occurrenceId: 'occ-bad', paymentName: 'Bad' }),
        candidate({ occurrenceId: 'occ-good', paymentName: 'Good' }),
      ],
      { today: '2027-01-08', siteUrl: null, claim, send, complete },
    )

    expect(result.failed).toBe(1)
    expect(result.sent).toBe(1)
  })

  it('fails without sending when the owner email is unavailable', async () => {
    const send = vi.fn()
    const complete = vi.fn().mockResolvedValue(undefined)
    const claim = vi.fn(async () => ({
      deliveryId: 'del-1',
      occurrenceId: 'occ-1',
      reminderDate: '2027-01-08',
      daysBeforeDue: 7,
      attemptCount: 1,
    }))

    const result = await processScheduledPaymentReminders(
      [candidate({ ownerEmail: null })],
      { today: '2027-01-08', siteUrl: null, claim, send, complete },
    )

    expect(result.failed).toBe(1)
    expect(send).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledWith({
      deliveryId: 'del-1',
      status: 'failed',
      error: 'owner_email_unavailable',
    })
  })
})
