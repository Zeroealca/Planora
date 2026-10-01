import { supabase } from '@/lib/supabase/client'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import { mapFinancialTransaction } from '@/lib/supabase/mappers'
import { fromCents, toCents } from '@/features/monthly-budget/money'
import type { FinancialTransaction, TransactionType } from './domain'

export type TransactionInput = {
  name: string
  occurredOn: string
  amount: number
  type: TransactionType
  financialCategoryId: string | null
  notes: string | null
}

export type TransactionFilters = {
  fromDate?: string
  toDateExclusive?: string
  financialCategoryId?: string
  type?: TransactionType
}

function isDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return false
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const maximumDay = month === 2 && leapYear ? 29 : monthDays[month - 1]!
  return day <= maximumDay
}

export function validateTransactionInput(input: TransactionInput): TransactionInput {
  const name = input.name.trim()
  if (name === '') throw new Error('El nombre de la transacción es obligatorio.')
  if (!isDateOnly(input.occurredOn)) throw new Error('La fecha debe tener el formato YYYY-MM-DD.')
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('El monto debe ser mayor a cero.')
  }
  if (input.type !== 'expense' && input.type !== 'income') {
    throw new Error('El tipo de transacción no es válido.')
  }
  if (input.type === 'expense' && !input.financialCategoryId) {
    throw new Error('Un gasto requiere una categoría financiera.')
  }

  return {
    ...input,
    name,
    amount: fromCents(toCents(input.amount)),
  }
}

function toDatabaseInput(input: TransactionInput) {
  const valid = validateTransactionInput(input)
  return {
    name: valid.name,
    occurred_on: valid.occurredOn,
    amount: valid.amount,
    transaction_type: valid.type,
    financial_category_id: valid.financialCategoryId,
    notes: valid.notes,
  }
}

export async function listTransactions(
  filters: TransactionFilters = {},
): Promise<FinancialTransaction[]> {
  let query = supabase.from('transactions').select('*').order('occurred_on', { ascending: false })
  if (filters.fromDate) query = query.gte('occurred_on', filters.fromDate)
  if (filters.toDateExclusive) query = query.lt('occurred_on', filters.toDateExclusive)
  if (filters.financialCategoryId) {
    query = query.eq('financial_category_id', filters.financialCategoryId)
  }
  if (filters.type) query = query.eq('transaction_type', filters.type)

  const { data, error } = await query
  if (error) throw new Error(supabaseErrorMessage(error))
  return (data ?? []).map(mapFinancialTransaction)
}

export async function fetchTransaction(transactionId: string): Promise<FinancialTransaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .maybeSingle()

  if (error) throw new Error(supabaseErrorMessage(error))
  return data ? mapFinancialTransaction(data) : null
}

export async function createTransaction(
  userId: string,
  input: TransactionInput,
): Promise<FinancialTransaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({ user_id: userId, ...toDatabaseInput(input) })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  return mapFinancialTransaction(data)
}

export async function updateTransaction(
  transactionId: string,
  input: TransactionInput,
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update(toDatabaseInput(input))
    .eq('id', transactionId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_transaction_consistently', {
    p_transaction_id: transactionId,
  })
  if (error) throw new Error(supabaseErrorMessage(error))
}
