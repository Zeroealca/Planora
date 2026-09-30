import { describe, expect, it } from 'vitest'
import {
  normalizedMonthlyAmount,
  validatedMonthlyPeriod,
} from './monthly-budget-api'
import { mapFinancialCategory, mapMonthlyBudget, mapMonthlyBudgetAllocation } from '@/lib/supabase/mappers'

describe('monthly-budget persistence boundary', () => {
  it('accepts zero and normalizes valid amounts to cents before persistence', () => {
    expect(normalizedMonthlyAmount(0)).toBe(0)
    expect(normalizedMonthlyAmount(0.1 + 0.2)).toBe(0.3)
    expect(normalizedMonthlyAmount(869.67)).toBe(869.67)
  })

  it('rejects negative or non-finite amounts before persistence', () => {
    expect(() => normalizedMonthlyAmount(-0.01)).toThrow(/mayor o igual a cero/i)
    expect(() => normalizedMonthlyAmount(Number.NaN)).toThrow(/mayor o igual a cero/i)
  })

  it('accepts only the YYYY-MM period contract', () => {
    expect(validatedMonthlyPeriod('2027-09')).toBe('2027-09')
    expect(() => validatedMonthlyPeriod('2027-9')).toThrow(/YYYY-MM/)
    expect(() => validatedMonthlyPeriod('2027-13')).toThrow(/YYYY-MM/)
  })

  it('maps persisted rows into monthly-budget domain records without aggregates', () => {
    expect(
      mapFinancialCategory({
        id: 'category', user_id: 'user', name: 'Alimentación', archived_at: '2027-10-01T00:00:00Z', created_at: 'created', updated_at: 'updated',
      }),
    ).toMatchObject({ id: 'category', userId: 'user', archivedAt: '2027-10-01T00:00:00Z' })
    expect(
      mapMonthlyBudget({
        id: 'budget', user_id: 'user', period: '2027-09', available_amount: 869.67, created_at: 'created', updated_at: 'updated',
      }),
    ).toMatchObject({ id: 'budget', period: '2027-09', availableAmount: 869.67 })
    expect(
      mapMonthlyBudgetAllocation({
        id: 'allocation', monthly_budget_id: 'budget', financial_category_id: 'category', amount: 250, created_at: 'created', updated_at: 'updated',
      }),
    ).toMatchObject({ monthlyBudgetId: 'budget', financialCategoryId: 'category', amount: 250 })
  })
})
