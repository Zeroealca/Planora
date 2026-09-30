import type { BudgetTransaction } from '@/features/monthly-budget/domain'

export type TransactionType = 'expense' | 'income'

/** A persisted financial fact, independent from budgets and projects. */
export type FinancialTransaction = {
  id: string
  userId: string
  name: string
  occurredOn: string
  amount: number
  type: TransactionType
  financialCategoryId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export function toBudgetTransaction(transaction: FinancialTransaction): BudgetTransaction {
  return {
    type: transaction.type,
    amount: transaction.amount,
    financialCategoryId: transaction.financialCategoryId,
  }
}
