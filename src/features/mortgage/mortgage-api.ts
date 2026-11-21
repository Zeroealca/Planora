import { supabase } from '@/lib/supabase/client'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import type { CompoundingFrequency, ExtraPayment, ExtraPaymentFrequency, InterestRateType, RepaymentStrategy } from './mortgage-domain'

export type Mortgage = {
  id: string; userId: string; name: string; propertyPrice: number; downPayment: number; requestedCredit: number; termMonths: number; annualRate: number; rateType: InterestRateType; compoundingFrequency: CompoundingFrequency; startDate: string; monthlyInsurance: number; monthlyFees: number; initialCosts: number; createdAt: string; updatedAt: string
}
export type MortgageScenario = { id: string; mortgageId: string; name: string; strategy: RepaymentStrategy; periodicExtra: { amount: number; frequency: ExtraPaymentFrequency; startMonth: number } | null; oneTimeExtras: ExtraPayment[]; createdAt: string; updatedAt: string }

function rateType(value: string): InterestRateType { return value === 'effective' ? 'effective' : 'nominal' }
function frequency(value: string): CompoundingFrequency { return value === 'quarterly' || value === 'semiannual' || value === 'annual' ? value : 'monthly' }
function scenarioFrequency(value: string): ExtraPaymentFrequency { return frequency(value) }
function parseExtras(value: unknown): ExtraPayment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => typeof item === 'object' && item !== null && typeof item.month === 'number' && typeof item.amount === 'number' ? [{ month: item.month, amount: item.amount }] : [])
}
function mapMortgage(row: import('@/types/database').Database['public']['Tables']['mortgages']['Row']): Mortgage {
  return { id: row.id, userId: row.user_id, name: row.name, propertyPrice: row.property_price, downPayment: row.down_payment, requestedCredit: row.requested_credit, termMonths: row.term_months, annualRate: row.annual_rate, rateType: rateType(row.rate_type), compoundingFrequency: frequency(row.compounding_frequency), startDate: row.start_date, monthlyInsurance: row.monthly_insurance, monthlyFees: row.monthly_fees, initialCosts: row.initial_costs, createdAt: row.created_at, updatedAt: row.updated_at }
}
function mapScenario(row: import('@/types/database').Database['public']['Tables']['mortgage_scenarios']['Row']): MortgageScenario {
  return { id: row.id, mortgageId: row.mortgage_id, name: row.name, strategy: row.repayment_strategy === 'reduce_payment' ? 'reduce_payment' : 'reduce_term', periodicExtra: row.periodic_extra_amount == null ? null : { amount: row.periodic_extra_amount, frequency: scenarioFrequency(row.periodic_extra_frequency), startMonth: row.periodic_extra_start_month }, oneTimeExtras: parseExtras(row.one_time_extras), createdAt: row.created_at, updatedAt: row.updated_at }
}
export type MortgageInput = Omit<Mortgage, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
export type MortgageScenarioInput = Omit<MortgageScenario, 'id' | 'mortgageId' | 'createdAt' | 'updatedAt'>

function validMortgage(input: MortgageInput): MortgageInput {
  if (!input.name.trim()) throw new Error('El nombre de la vivienda es obligatorio.')
  if (input.propertyPrice <= 0 || input.termMonths <= 0 || input.requestedCredit < 0 || input.annualRate < 0) throw new Error('Revisa los importes, plazo y tasa de interés.')
  return { ...input, name: input.name.trim() }
}
export async function listMortgages(): Promise<Mortgage[]> { const { data, error } = await supabase.from('mortgages').select('*').order('updated_at', { ascending: false }); if (error) throw new Error(supabaseErrorMessage(error)); return (data ?? []).map(mapMortgage) }
export async function saveMortgage(userId: string, input: MortgageInput, id?: string): Promise<Mortgage> {
  const value = validMortgage(input); const payload = { name: value.name, property_price: value.propertyPrice, down_payment: value.downPayment, requested_credit: value.requestedCredit, term_years: Math.ceil(value.termMonths / 12), term_months: Math.round(value.termMonths), annual_rate: value.annualRate, rate_type: value.rateType, compounding_frequency: value.compoundingFrequency, start_date: value.startDate, monthly_insurance: value.monthlyInsurance, monthly_fees: value.monthlyFees, initial_costs: value.initialCosts }
  const query = id ? supabase.from('mortgages').update(payload).eq('id', id) : supabase.from('mortgages').insert({ user_id: userId, ...payload })
  const { data, error } = await query.select().single(); if (error) throw new Error(supabaseErrorMessage(error)); return mapMortgage(data)
}
export async function deleteMortgage(id: string): Promise<void> { const { error } = await supabase.from('mortgages').delete().eq('id', id); if (error) throw new Error(supabaseErrorMessage(error)) }
export async function listMortgageScenarios(mortgageId: string): Promise<MortgageScenario[]> { const { data, error } = await supabase.from('mortgage_scenarios').select('*').eq('mortgage_id', mortgageId).order('created_at'); if (error) throw new Error(supabaseErrorMessage(error)); return (data ?? []).map(mapScenario) }
export async function saveMortgageScenario(mortgageId: string, input: MortgageScenarioInput, id?: string): Promise<MortgageScenario> {
  if (!input.name.trim()) throw new Error('El nombre del escenario es obligatorio.')
  const periodic = input.periodicExtra; const payload = { name: input.name.trim(), repayment_strategy: input.strategy, periodic_extra_amount: periodic?.amount ?? null, periodic_extra_frequency: periodic?.frequency ?? 'annual', periodic_extra_start_month: periodic?.startMonth ?? 1, one_time_extras: input.oneTimeExtras }
  const query = id ? supabase.from('mortgage_scenarios').update(payload).eq('id', id) : supabase.from('mortgage_scenarios').insert({ mortgage_id: mortgageId, ...payload })
  const { data, error } = await query.select().single(); if (error) throw new Error(supabaseErrorMessage(error)); return mapScenario(data)
}
export async function deleteMortgageScenario(id: string): Promise<void> { const { error } = await supabase.from('mortgage_scenarios').delete().eq('id', id); if (error) throw new Error(supabaseErrorMessage(error)) }
