import { addCents, fromCents, subtractCents, toCents } from './money'
import type { FinancialCategory } from './domain'

export type ReusableAllocation = { financialCategoryId: string; amount: number }
export type BudgetTemplate = { id: string; userId: string; name: string; suggestedAvailableAmount: number | null; createdAt: string; updatedAt: string }
export type BudgetTemplateAllocation = ReusableAllocation & { id: string; budgetTemplateId: string; createdAt: string; updatedAt: string }
export function previewReusablePlan(availableAmount: number, allocations: readonly ReusableAllocation[], categories: readonly FinancialCategory[]) {
  const archived = allocations.filter((a) => categories.find((c) => c.id === a.financialCategoryId)?.archivedAt != null)
  const active = allocations.filter((a) => !archived.includes(a))
  const assigned = fromCents(addCents(...active.map((a) => toCents(a.amount))))
  return { active, archived, assigned, unassigned: fromCents(subtractCents(toCents(availableAmount), toCents(assigned))) }
}
