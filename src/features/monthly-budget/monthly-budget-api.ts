import { supabase } from '@/lib/supabase/client'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import {
  mapFinancialCategory,
  mapMonthlyBudget,
  mapMonthlyBudgetAllocation,
  mapBudgetTemplate,
  mapBudgetTemplateAllocation,
} from '@/lib/supabase/mappers'
import type {
  FinancialCategory,
  MonthlyPeriod,
  PersistedMonthlyBudget,
  PersistedMonthlyBudgetAllocation,
  BudgetTemplate,
  BudgetTemplateAllocation,
} from './domain'
import { fromCents, toCents } from './money'
import { isMonthlyPeriod } from './period'

function normalizedName(name: string): string {
  const normalized = name.trim()
  if (normalized === '') throw new Error('El nombre de la categoría es obligatorio.')
  return normalized
}

export function normalizedMonthlyAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('El monto debe ser un número mayor o igual a cero.')
  }
  return fromCents(toCents(amount))
}

export function validatedMonthlyPeriod(period: string): MonthlyPeriod {
  if (!isMonthlyPeriod(period)) throw new Error('El periodo debe tener el formato YYYY-MM.')
  return period
}

export async function listFinancialCategories(
  includeArchived = false,
): Promise<FinancialCategory[]> {
  let query = supabase.from('financial_categories').select('*').order('name')
  if (!includeArchived) query = query.is('archived_at', null)

  const { data, error } = await query
  if (error) throw new Error(supabaseErrorMessage(error))
  return (data ?? []).map(mapFinancialCategory)
}

export async function createFinancialCategory(
  userId: string,
  name: string,
): Promise<FinancialCategory> {
  const { data, error } = await supabase
    .from('financial_categories')
    .insert({ user_id: userId, name: normalizedName(name) })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  return mapFinancialCategory(data)
}

