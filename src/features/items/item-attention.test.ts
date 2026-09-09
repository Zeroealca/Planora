import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRIORITY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
} from '@/features/projects/project-options'
import type { Category, ItemOption, ItemWithOptions } from '@/types/domain'
import {
  collectItemAttentionIssues,
  countItemsNeedingAttention,
  filterItemsByAttention,
  itemMatchesAttentionFilter,
} from './item-attention'

const categories: Category[] = [
  {
    id: 'kitchen',
    project_id: 'p1',
    name: 'Cocina',
    display_order: 0,
    created_at: '',
    updated_at: '',
  },
]

const context = {
  categories,
  statusOptions: DEFAULT_STATUS_OPTIONS,
  priorityOptions: DEFAULT_PRIORITY_OPTIONS,
}

function option(partial: Partial<ItemOption> & Pick<ItemOption, 'id' | 'name'>): ItemOption {
  return {
    item_id: 'i1',
    brand: null,
    model: null,
    price: null,
    store: null,
    product_url: null,
    image_url: null,
    description: null,
    specifications: null,
    notes: null,
    selected: false,
    created_at: '',
    updated_at: '',
    ...partial,
  }
}

function item(
  partial: Partial<ItemWithOptions> & Pick<ItemWithOptions, 'status'>,
): ItemWithOptions {
  return {
    id: 'i1',
    project_id: 'p1',
    category_id: 'kitchen',
    name: 'Item',
    description: null,
    priority: 'Medium',
    estimated_cost: 100,
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

describe('item attention detection', () => {
  it('flags missing category and budget', () => {
    expect(
      collectItemAttentionIssues(
        item({ status: 'Pending', category_id: null, estimated_cost: null }),
        context,
      ),
    ).toEqual(expect.arrayContaining(['missing_category', 'missing_budget']))
  })

  it('flags purchased without actual_cost', () => {
    expect(
      collectItemAttentionIssues(
        item({ status: 'Purchased', estimated_cost: 100, actual_cost: null }),
        context,
      ),
    ).toContain('purchased_without_actual')
  })

  it('flags pending without planned price path', () => {
    expect(
      collectItemAttentionIssues(
        item({ status: 'Pending', estimated_cost: null, options: [] }),
        context,
      ),
    ).toContain('missing_planned_price')
  })

  it('does not flag missing_planned_price when selected option has price', () => {
    const issues = collectItemAttentionIssues(
      item({
        status: 'Pending',
        estimated_cost: null,
        options: [option({ id: 'o1', name: 'A', price: 50, selected: true })],
      }),
      context,
    )
    expect(issues).not.toContain('missing_planned_price')
    expect(issues).toContain('missing_budget')
  })

  it('flags selected option without price', () => {
    expect(
      collectItemAttentionIssues(
        item({
          status: 'Pending',
          estimated_cost: 80,
          options: [option({ id: 'o1', name: 'A', price: null, selected: true })],
        }),
        context,
      ),
    ).toContain('selected_option_without_price')
  })

  it('flags invalid category and priority references', () => {
    const issues = collectItemAttentionIssues(
      item({
        status: 'Pending',
        category_id: 'missing-cat',
        priority: 'Nope',
      }),
      context,
    )
    expect(issues).toEqual(expect.arrayContaining(['invalid_category', 'invalid_priority']))
  })

  it('filters needs_attention and specific presets', () => {
    const list = [
      item({ id: 'ok', status: 'Pending', estimated_cost: 10 }),
      item({ id: 'no-cat', status: 'Pending', category_id: null, estimated_cost: 10 }),
      item({
        id: 'bought',
        status: 'Purchased',
        estimated_cost: 10,
        actual_cost: null,
        completed_at: '2026-01-01',
      }),
    ]
    expect(countItemsNeedingAttention(list, context)).toBe(2)
    expect(filterItemsByAttention(list, 'missing_category', context).map((entry) => entry.id)).toEqual([
      'no-cat',
    ])
    expect(
      filterItemsByAttention(list, 'purchased_without_actual', context).map((entry) => entry.id),
    ).toEqual(['bought'])
    expect(itemMatchesAttentionFilter(list[0]!, 'needs_attention', context)).toBe(false)
  })
})
