import { describe, expect, it, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('@/lib/supabase/client', () => ({ supabase: { from } }))

import {
  archiveFinancialCategory,
  createFinancialCategory,
  createMonthlyBudget,
  createMonthlyBudgetAllocation,
  deleteMonthlyBudgetAllocation,
  fetchMonthlyBudgetByPeriod,
  listFinancialCategories,
  listMonthlyBudgetAllocations,
  renameFinancialCategory,
  updateMonthlyBudgetAllocationAmount,
  updateMonthlyBudgetAvailableAmount,
} from './monthly-budget-api'

type MockResult = { data: unknown; error: null }

type MockQuery = {
  select: (...args: unknown[]) => MockQuery
  order: (...args: unknown[]) => MockQuery
  is: (...args: unknown[]) => MockQuery
  insert: (payload: unknown) => MockQuery
  update: (payload: unknown) => MockQuery
  delete: () => MockQuery
  eq: (...args: unknown[]) => MockQuery
  single: () => Promise<MockResult>
  maybeSingle: () => Promise<MockResult>
  then: PromiseLike<MockResult>['then']
  inserts: unknown[]
  updates: unknown[]
  filters: unknown[][]
}

function query(result: MockResult): MockQuery {
  const inserts: unknown[] = []
  const updates: unknown[] = []
  const filters: unknown[][] = []
  const builder: MockQuery = {
    select: () => builder,
    order: () => builder,
    is: (...args) => {
      filters.push(args)
      return builder
    },
    insert: (payload) => {
      inserts.push(payload)
      return builder
    },
    update: (payload) => {
      updates.push(payload)
      return builder
    },
    delete: () => builder,
    eq: (...args) => {
      filters.push(args)
      return builder
    },
    single: async () => result,
    maybeSingle: async () => result,
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
    inserts,
    updates,
    filters,
  }
  return builder
}

const categoryRow = {
  id: 'category',
  user_id: 'user-a',
  name: 'Alimentación',
  archived_at: null,
  created_at: 'created',
  updated_at: 'updated',
}

const budgetRow = {
  id: 'budget',
  user_id: 'user-a',
  period: '2027-09',
  available_amount: '869.67',
  created_at: 'created',
  updated_at: 'updated',
}

const allocationRow = {
  id: 'allocation',
  monthly_budget_id: 'budget',
  financial_category_id: 'category',
  amount: '250.00',
  created_at: 'created',
  updated_at: 'updated',
}

describe('monthly-budget data access', () => {
  it('creates, renames, archives, and queries financial categories', async () => {
    const create = query({ data: categoryRow, error: null })
    const rename = query({ data: null, error: null })
    const archive = query({ data: null, error: null })
    const active = query({ data: [categoryRow], error: null })
    const all = query({ data: [{ ...categoryRow, archived_at: 'archived' }], error: null })
    from.mockReturnValueOnce(create).mockReturnValueOnce(rename).mockReturnValueOnce(archive)
      .mockReturnValueOnce(active).mockReturnValueOnce(all)

    await expect(createFinancialCategory('user-a', ' Alimentación ')).resolves.toMatchObject({
      name: 'Alimentación',
    })
    await renameFinancialCategory('category', 'Comida')
    await archiveFinancialCategory('category')
    await expect(listFinancialCategories()).resolves.toHaveLength(1)
    await expect(listFinancialCategories(true)).resolves.toHaveLength(1)

    expect(create.inserts).toEqual([{ user_id: 'user-a', name: 'Alimentación' }])
    expect(rename.updates).toEqual([{ name: 'Comida' }])
    expect(archive.updates[0]).toMatchObject({ archived_at: expect.any(String) })
    expect(active.filters).toContainEqual(['archived_at', null])
  })

  it('creates and updates one manual budget for a validated period', async () => {
    const create = query({ data: budgetRow, error: null })
    const update = query({ data: null, error: null })
    const fetch = query({ data: budgetRow, error: null })
    from.mockReturnValueOnce(create).mockReturnValueOnce(update).mockReturnValueOnce(fetch)

    await expect(
      createMonthlyBudget({ userId: 'user-a', period: '2027-09', availableAmount: 869.67 }),
    ).resolves.toMatchObject({ period: '2027-09', availableAmount: 869.67 })
    await updateMonthlyBudgetAvailableAmount('budget', 0)
    await expect(fetchMonthlyBudgetByPeriod('2027-09')).resolves.toMatchObject({ id: 'budget' })

    expect(create.inserts).toEqual([
      { user_id: 'user-a', period: '2027-09', available_amount: 869.67 },
    ])
    expect(update.updates).toEqual([{ available_amount: 0 }])
  })

  it('creates, updates, lists, and deletes an allocation without imposing a total cap', async () => {
    const create = query({ data: allocationRow, error: null })
    const update = query({ data: null, error: null })
    const list = query({ data: [allocationRow], error: null })
    const remove = query({ data: null, error: null })
    from.mockReturnValueOnce(create).mockReturnValueOnce(update).mockReturnValueOnce(list)
      .mockReturnValueOnce(remove)

    await expect(
      createMonthlyBudgetAllocation({ monthlyBudgetId: 'budget', financialCategoryId: 'category', amount: 900 }),
    ).resolves.toMatchObject({ amount: 250 })
    await updateMonthlyBudgetAllocationAmount('allocation', 300)
    await expect(listMonthlyBudgetAllocations('budget')).resolves.toHaveLength(1)
    await deleteMonthlyBudgetAllocation('allocation')

    expect(create.inserts).toEqual([
      { monthly_budget_id: 'budget', financial_category_id: 'category', amount: 900 },
    ])
    expect(update.updates).toEqual([{ amount: 300 }])
    expect(remove.filters).toContainEqual(['id', 'allocation'])
  })
})
