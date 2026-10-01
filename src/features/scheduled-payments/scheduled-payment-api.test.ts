import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ supabase: { from, rpc } }))

import {
  createScheduledPayment,
  deleteScheduledPayment,
  markScheduledPaymentOccurrencePaid,
  materializeScheduledPaymentOccurrence,
  skipScheduledPaymentOccurrence,
} from './scheduled-payment-api'

function query(result: { data: unknown; error: null }) {
  const inserts: unknown[] = []
  const builder = {
    insert: (payload: unknown) => { inserts.push(payload); return builder },
    select: () => builder,
    single: async () => result,
    inserts,
  }
  return builder
}

const paymentRow = {
  id: 'payment', user_id: 'user', name: 'Mortgage', financial_category_id: 'housing',
  frequency: 'monthly', amount_type: 'fixed', expected_amount: '308.97',
  start_date: '2027-01-05', end_date: null, active: true,
  reminder_enabled: false, reminder_days_before: 7,
  created_at: '', updated_at: '',
}
const occurrenceRow = {
  id: 'occurrence', user_id: 'user', scheduled_payment_id: 'payment', due_date: '2027-10-05',
  expected_amount: '308.97', status: 'pending', transaction_id: null, created_at: '', updated_at: '',
}
const transactionRow = { id: 'transaction', user_id: 'user', name: 'Mortgage', occurred_on: '2027-10-03', amount: '310.00', transaction_type: 'expense', financial_category_id: 'housing', notes: null, created_at: '', updated_at: '' }

beforeEach(() => vi.clearAllMocks())

describe('scheduled payment persistence boundary', () => {
  it('normalizes a rule amount and delegates idempotent materialization to the RPC', async () => {
    const create = query({ data: paymentRow, error: null })
    from.mockReturnValueOnce(create)
    rpc.mockResolvedValueOnce({ data: occurrenceRow, error: null })

    await expect(createScheduledPayment({
      userId: 'user', name: ' Mortgage ', financialCategoryId: 'housing', frequency: 'monthly',
      amountType: 'fixed', expectedAmount: 0.1 + 0.2, startDate: '2027-01-05', endDate: null, active: true,
      reminderEnabled: false, reminderDaysBefore: 7,
    })).resolves.toMatchObject({ expectedAmount: 308.97 })
    await expect(materializeScheduledPaymentOccurrence('payment', '2027-10')).resolves.toMatchObject({
      dueDate: '2027-10-05', status: 'pending', expectedAmount: 308.97,
    })

    expect(create.inserts).toEqual([{
      user_id: 'user', name: 'Mortgage', financial_category_id: 'housing', frequency: 'monthly',
      amount_type: 'fixed', expected_amount: 0.3, start_date: '2027-01-05', end_date: null, active: true,
      reminder_enabled: false, reminder_days_before: 7,
    }])
    expect(rpc).toHaveBeenCalledWith('materialize_scheduled_payment_occurrence', {
      p_scheduled_payment_id: 'payment', p_period: '2027-10',
    })
  })

  it('uses controlled RPC transitions for paying and skipping pending occurrences', async () => {
    rpc.mockResolvedValueOnce({ data: transactionRow, error: null }).mockResolvedValueOnce({ data: null, error: null })
    const occurrence = { id: 'occurrence', userId: 'user', scheduledPaymentId: 'payment', dueDate: '2027-10-05', expectedAmount: 308.97, status: 'pending' as const, transactionId: null, createdAt: '', updatedAt: '' }
    await expect(markScheduledPaymentOccurrencePaid({ occurrence, amount: 310, occurredOn: '2027-10-03', notes: null })).resolves.toMatchObject({ amount: 310, occurredOn: '2027-10-03' })
    await skipScheduledPaymentOccurrence(occurrence)
    expect(rpc).toHaveBeenNthCalledWith(1, 'mark_scheduled_payment_occurrence_paid', { p_occurrence_id: 'occurrence', p_amount: 310, p_occurred_on: '2027-10-03', p_notes: null })
    expect(rpc).toHaveBeenNthCalledWith(2, 'skip_scheduled_payment_occurrence', { p_occurrence_id: 'occurrence' })
  })

  it('deletes a scheduled payment through the ownership-checked RPC', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await deleteScheduledPayment('payment')
    expect(rpc).toHaveBeenCalledWith('delete_scheduled_payment', {
      p_scheduled_payment_id: 'payment',
    })
  })
})