export async function renameFinancialCategory(categoryId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('financial_categories')
    .update({ name: normalizedName(name) })
    .eq('id', categoryId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function archiveFinancialCategory(categoryId: string): Promise<void> {
  const { error } = await supabase
    .from('financial_categories')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', categoryId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function fetchMonthlyBudgetByPeriod(
  period: string,
): Promise<PersistedMonthlyBudget | null> {
  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('*')
    .eq('period', validatedMonthlyPeriod(period))
    .maybeSingle()

  if (error) throw new Error(supabaseErrorMessage(error))
  return data ? mapMonthlyBudget(data) : null
}

export async function createMonthlyBudget(input: {
  userId: string
  period: string
  availableAmount: number
}): Promise<PersistedMonthlyBudget> {
  const { data, error } = await supabase
    .from('monthly_budgets')
    .insert({
      user_id: input.userId,
      period: validatedMonthlyPeriod(input.period),
      available_amount: normalizedMonthlyAmount(input.availableAmount),
    })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  return mapMonthlyBudget(data)
}

export async function updateMonthlyBudgetAvailableAmount(
  budgetId: string,
  availableAmount: number,
): Promise<void> {
  const { error } = await supabase
    .from('monthly_budgets')
    .update({ available_amount: normalizedMonthlyAmount(availableAmount) })
    .eq('id', budgetId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function listMonthlyBudgetAllocations(
  monthlyBudgetId: string,
): Promise<PersistedMonthlyBudgetAllocation[]> {
  const { data, error } = await supabase
    .from('monthly_budget_allocations')
    .select('*')
    .eq('monthly_budget_id', monthlyBudgetId)
    .order('created_at')

  if (error) throw new Error(supabaseErrorMessage(error))
  return (data ?? []).map(mapMonthlyBudgetAllocation)
}

export async function createMonthlyBudgetAllocation(input: {
  monthlyBudgetId: string
  financialCategoryId: string
  amount: number
}): Promise<PersistedMonthlyBudgetAllocation> {
  const { data, error } = await supabase
    .from('monthly_budget_allocations')
    .insert({
      monthly_budget_id: input.monthlyBudgetId,
      financial_category_id: input.financialCategoryId,
      amount: normalizedMonthlyAmount(input.amount),
    })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  return mapMonthlyBudgetAllocation(data)
}

export async function updateMonthlyBudgetAllocationAmount(
  allocationId: string,
  amount: number,
): Promise<void> {
  const { error } = await supabase
    .from('monthly_budget_allocations')
    .update({ amount: normalizedMonthlyAmount(amount) })
    .eq('id', allocationId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function deleteMonthlyBudgetAllocation(allocationId: string): Promise<void> {
  const { error } = await supabase
    .from('monthly_budget_allocations')
    .delete()
    .eq('id', allocationId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function listMonthlyBudgets(): Promise<PersistedMonthlyBudget[]> { const { data, error } = await supabase.from('monthly_budgets').select('*').order('period', { ascending: false }); if (error) throw new Error(supabaseErrorMessage(error)); return (data ?? []).map(mapMonthlyBudget) }
export async function listBudgetTemplates(): Promise<BudgetTemplate[]> { const { data, error } = await supabase.from('budget_templates').select('*').order('name'); if (error) throw new Error(supabaseErrorMessage(error)); return (data ?? []).map(mapBudgetTemplate) }
export async function listBudgetTemplateAllocations(templateId: string): Promise<BudgetTemplateAllocation[]> { const { data, error } = await supabase.from('budget_template_allocations').select('*').eq('budget_template_id', templateId).order('created_at'); if (error) throw new Error(supabaseErrorMessage(error)); return (data ?? []).map(mapBudgetTemplateAllocation) }
export async function createBudgetTemplate(input: { userId: string; name: string; suggestedAvailableAmount: number | null }): Promise<BudgetTemplate> { const { data, error } = await supabase.from('budget_templates').insert({ user_id: input.userId, name: normalizedName(input.name), suggested_available_amount: input.suggestedAvailableAmount == null ? null : normalizedMonthlyAmount(input.suggestedAvailableAmount) }).select().single(); if (error) throw new Error(supabaseErrorMessage(error)); return mapBudgetTemplate(data) }
export async function updateBudgetTemplate(id: string, input: { name: string; suggestedAvailableAmount: number | null }): Promise<void> { const { error } = await supabase.from('budget_templates').update({ name: normalizedName(input.name), suggested_available_amount: input.suggestedAvailableAmount == null ? null : normalizedMonthlyAmount(input.suggestedAvailableAmount) }).eq('id', id); if (error) throw new Error(supabaseErrorMessage(error)) }
export async function deleteBudgetTemplate(id: string): Promise<void> { const { error } = await supabase.from('budget_templates').delete().eq('id', id); if (error) throw new Error(supabaseErrorMessage(error)) }
export async function createBudgetTemplateAllocation(input: { budgetTemplateId: string; financialCategoryId: string; amount: number }): Promise<BudgetTemplateAllocation> { const { data, error } = await supabase.from('budget_template_allocations').insert({ budget_template_id: input.budgetTemplateId, financial_category_id: input.financialCategoryId, amount: normalizedMonthlyAmount(input.amount) }).select().single(); if (error) throw new Error(supabaseErrorMessage(error)); return mapBudgetTemplateAllocation(data) }
export async function updateBudgetTemplateAllocation(id: string, amount: number): Promise<void> { const { error } = await supabase.from('budget_template_allocations').update({ amount: normalizedMonthlyAmount(amount) }).eq('id', id); if (error) throw new Error(supabaseErrorMessage(error)) }
export async function deleteBudgetTemplateAllocation(id: string): Promise<void> { const { error } = await supabase.from('budget_template_allocations').delete().eq('id', id); if (error) throw new Error(supabaseErrorMessage(error)) }
export async function createMonthlyBudgetSnapshot(input: { period: string; availableAmount: number; sourceBudgetId?: string; sourceTemplateId?: string }): Promise<string> { const { data, error } = await supabase.rpc('create_monthly_budget_snapshot', { p_period: validatedMonthlyPeriod(input.period), p_available_amount: normalizedMonthlyAmount(input.availableAmount), p_source_budget_id: input.sourceBudgetId ?? null, p_source_template_id: input.sourceTemplateId ?? null }); if (error) throw new Error(supabaseErrorMessage(error)); return data }
export async function createBudgetTemplateFromMonthlyBudget(sourceBudgetId: string, name: string): Promise<string> { const { data, error } = await supabase.rpc('create_budget_template_from_monthly_budget', { p_source_budget_id: sourceBudgetId, p_name: normalizedName(name) }); if (error) throw new Error(supabaseErrorMessage(error)); return data }
