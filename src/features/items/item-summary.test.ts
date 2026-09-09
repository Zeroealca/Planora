import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_OPTIONS } from '@/features/projects/project-options'
import type { ItemOption, ItemWithOptions } from '@/types/domain'
import {
  getItemCompletionDate,
  getItemCostSummary,
  getItemPurchaseLink,
  getItemStore,
  getSelectedOption,
} from './item-summary'

function option(partial: Partial<ItemOption> & Pick<ItemOption, 'id' | 'name'>): ItemOption {
  return {
    item_id: 'item-1',
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
    id: 'item-1',
    project_id: 'p1',
    category_id: 'c1',
    name: 'Refrigeradora',
    description: null,
    priority: 'Critical',
    estimated_cost: 800,
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

describe('item-summary', () => {
  it('exposes store and purchase link from the selected option', () => {
    const selected = option({
      id: 'o1',
      name: 'Hisense',
      price: 723,
      store: 'Homecenter',
      product_url: 'https://shop.example/hisense',
      selected: true,
    })
    const entry = item({
      status: 'Pending',
      purchase_url: 'https://notes.example/generic',
      options: [
        selected,
        option({ id: 'o2', name: 'LG', price: 810, store: 'Otro', selected: false }),
      ],
    })

    expect(getSelectedOption(entry)?.id).toBe('o1')
    expect(getItemStore(entry)).toBe('Homecenter')
    expect(getItemPurchaseLink(entry)).toEqual({
      href: 'https://shop.example/hisense',
      source: 'option',
    })
    expect(getItemCostSummary(entry, DEFAULT_STATUS_OPTIONS)).toEqual({
      budget: 800,
      planned: 723,
      paid: null,
      contributesToBudget: true,
    })
  })

  it('marks AlreadyOwned as not contributing to budget', () => {
    const owned = item({
      status: 'AlreadyOwned',
      estimated_cost: 800,
      options: [option({ id: 'o1', name: 'Hisense', price: 723, selected: true })],
    })
    expect(getItemCostSummary(owned, DEFAULT_STATUS_OPTIONS)).toEqual({
      budget: 800,
      planned: 723,
      paid: null,
      contributesToBudget: false,
    })
  })

  it('falls back to item purchase_url when the option has no link', () => {
    const entry = item({
      status: 'Pending',
      purchase_url: 'https://notes.example/generic',
      options: [option({ id: 'o1', name: 'Hisense', price: 723, selected: true })],
    })
    expect(getItemPurchaseLink(entry)).toEqual({
      href: 'https://notes.example/generic',
      source: 'item',
    })
  })

  it('labels completed_at as purchase date only when purchased', () => {
    const purchased = item({
      status: 'Purchased',
      actual_cost: 699,
      completed_at: '2026-03-15T12:00:00.000Z',
    })
    const owned = item({
      status: 'AlreadyOwned',
      completed_at: '2026-03-15T12:00:00.000Z',
    })
    expect(getItemCompletionDate(purchased, DEFAULT_STATUS_OPTIONS)?.label).toBe(
      'Fecha de compra',
    )
    expect(getItemCompletionDate(owned, DEFAULT_STATUS_OPTIONS)?.label).toBe(
      'Marcado como “ya lo tengo”',
    )
    expect(
      getItemCompletionDate(item({ status: 'Pending' }), DEFAULT_STATUS_OPTIONS),
    ).toBeNull()
  })
})
