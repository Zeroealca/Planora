import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRIORITY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
} from './project-options'
import { getNextDecisions } from './next-decisions'
import type { Category, ItemWithOptions } from '@/types/domain'

const categories: Category[] = [
  { id: 'category', project_id: 'project', name: 'General', display_order: 0, created_at: '', updated_at: '' },
]

const context = {
  categories,
  statusOptions: DEFAULT_STATUS_OPTIONS,
  priorityOptions: DEFAULT_PRIORITY_OPTIONS,
}

function item(
  partial: Partial<ItemWithOptions> & Pick<ItemWithOptions, 'id' | 'name' | 'status' | 'priority'>,
): ItemWithOptions {
  return {
    project_id: 'project',
    category_id: 'category',
    description: null,
    quantity: 1,
    estimated_cost: 100,
    actual_cost: null,
    include_in_purchase_report: false,
    purchase_url: null,
    notes: null,
    completed_at: null,
    created_at: '',
    updated_at: '',
    options: [],
    ...partial,
  }
}

describe('getNextDecisions', () => {
  it('classifies pending items with a valid planned cost and no issues as ready', () => {
    const decisions = getNextDecisions(
      [item({ id: 'ready', name: 'Mesa', status: 'Pending', priority: 'Medium' })],
      context,
      DEFAULT_PRIORITY_OPTIONS,
    )

    expect(decisions[0]).toMatchObject({ state: 'ready', plannedCost: 100 })
  })

  it('requires information for absent or invalid planned cost inputs', () => {
    const decisions = getNextDecisions(
      [
        item({ id: 'missing', name: 'Lámpara', status: 'Pending', priority: 'Medium', estimated_cost: null }),
        item({ id: 'invalid', name: 'Silla', status: 'Pending', priority: 'Medium', estimated_cost: Number.NaN }),
      ],
      context,
      DEFAULT_PRIORITY_OPTIONS,
    )

    expect(decisions.map((decision) => decision.state)).toEqual([
      'needs_information',
      'needs_information',
    ])
    expect(decisions.map((decision) => decision.plannedCost)).toEqual([null, null])
  })

  it('requires resolution for blocking reference or selection incidences', () => {
    const decisions = getNextDecisions(
      [
        item({ id: 'invalid-priority', name: 'A', status: 'Pending', priority: 'Missing' }),
        item({ id: 'invalid-category', name: 'B', status: 'Pending', priority: 'Medium', category_id: 'gone' }),
      ],
      context,
      DEFAULT_PRIORITY_OPTIONS,
    )

    expect(decisions.map((decision) => decision.state)).toEqual([
      'needs_resolution',
      'needs_resolution',
    ])
  })

  it('excludes purchased and already owned items', () => {
    const decisions = getNextDecisions(
      [
        item({ id: 'pending', name: 'Pendiente', status: 'Pending', priority: 'Medium' }),
        item({ id: 'purchased', name: 'Comprado', status: 'Purchased', priority: 'Critical' }),
        item({ id: 'owned', name: 'Propio', status: 'AlreadyOwned', priority: 'Critical' }),
      ],
      context,
      DEFAULT_PRIORITY_OPTIONS,
    )

    expect(decisions.map((decision) => decision.item.id)).toEqual(['pending'])
  })

  it('uses priority order then name and id as deterministic ties', () => {
    const decisions = getNextDecisions(
      [
        item({ id: 'z', name: 'Árbol', status: 'Pending', priority: 'High' }),
        item({ id: 'b', name: 'Mesa', status: 'Pending', priority: 'Critical' }),
        item({ id: 'a', name: 'Mesa', status: 'Pending', priority: 'Critical' }),
        item({ id: 'optional', name: 'Extra', status: 'Pending', priority: 'Optional' }),
      ],
      context,
      DEFAULT_PRIORITY_OPTIONS,
    )

    expect(decisions.map((decision) => decision.item.id)).toEqual(['a', 'b', 'z', 'optional'])
  })
})
