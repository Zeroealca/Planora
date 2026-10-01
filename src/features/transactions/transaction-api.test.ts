import { describe, expect, it, vi } from 'vitest'

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ supabase: { from, rpc } }))

import {
  createTransaction,
  deleteTransaction,
  fetchTransaction,
  listTransactions,
  updateTransaction,
} from './transaction-api'

type Result = { data: unknown; error: null }
type Query = {
  select: (...args: unknown[]) => Query
  order: (...args: unknown[]) => Query
  gte: (...args: unknown[]) => Query
  lt: (...args: unknown[]) => Query
  eq: (...args: unknown[]) => Query
  insert: (payload: unknown) => Query
  update: (payload: unknown) => Query
  delete: () => Query
  single: () => Promise<Result>
  maybeSingle: () => Promise<Result>
  then: PromiseLike<Result>['then']
  inserts: unknown[]
  updates: unknown[]
  filters: unknown[][]
}

function query(result: Result): Query {
  const inserts: unknown[] = []
  const updates: unknown[] = []
  const filters: unknown[][] = []
  const builder: Query = {
    select: () => builder, order: () => builder,
    gte: (...args) => { filters.push(args); return builder },
    lt: (...args) => { filters.push(args); return builder },
    eq: (...args) => { filters.push(args); return builder },
    insert: (payload) => { inserts.push(payload); return builder },
    update: (payload) => { updates.push(payload); return builder },
    delete: () => builder,
    single: async () => result, maybeSingle: async () => result,
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
    inserts, updates, filters,
  }
  return builder
}

const expenseRow = {
  id: 'expense', user_id: 'user', name: 'Supermercado', occurred_on: '2027-09-10', amount: '186.42', transaction_type: 'expense', financial_category_id: 'food', notes: null, created_at: '', updated_at: '',
}

describe('transaction data access', () => {
  it('creates, lists, fetches, updates, and deletes transactions', async () => {
    const create = query({ data: expenseRow, error: null })
    const list = query({ data: [expenseRow], error: null })
    const fetch = query({ data: expenseRow, error: null })
    const update = query({ data: null, error: null })
    from.mockReturnValueOnce(create).mockReturnValueOnce(list).mockReturnValueOnce(fetch)
      .mockReturnValueOnce(update)
    rpc.mockResolvedValueOnce({ data: null, error: null })

    await expect(createTransaction('user', { name: 'Supermercado', occurredOn: '2027-09-10', amount: 186.42, type: 'expense', financialCategoryId: 'food', notes: null })).resolves.toMatchObject({ amount: 186.42 })
    await expect(listTransactions({ fromDate: '2027-09-01', toDateExclusive: '2027-10-01', financialCategoryId: 'food', type: 'expense' })).resolves.toHaveLength(1)
    await expect(fetchTransaction('expense')).resolves.toMatchObject({ id: 'expense' })
    await updateTransaction('expense', { name: 'Supermercado', occurredOn: '2027-09-10', amount: 198.72, type: 'expense', financialCategoryId: 'food', notes: null })
    await deleteTransaction('expense')

    expect(create.inserts).toEqual([{
      user_id: 'user', name: 'Supermercado', occurred_on: '2027-09-10', amount: 186.42,
      transaction_type: 'expense', financial_category_id: 'food', notes: null,
    }])
    expect(list.filters).toContainEqual(['occurred_on', '2027-09-01'])
    expect(list.filters).toContainEqual(['occurred_on', '2027-10-01'])
    expect(update.updates).toEqual([{ name: 'Supermercado', occurred_on: '2027-09-10', amount: 198.72, transaction_type: 'expense', financial_category_id: 'food', notes: null }])
    expect(rpc).toHaveBeenCalledWith('delete_transaction_consistently', { p_transaction_id: 'expense' })
  })
})
