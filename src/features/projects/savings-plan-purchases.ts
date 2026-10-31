import { getStatusBehavior, type ProjectStatusOption } from './project-options'

type SavingsPlanItem = {
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
