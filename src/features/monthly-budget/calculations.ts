import type {
  BudgetTransaction,
  CategoryBudgetMetrics,
  MonthlyBudget,
  MonthlyBudgetAllocation,
  MonthlyBudgetSummary,
} from './domain'
import { addCents, fromCents, maxCents, subtractCents, toCents, type Cents } from './money'

function amountCents(amount: number): Cents {
  const cents = toCents(amount)
  if (cents < 0) throw new Error('Budget input amounts cannot be negative.')
  return cents
}

function allocationCents(allocations: readonly MonthlyBudgetAllocation[]): Cents {
  return addCents(...allocations.map((allocation) => amountCents(allocation.amount)))
}

/** Effect on budget spending, not on cash balance. */
export function transactionBudgetEffect(transaction: BudgetTransaction): number {
  const amount = amountCents(transaction.amount)
  switch (transaction.type) {
    case 'expense':
      return fromCents(amount)
    case 'refund':
      return fromCents(-amount)
    case 'income':
    case 'transfer':
      return 0
  }
}

function transactionBudgetEffectCents(transaction: BudgetTransaction): Cents {
  return toCents(transactionBudgetEffect(transaction))
}

export function calculateAssigned(allocations: readonly MonthlyBudgetAllocation[]): number {
  return fromCents(allocationCents(allocations))
}

export function calculateUnassigned(
  availableAmount: number,
  allocations: readonly MonthlyBudgetAllocation[],
): number {
  return fromCents(subtractCents(amountCents(availableAmount), allocationCents(allocations)))
}

/** Transactions supplied here must already be applicable to the requested month. */
export function calculateSpent(transactions: readonly BudgetTransaction[]): number {
  return fromCents(addCents(...transactions.map(transactionBudgetEffectCents)))
}

export function calculateActualRemaining(
  availableAmount: number,
  transactions: readonly BudgetTransaction[],
): number {
  return fromCents(subtractCents(amountCents(availableAmount), toCents(calculateSpent(transactions))))
}

export function calculateCategorySpent(
  financialCategoryId: string,
  transactions: readonly BudgetTransaction[],
): number {
  return calculateSpent(
    transactions.filter((transaction) => transaction.financialCategoryId === financialCategoryId),
  )
}

export function calculateCategoryMetrics(
  categoryBudget: number,
  transactions: readonly BudgetTransaction[],
): CategoryBudgetMetrics {
  const budget = amountCents(categoryBudget)
  const spent = toCents(calculateSpent(transactions))
  const remaining = subtractCents(budget, spent)
  const overBudget = maxCents(0, -remaining)

  return {
    budget: fromCents(budget),
    spent: fromCents(spent),
    remaining: fromCents(remaining),
    usage: budget === 0 ? null : spent / budget,
    overBudget: fromCents(overBudget),
  }
}

export function calculateMonthlyBudgetSummary(
  budget: MonthlyBudget,
  transactions: readonly BudgetTransaction[],
): MonthlyBudgetSummary {
  const assigned = allocationCents(budget.allocations)
  const available = amountCents(budget.availableAmount)
  const spent = toCents(calculateSpent(transactions))

  return {
    availableAmount: fromCents(available),
    assigned: fromCents(assigned),
    unassigned: fromCents(subtractCents(available, assigned)),
    spent: fromCents(spent),
    actualRemaining: fromCents(subtractCents(available, spent)),
  }
}
