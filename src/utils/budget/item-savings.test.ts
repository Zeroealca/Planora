import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_OPTIONS } from '@/features/projects/project-options'
import type { BudgetItem } from './calculations'
import {
  actualSavingsForItem,
  calculateActualSavings,
  calculateActualSavingsByCategory,
  calculateActualSavingsByPriority,
  calculateExpectedSavings,
  calculateExpectedSavingsByCategory,
  calculateExpectedSavingsByPriority,
  expectedSavingsForItem,
} from './item-savings'

const statusOptions = DEFAULT_STATUS_OPTIONS

function item(partial: Partial<BudgetItem> & Pick<BudgetItem, 'status'>): BudgetItem {
  return {
    priority: 'Medium',
    category_id: null,
    estimated_cost: null,
    actual_cost: null,
    selected_option_price: null,
    ...partial,
  }
}

describe('expectedSavingsForItem', () => {
  it('pending estimated 800 selected 723 → expected savings 77', () => {
    const fridge = item({
      status: 'Pending',
      estimated_cost: 800,
      selected_option_price: 723,
    })
    expect(expectedSavingsForItem(fridge, statusOptions)).toBe(77)
  })

  it('pending estimated 800 planned 850 → expected overcost -50', () => {
    const fridge = item({
      status: 'Pending',
      estimated_cost: 800,
      selected_option_price: 850,
    })
    expect(expectedSavingsForItem(fridge, statusOptions)).toBe(-50)
  })

  it('pending without estimated_cost → null', () => {
    expect(
      expectedSavingsForItem(
        item({ status: 'Pending', selected_option_price: 100 }),
        statusOptions,
      ),
    ).toBeNull()
  })

  it('purchased or owned → null for expected', () => {
    expect(
      expectedSavingsForItem(
        item({ status: 'Purchased', estimated_cost: 800, actual_cost: 700 }),
        statusOptions,
      ),
    ).toBeNull()
    expect(
      expectedSavingsForItem(item({ status: 'AlreadyOwned', estimated_cost: 800 }), statusOptions),
    ).toBeNull()
  })

  it('pending with only estimated (no option) → 0', () => {
    expect(
      expectedSavingsForItem(item({ status: 'Pending', estimated_cost: 800 }), statusOptions),
    ).toBe(0)
  })
})

describe('actualSavingsForItem', () => {
  it('purchased estimated 800 actual 699 → real savings 101', () => {
    expect(
      actualSavingsForItem(
        item({ status: 'Purchased', estimated_cost: 800, actual_cost: 699 }),
        statusOptions,
      ),
    ).toBe(101)
  })

  it('purchased estimated 800 actual 850 → real overcost -50', () => {
    expect(
      actualSavingsForItem(
        item({ status: 'Purchased', estimated_cost: 800, actual_cost: 850 }),
        statusOptions,
      ),
    ).toBe(-50)
  })

  it('purchased without actual_cost → null', () => {
    expect(
      actualSavingsForItem(
        item({ status: 'Purchased', estimated_cost: 800, selected_option_price: 723 }),
        statusOptions,
      ),
    ).toBeNull()
  })

  it('pending → null for actual', () => {
    expect(
      actualSavingsForItem(
        item({ status: 'Pending', estimated_cost: 800, selected_option_price: 723 }),
        statusOptions,
      ),
    ).toBeNull()
  })
})

describe('project savings aggregates', () => {
  const mixed: BudgetItem[] = [
    item({
      status: 'Pending',
      priority: 'Critical',
      category_id: 'kitchen',
      estimated_cost: 800,
      selected_option_price: 723,
    }),
    item({
      status: 'Pending',
      priority: 'High',
      category_id: 'living',
      estimated_cost: 800,
      selected_option_price: 850,
    }),
    item({
      status: 'Purchased',
      priority: 'Critical',
      category_id: 'kitchen',
      estimated_cost: 650,
      actual_cost: 620,
    }),
    item({
      status: 'AlreadyOwned',
      priority: 'Optional',
      category_id: 'office',
      estimated_cost: 180,
    }),
  ]

  it('totals keep expected and actual separate', () => {
    expect(calculateExpectedSavings(mixed, statusOptions)).toBe(77 + -50)
    expect(calculateActualSavings(mixed, statusOptions)).toBe(30)
  })

  it('breaks down expected and actual by priority', () => {
    expect(calculateExpectedSavingsByPriority(mixed, statusOptions)).toEqual({
      Critical: 77,
      High: -50,
    })
    expect(calculateActualSavingsByPriority(mixed, statusOptions)).toEqual({
      Critical: 30,
    })
  })

  it('breaks down expected and actual by category', () => {
    expect(calculateExpectedSavingsByCategory(mixed, statusOptions)).toEqual([
      { category_id: 'kitchen', amount: 77 },
      { category_id: 'living', amount: -50 },
    ])
    expect(calculateActualSavingsByCategory(mixed, statusOptions)).toEqual([
      { category_id: 'kitchen', amount: 30 },
    ])
  })
})
