import { supabase } from '@/lib/supabase/client'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import { mapFinancialTransaction, mapScheduledPayment, mapScheduledPaymentOccurrence } from '@/lib/supabase/mappers'
import type { MonthlyPeriod } from '@/features/monthly-budget/domain'
import { monthlyPeriodBounds } from '@/features/monthly-budget/period'
import type { FinancialTransaction } from '@/features/transactions/domain'
import type { ScheduledPayment, ScheduledPaymentInput, ScheduledPaymentOccurrence } from './domain'
import { validateOccurrencePayment, validateScheduledPayment } from './domain'

function toDatabaseInput(input: ScheduledPaymentInput) {
  const valid = validateScheduledPayment(input)
  return {
    name: valid.name,
    financial_category_id: valid.financialCategoryId,
    frequency: valid.frequency,
    amount_type: valid.amountType,
    expected_amount: valid.expectedAmount,
    start_date: valid.startDate,
    end_date: valid.endDate,
    active: valid.active,
  }
}

export async function listScheduledPayments(): Promise<ScheduledPayment[]> {
  const { data, error } = await supabase.from('scheduled_payments').select('*').order('name')
  if (error) throw new Error(supabaseErrorMessage(error))
  return (data ?? []).map(mapScheduledPayment)
}

export async function createScheduledPayment(input: ScheduledPaymentInput): Promise<ScheduledPayment> {
  const { data, error } = await supabase
    .from('scheduled_payments')
    .insert({ user_id: input.userId, ...toDatabaseInput(input) })
    .select()
    .single()
  if (error) throw new Error(supabaseErrorMessage(error))
  return mapScheduledPayment(data)
}

export async function updateScheduledPayment(id: string, input: ScheduledPaymentInput): Promise<void> {
  const { error } = await supabase.from('scheduled_payments').update(toDatabaseInput(input)).eq('id', id)
  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function listScheduledPaymentOccurrences(
  scheduledPaymentId: string,
): Promise<ScheduledPaymentOccurrence[]> {
  const { data, error } = await supabase
    .from('scheduled_payment_occurrences')
    .select('*')
    .eq('scheduled_payment_id', scheduledPaymentId)
    .order('due_date')
  if (error) throw new Error(supabaseErrorMessage(error))
  return (data ?? []).map(mapScheduledPaymentOccurrence)
}

export async function listScheduledPaymentOccurrencesForPeriod(
  period: MonthlyPeriod,
): Promise<ScheduledPaymentOccurrence[]> {
  const bounds = monthlyPeriodBounds(period)
  const { data, error } = await supabase
    .from('scheduled_payment_occurrences')
    .select('*')
    .gte('due_date', bounds.start)
    .lt('due_date', bounds.endExclusive)
    .order('due_date')
  if (error) throw new Error(supabaseErrorMessage(error))
  return (data ?? []).map(mapScheduledPaymentOccurrence)
}

/**
 * The RPC is the only materialization entry point. It derives the date and
 * snapshot on the database side and has a unique constraint as a second guard.
 */
export async function materializeScheduledPaymentOccurrence(
  scheduledPaymentId: string,
  period: MonthlyPeriod,
): Promise<ScheduledPaymentOccurrence | null> {
  const { data, error } = await supabase.rpc('materialize_scheduled_payment_occurrence', {
    p_scheduled_payment_id: scheduledPaymentId,
    p_period: period,
  })
  if (error) throw new Error(supabaseErrorMessage(error))
  return data ? mapScheduledPaymentOccurrence(data) : null
}

export async function materializeScheduledPaymentsForPeriod(
  period: MonthlyPeriod,
): Promise<void> {
  const payments = await listScheduledPayments()
  await Promise.all(payments.map((payment) => materializeScheduledPaymentOccurrence(payment.id, period)))
}

export async function markScheduledPaymentOccurrencePaid(input: {
  occurrence: ScheduledPaymentOccurrence
  amount: number | null
  occurredOn: string
  notes: string | null
}): Promise<FinancialTransaction> {
  const payment = validateOccurrencePayment(input.occurrence, input.amount, input.occurredOn)
  const { data, error } = await supabase.rpc('mark_scheduled_payment_occurrence_paid', {
    p_occurrence_id: input.occurrence.id,
    p_amount: payment.amount,
    p_occurred_on: payment.occurredOn,
    p_notes: input.notes,
  })
  if (error) throw new Error(supabaseErrorMessage(error))
  return mapFinancialTransaction(data)
}

export async function skipScheduledPaymentOccurrence(occurrence: ScheduledPaymentOccurrence): Promise<void> {
  if (occurrence.status !== 'pending') throw new Error('Solo se puede omitir una occurrence pendiente.')
  const { error } = await supabase.rpc('skip_scheduled_payment_occurrence', { p_occurrence_id: occurrence.id })
  if (error) throw new Error(supabaseErrorMessage(error))
}
