import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRIORITY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
} from '@/features/projects/project-options'
import type { ItemWithOptions } from '@/types/domain'
import { sortProjectItems } from './item-sort'

function item(
  partial: Partial<ItemWithOptions> & Pick<ItemWithOptions, 'id' | 'name' | 'status' | 'priority'>,
): ItemWithOptions {
  return {
    project_id: 'p1',
    category_id: null,
    description: null,
    estimated_cost: 10,
    actual_cost: null,
    purchase_url: null,
    notes: null,
    completed_at: null,
    created_at: '',
    updated_at: '',
    options: [],
    ...partial,
  }
}

describe('sortProjectItems', () => {
  const list = [
    item({
      id: '2',
      name: 'Sofá',
      status: 'Pending',
      priority: 'Optional',
      category_id: 'c1',
    }),
    item({
      id: '1',
      name: 'Mesa',
      status: 'Purchased',
      priority: 'Critical',
      category_id: 'c1',
      actual_cost: null,
    }),
    item({
      id: '3',
      name: 'Lámpara',
      status: 'AlreadyOwned',
      priority: 'High',
      category_id: 'c1',
    }),
  ]

  const context = {
    categories: [
      {
        id: 'c1',
        project_id: 'p1',
        name: 'Sala',
        display_order: 0,
        created_at: '',
        updated_at: '',
      },
    ],
    statusOptions: DEFAULT_STATUS_OPTIONS,
    priorityOptions: DEFAULT_PRIORITY_OPTIONS,
  }

  it('sorts by name', () => {
    expect(
      sortProjectItems(list, 'name', DEFAULT_PRIORITY_OPTIONS, DEFAULT_STATUS_OPTIONS, context).map(
        (entry) => entry.name,
      ),
    ).toEqual(['Lámpara', 'Mesa', 'Sofá'])
  })

  it('sorts by priority display order', () => {
    expect(
      sortProjectItems(
        list,
        'priority',
        DEFAULT_PRIORITY_OPTIONS,
        DEFAULT_STATUS_OPTIONS,
        context,
      ).map((entry) => entry.priority),
    ).toEqual(['Critical', 'High', 'Optional'])
  })

  it('puts attention items first', () => {
    const sorted = sortProjectItems(
      list,
      'attention',
      DEFAULT_PRIORITY_OPTIONS,
      DEFAULT_STATUS_OPTIONS,
      context,
    )
    expect(sorted[0]?.id).toBe('1')
  })
})
