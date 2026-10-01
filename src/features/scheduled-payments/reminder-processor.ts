import {
  REMINDER_MAX_ATTEMPTS,
  buildScheduledPaymentReminderEmail,
  calculateReminderDate,
  canClaimReminderDelivery,
  isReminderEligible,
  type ReminderDeliveryStatus,
  type ReminderEmailContent,
} from './reminders'

export type ReminderCandidate = {
  occurrenceId: string
  userId: string
  scheduledPaymentId: string
  paymentName: string
  dueDate: string
  expectedAmount: number | null
  amountLabel: string
  reminderEnabled: boolean
  reminderDaysBefore: number
  paymentActive: boolean
  categoryArchivedAt: string | null
  occurrenceStatus: 'pending' | 'paid' | 'skipped'
  delivery: {
    id: string
    status: ReminderDeliveryStatus
    attemptCount: number
  } | null
  ownerEmail: string | null
}

export type ClaimedReminder = {
  deliveryId: string
  occurrenceId: string
  reminderDate: string
  daysBeforeDue: number
  attemptCount: number
}

export type ReminderSendResult =
  | { ok: true }
  | { ok: false; error: string; retryable: boolean }

export type ReminderProcessorDeps = {
  today: string
  siteUrl: string | null
  claim: (input: {
    occurrenceId: string
    reminderDate: string
    daysBeforeDue: number
  }) => Promise<ClaimedReminder | null>
  send: (input: {
    to: string
    content: ReminderEmailContent
    candidate: ReminderCandidate
    claimed: ClaimedReminder
  }) => Promise<ReminderSendResult>
  complete: (input: {
    deliveryId: string
    status: 'sent' | 'failed'
    error: string | null
  }) => Promise<void>
  log?: (message: string, detail?: Record<string, unknown>) => void
}

export type ReminderProcessorResult = {
  considered: number
  claimed: number
  sent: number
  failed: number
  skipped: number
}

/**
 * Idempotent batch: eligibility → claim → send → complete.
 * A second concurrent claim for the same occurrence returns null from `claim`.
 */
export async function processScheduledPaymentReminders(
  candidates: readonly ReminderCandidate[],
  deps: ReminderProcessorDeps,
): Promise<ReminderProcessorResult> {
  const result: ReminderProcessorResult = {
    considered: candidates.length,
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  for (const candidate of candidates) {
    const eligible = isReminderEligible({
      payment: {
        active: candidate.paymentActive,
        reminderEnabled: candidate.reminderEnabled,
        reminderDaysBefore: candidate.reminderDaysBefore,
      },
      category: { archivedAt: candidate.categoryArchivedAt },
      occurrence: {
        status: candidate.occurrenceStatus,
        dueDate: candidate.dueDate,
      },
      delivery: candidate.delivery,
      today: deps.today,
    })

    if (!eligible) {
      result.skipped += 1
      continue
    }

    if (
      candidate.delivery !== null &&
      candidate.delivery.attemptCount >= REMINDER_MAX_ATTEMPTS
    ) {
      result.skipped += 1
      deps.log?.('reminder_max_attempts', {
        occurrenceId: candidate.occurrenceId,
        attemptCount: candidate.delivery.attemptCount,
      })
      continue
    }

    if (
      candidate.delivery !== null &&
      !canClaimReminderDelivery(candidate.delivery.status)
    ) {
      result.skipped += 1
      continue
    }

    const reminderDate = calculateReminderDate(
      candidate.dueDate,
      candidate.reminderDaysBefore,
    )

    let claimed: ClaimedReminder | null
    try {
      claimed = await deps.claim({
        occurrenceId: candidate.occurrenceId,
        reminderDate,
        daysBeforeDue: candidate.reminderDaysBefore,
      })
    } catch (err) {
      result.failed += 1
      deps.log?.('reminder_claim_error', {
        occurrenceId: candidate.occurrenceId,
        error: err instanceof Error ? err.message : 'claim failed',
      })
      continue
    }

    if (!claimed) {
      result.skipped += 1
      continue
    }

    result.claimed += 1

    if (!candidate.ownerEmail || !isPlausibleEmail(candidate.ownerEmail)) {
      await deps.complete({
        deliveryId: claimed.deliveryId,
        status: 'failed',
        error: 'owner_email_unavailable',
      })
      result.failed += 1
      deps.log?.('reminder_email_unavailable', {
        occurrenceId: candidate.occurrenceId,
        deliveryId: claimed.deliveryId,
      })
      continue
    }

    const content = buildScheduledPaymentReminderEmail({
      paymentName: candidate.paymentName,
      dueDate: candidate.dueDate,
      expectedAmount: candidate.expectedAmount,
      amountLabel: candidate.amountLabel,
      siteUrl: deps.siteUrl,
    })

    let sendResult: ReminderSendResult
    try {
      sendResult = await deps.send({
        to: candidate.ownerEmail,
        content,
        candidate,
        claimed,
      })
    } catch (err) {
      sendResult = {
        ok: false,
        error: err instanceof Error ? err.message : 'send failed',
        retryable: true,
      }
    }

    if (sendResult.ok) {
      await deps.complete({
        deliveryId: claimed.deliveryId,
        status: 'sent',
        error: null,
      })
      result.sent += 1
      deps.log?.('reminder_sent', {
        occurrenceId: candidate.occurrenceId,
        deliveryId: claimed.deliveryId,
        reminderDate,
      })
    } else {
      await deps.complete({
        deliveryId: claimed.deliveryId,
        status: 'failed',
        error: sendResult.error,
      })
      result.failed += 1
      deps.log?.('reminder_send_failed', {
        occurrenceId: candidate.occurrenceId,
        deliveryId: claimed.deliveryId,
        error: sendResult.error,
        retryable: sendResult.retryable,
      })
    }
  }

  return result
}

function isPlausibleEmail(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 3 && trimmed.includes('@') && !trimmed.includes(' ')
}
