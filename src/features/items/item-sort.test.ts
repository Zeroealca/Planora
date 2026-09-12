import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRIORITY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
} from '@/features/projects/project-options'
import type { ItemOption, ItemWithOptions } from '@/types/domain'
import { sortProjectItems } from './item-sort'

function option(partial: Partial<ItemOption> & Pick<ItemOption, 'id' | 'name'>): ItemOption {
  return {
    item_id: 'item',
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
    tracking_enabled: false,
    tracked_price_type: 'primary',
    target_price: null,
    alert_on_drop: false,
    alert_on_increase: false,
    alert_drop_percentage: null,
    last_checked_at: null,
    tracking_status: 'inactive',
    created_at: '',
    updated_at: '',
    ...partial,
  }
}

function item(
  partial: Partial<ItemWithOptions> & Pick<ItemWithOptions, 'id' | 'name' | 'status' | 'priority'>,
): ItemWithOptions {
  return {
    project_id: 'p1',
    category_id: null,
    description: null,
    quantity: 1,
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
      sortProjectItems(
        list,
        'name',
        'asc',
        DEFAULT_PRIORITY_OPTIONS,
        DEFAULT_STATUS_OPTIONS,
        context,
      ).map((entry) => entry.name),
    ).toEqual(['Lámpara', 'Mesa', 'Sofá'])
  })

  it('sorts by priority display order', () => {
    expect(
      sortProjectItems(
        list,
        'priority',
        'asc',
        DEFAULT_PRIORITY_OPTIONS,
        DEFAULT_STATUS_OPTIONS,
        context,
      ).map((entry) => entry.priority),
    ).toEqual(['Critical', 'High', 'Optional'])
  })

  it('sorts by category display order and leaves uncategorized items last', () => {
    const sorted = sortProjectItems(
      [
        item({
          id: '1',
          name: 'Sin categoría',
          status: 'Pending',
          priority: 'Optional',
          category_id: null,
        }),
        item({
          id: '2',
          name: 'Mesa',
          status: 'Pending',
          priority: 'Optional',
          category_id: 'c2',
        }),
        item({
          id: '3',
          name: 'Silla',
          status: 'Pending',
          priority: 'Optional',
          category_id: 'c1',
        }),
      ],
      'category',
      'asc',
      DEFAULT_PRIORITY_OPTIONS,
      DEFAULT_STATUS_OPTIONS,
      {
        ...context,
        categories: [
          {
            id: 'c1',
            project_id: 'p1',
            name: 'Sala',
            display_order: 1,
            created_at: '',
            updated_at: '',
          },
          {
            id: 'c2',
            project_id: 'p1',
            name: 'Cocina',
            display_order: 0,
            created_at: '',
            updated_at: '',
          },
        ],
      },
    )

    expect(sorted.map((entry) => entry.name)).toEqual([
      'Mesa',
      'Silla',
      'Sin categoría',
    ])
  })

  it('sorts by selected option store and leaves missing stores last', () => {
    const sorted = sortProjectItems(
      [
        item({
          id: '1',
          name: 'Sin tienda',
          status: 'Pending',
          priority: 'Optional',
        }),
        item({
          id: '2',
          name: 'Aspiradora',
          status: 'Pending',
          priority: 'Optional',
          options: [
            option({ id: 'o2', name: 'Aspiradora', store: 'Kywi', selected: true }),
          ],
        }),
        item({
          id: '3',
          name: 'Refrigeradora',
          status: 'Pending',
          priority: 'Optional',
          options: [
            option({
              id: 'o3',
              name: 'Refrigeradora',
              store: 'Marcimex',
              selected: true,
            }),
          ],
        }),
        item({
          id: '4',
          name: 'Cocina',
          status: 'Pending',
          priority: 'Optional',
          options: [option({ id: 'o4', name: 'Cocina', store: 'kywi', selected: true })],
        }),
      ],
      'store',
      'asc',
      DEFAULT_PRIORITY_OPTIONS,
      DEFAULT_STATUS_OPTIONS,
      context,
    )

    expect(sorted.map((entry) => entry.name)).toEqual([
      'Aspiradora',
      'Cocina',
      'Refrigeradora',
      'Sin tienda',
    ])
  })

  it('puts attention items first', () => {
    const sorted = sortProjectItems(
      list,
      'attention',
      'asc',
      DEFAULT_PRIORITY_OPTIONS,
      DEFAULT_STATUS_OPTIONS,
      context,
    )
    expect(sorted[0]?.id).toBe('1')
  })

  it('sorts in descending direction', () => {
    expect(
      sortProjectItems(
        list,
        'name',
        'desc',
        DEFAULT_PRIORITY_OPTIONS,
        DEFAULT_STATUS_OPTIONS,
        context,
      ).map((entry) => entry.name),
    ).toEqual(['Sofá', 'Mesa', 'Lámpara'])
  })
})
