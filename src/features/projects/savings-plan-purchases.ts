import { getStatusBehavior, type ProjectStatusOption } from './project-options'

type SavingsPlanItem = {
  priority?: string | null
  status: string
  estimated_cost: number | null
  actual_cost: number | null
  subarticles?: readonly {
    estimated_cost: number | null
    actual_cost: number | null
    status: 'pending' | 'purchased'
  }[]
}

export type SavingsPlanPurchaseSummary = {
  pendingEstimated: number
  spent: number
  projected: number
  purchasedCount: number
  totalCount: number
}

export type SavingsPlanPrioritySummary = {
  priority: string
  estimated: number
  spent: number
  pending: number
}

function amountOrZero(value: number | null): number {
  return value != null && Number.isFinite(value) ? value : 0
}

/** Purchase data complements a savings plan; it never changes savings or transactions. */
export function calculateSavingsPlanPurchaseSummary(
  items: readonly SavingsPlanItem[],
  statusOptions: readonly ProjectStatusOption[],
): SavingsPlanPurchaseSummary {
  let pendingEstimated = 0
  let spent = 0
  let purchasedCount = 0
  let totalCount = 0

  for (const item of items) {
    if (item.subarticles && item.subarticles.length > 0) {
      for (const subarticle of item.subarticles) {
        totalCount += 1
        if (subarticle.status === 'purchased') {
          purchasedCount += 1
          spent += amountOrZero(subarticle.actual_cost)
        } else {
          pendingEstimated += amountOrZero(subarticle.estimated_cost)
        }
      }
      continue
    }
    const behavior = getStatusBehavior(item.status, statusOptions)
    if (behavior === 'pending') {
      totalCount += 1
      pendingEstimated += amountOrZero(item.estimated_cost)
    } else if (behavior === 'purchased') {
      totalCount += 1
      purchasedCount += 1
      spent += amountOrZero(item.actual_cost)
    }
  }

  return { pendingEstimated, spent, projected: spent + pendingEstimated, purchasedCount, totalCount }
}

/**
 * Groups a savings plan's purchasable leaves by the parent item's priority.
 * A parent with subarticles contributes only its subarticles, so its own
 * amounts cannot be counted twice. Pending is intentionally accumulated from
 * pending leaves instead of subtracting spent from estimates: an overpaid
 * purchase must never turn into a negative pending amount.
 */
export function calculateSavingsPlanPrioritySummary(
  items: readonly SavingsPlanItem[],
  statusOptions: readonly ProjectStatusOption[],
  priorityIds: readonly string[] = [],
): SavingsPlanPrioritySummary[] {
  const summaries = new Map<string, SavingsPlanPrioritySummary>()
  const priorityKey = (priority: string | null | undefined) =>
    priority?.trim() || '__none__'
  const ensure = (priority: string) => {
    const existing = summaries.get(priority)
    if (existing) return existing
    const summary = { priority, estimated: 0, spent: 0, pending: 0 }
    summaries.set(priority, summary)
    return summary
  }
  const addLeaf = (
    priority: string,
    estimatedCost: number | null,
    actualCost: number | null,
    purchased: boolean,
  ) => {
    const summary = ensure(priority)
    summary.estimated += amountOrZero(estimatedCost)
    if (purchased) summary.spent += amountOrZero(actualCost)
    else summary.pending += amountOrZero(estimatedCost)
  }
  for (const priority of priorityIds) ensure(priorityKey(priority))
  for (const item of items) {
    const priority = priorityKey(item.priority)
    if (item.subarticles && item.subarticles.length > 0) {
      for (const subarticle of item.subarticles) {
        addLeaf(priority, subarticle.estimated_cost, subarticle.actual_cost, subarticle.status === 'purchased')
      }
      continue
    }
    const behavior = getStatusBehavior(item.status, statusOptions)
    if (behavior === 'owned') continue
    addLeaf(priority, item.estimated_cost, item.actual_cost, behavior === 'purchased')
  }
  return [...summaries.values()]
}
