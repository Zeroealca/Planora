import { fromCents, toCents } from '@/features/monthly-budget/money'
import { supabase } from '@/lib/supabase/client'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import { mapManagedFund, mapManagedFundMovement } from '@/lib/supabase/mappers'
import type { ManagedFund, ManagedFundMovement, ManagedFundMovementType } from './domain'

export type ManagedFundInput = { name: string; description: string | null }
export type ManagedFundMovementInput = {
  occurredOn: string
  amount: number
  type: ManagedFundMovementType
  description: string | null
}

function isDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return false
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day <= (month === 2 && leap ? 29 : days[month - 1]!)
}

export function validateManagedFundInput(input: ManagedFundInput): ManagedFundInput {
  const name = input.name.trim()
  if (!name) throw new Error('El nombre del fondo es obligatorio.')
  return { name, description: input.description?.trim() || null }
}

export function validateManagedFundMovementInput(input: ManagedFundMovementInput): ManagedFundMovementInput {
  if (!isDateOnly(input.occurredOn)) throw new Error('La fecha debe tener el formato YYYY-MM-DD.')
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('El importe debe ser mayor a cero.')
  if (input.type !== 'income' && input.type !== 'expense') throw new Error('El tipo de movimiento no es válido.')
  const description = input.description?.trim() || null
  if (input.type === 'expense' && !description) throw new Error('Describe el gasto realizado.')
  return { ...input, amount: fromCents(toCents(input.amount)), description }
}

export async function listManagedFunds(): Promise<ManagedFund[]> {
  const { data, error } = await supabase.from('managed_funds').select('*').order('archived_at', { ascending: true }).order('name')
  if (error) throw new Error(supabaseErrorMessage(error))
  return (data ?? []).map(mapManagedFund)
}

export async function createManagedFund(userId: string, input: ManagedFundInput): Promise<ManagedFund> {
  const valid = validateManagedFundInput(input)
  const { data, error } = await supabase.from('managed_funds').insert({ user_id: userId, ...valid }).select().single()
  if (error) throw new Error(supabaseErrorMessage(error))
  return mapManagedFund(data)
}

export async function updateManagedFund(fundId: string, input: ManagedFundInput): Promise<void> {
  const { error } = await supabase.from('managed_funds').update(validateManagedFundInput(input)).eq('id', fundId)
  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function archiveManagedFund(fundId: string): Promise<void> {
  const { error } = await supabase.from('managed_funds').update({ archived_at: new Date().toISOString() }).eq('id', fundId)
  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function listManagedFundMovements(fundId: string): Promise<ManagedFundMovement[]> {
  const { data, error } = await supabase.from('managed_fund_movements').select('*').eq('fund_id', fundId).order('occurred_on', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw new Error(supabaseErrorMessage(error))
  return (data ?? []).map(mapManagedFundMovement)
}

function movementPayload(input: ManagedFundMovementInput) {
  const valid = validateManagedFundMovementInput(input)
  return { occurred_on: valid.occurredOn, amount: valid.amount, movement_type: valid.type, description: valid.description }
}

export async function createManagedFundMovement(fundId: string, input: ManagedFundMovementInput): Promise<void> {
  const { error } = await supabase.from('managed_fund_movements').insert({ fund_id: fundId, ...movementPayload(input) })
  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function updateManagedFundMovement(movementId: string, input: ManagedFundMovementInput): Promise<void> {
  const { error } = await supabase.from('managed_fund_movements').update(movementPayload(input)).eq('id', movementId)
  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function deleteManagedFundMovement(movementId: string): Promise<void> {
  const { error } = await supabase.from('managed_fund_movements').delete().eq('id', movementId)
  if (error) throw new Error(supabaseErrorMessage(error))
}
