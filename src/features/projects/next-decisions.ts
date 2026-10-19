import {
  collectItemAttentionIssues,
  type AttentionContext,
  type AttentionIssue,
} from '@/features/items/item-attention'
import { getStatusBehavior, type ProjectPriorityOption } from './project-options'
import type { ItemWithOptions } from '@/types/domain'
import { plannedCost, toBudgetItem } from '@/utils/budget/calculations'

export type DecisionState = 'ready' | 'needs_information' | 'needs_resolution'

export type NextDecision = {
  item: ItemWithOptions
  state: DecisionState
  plannedCost: number | null
  issues: AttentionIssue[]
}

const RESOLUTION_ISSUES: readonly AttentionIssue[] = [
  'invalid_category',
  'invalid_priority',
  'invalid_status',
  'invalid_option',
]

function priorityOrder(id: string, options: readonly ProjectPriorityOption[]): number {
  return options.find((option) => option.id === id)?.display_order ?? Number.MAX_SAFE_INTEGER
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'es', { sensitivity: 'base' })
}

/**
 * Builds the compact, read-only decision queue for pending purchases.
 * Pending items are ordered by the project's priority display order, then name,
 * then id so ties stay stable even when names repeat.
 */
export function getNextDecisions(
  items: readonly ItemWithOptions[],
  attentionContext: AttentionContext,
  priorityOptions: readonly ProjectPriorityOption[],
): NextDecision[] {
  return items
    .filter(
      (item) =>
        getStatusBehavior(item.status, attentionContext.statusOptions) === 'pending',
    )
    .map((item) => {
      const issues = collectItemAttentionIssues(item, attentionContext)
      const budgetItem = toBudgetItem(item)
      const calculatedCost = plannedCost(budgetItem, attentionContext.statusOptions)
      const hasResolutionIssue = issues.some((issue) => RESOLUTION_ISSUES.includes(issue))
      const hasCostSource =
        budgetItem.selected_option_price != null ||
        (item.estimated_cost != null && Number.isFinite(item.estimated_cost))
      const hasValidPlannedCost =
        hasCostSource && Number.isFinite(calculatedCost) && calculatedCost >= 0
      const state: DecisionState = hasResolutionIssue
        ? 'needs_resolution'
        : issues.length > 0 || !hasValidPlannedCost
          ? 'needs_information'
          : 'ready'

      return {
        item,
        state,
        plannedCost: hasValidPlannedCost ? calculatedCost : null,
        issues,
      }
    })
    .sort((left, right) => {
      const byPriority =
        priorityOrder(left.item.priority, priorityOptions) -
        priorityOrder(right.item.priority, priorityOptions)
      if (byPriority !== 0) return byPriority
      const byName = compareText(left.item.name, right.item.name)
      if (byName !== 0) return byName
      return left.item.id.localeCompare(right.item.id)
    })
}

export function countDecisionsByState(
  decisions: readonly NextDecision[],
): Record<DecisionState, number> {
  return decisions.reduce<Record<DecisionState, number>>(
    (counts, decision) => {
      counts[decision.state] += 1
      return counts
    },
    { ready: 0, needs_information: 0, needs_resolution: 0 },
  )
}
