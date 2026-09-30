import { describe, expect, it } from 'vitest'
import type { BudgetTransaction, MonthlyBudgetAllocation } from './domain'
import {
  calculateActualRemaining,
  calculateAssigned,
  calculateCategoryMetrics,
  calculateCategorySpent,
  calculateMonthlyBudgetSummary,
  calculateSpent,
  calculateUnassigned,
  transactionBudgetEffect,
} from './calculations'
import { addCents, fromCents, toCents } from './money'
import {
  compareMonthlyPeriods,
  currentMonthlyPeriod,
  isMonthlyPeriod,
  monthlyPeriodState,
  nextMonthlyPeriod,
  previousMonthlyPeriod,
} from './period'

const allocations: MonthlyBudgetAllocation[] = [
  { financialCategoryId: 'mortgage', amount: 308.97 },
  { financialCategoryId: 'food', amount: 250 },
  { financialCategoryId: 'utilities', amount: 251 },
]

describe('monthly budget monetary arithmetic', () => {
  it('uses integer cents for additions and conversions', () => {
    expect(toCents(869.67)).toBe(86967)
    expect(fromCents(86967)).toBe(869.67)
    expect(fromCents(addCents(toCents(0.1), toCents(0.2)))).toBe(0.3)
    expect(fromCents(addCents(toCents(10.99), toCents(308.97), toCents(869.67)))).toBe(1189.63)
  })
})

describe('monthly periods', () => {
  it('validates, navigates, compares, and classifies without parsing YYYY-MM as a timestamp', () => {
    expect(isMonthlyPeriod('2027-09')).toBe(true)
    expect(isMonthlyPeriod('2027-9')).toBe(false)
    expect(isMonthlyPeriod('2027-13')).toBe(false)
    expect(previousMonthlyPeriod('2027-01')).toBe('2026-12')
    expect(nextMonthlyPeriod('2027-12')).toBe('2028-01')
    expect(compareMonthlyPeriods('2027-09', '2027-10')).toBeLessThan(0)
    expect(currentMonthlyPeriod(new Date(2027, 8, 30, 23, 59))).toBe('2027-09')
    expect(monthlyPeriodState('2027-08', '2027-09')).toBe('past')
    expect(monthlyPeriodState('2027-09', '2027-09')).toBe('current')
    expect(monthlyPeriodState('2027-10', '2027-09')).toBe('future')
  })
})

describe('monthly budget calculations', () => {
  it('derives the approved summary and preserves assigned + unassigned = available', () => {
    const budget = { period: '2027-09', availableAmount: 869.67, allocations }
    const summary = calculateMonthlyBudgetSummary(budget, [
      { type: 'expense', amount: 498.32, financialCategoryId: 'food' },
    ])

    expect(calculateAssigned(allocations)).toBe(809.97)
    expect(calculateUnassigned(869.67, allocations)).toBe(59.7)
    expect(summary).toEqual({
      availableAmount: 869.67,
      assigned: 809.97,
      unassigned: 59.7,
      spent: 498.32,
      actualRemaining: 371.35,
    })
    expect(toCents(summary.assigned) + toCents(summary.unassigned)).toBe(
      toCents(summary.availableAmount),
    )
  })

  it('represents over-assignment without blocking it', () => {
    expect(calculateUnassigned(869.67, [{ financialCategoryId: 'food', amount: 900 }])).toBe(
      -30.33,
    )
  })

  it('calculates category remaining, usage, and no excess below budget', () => {
    const metrics = calculateCategoryMetrics(250, [
      { type: 'expense', amount: 195, financialCategoryId: 'food' },
    ])
    expect(metrics).toEqual({ budget: 250, spent: 195, remaining: 55, usage: 0.78, overBudget: 0 })
  })

  it('keeps over-budget category metrics meaningful', () => {
    const metrics = calculateCategoryMetrics(250, [
      { type: 'expense', amount: 268, financialCategoryId: 'food' },
    ])
    expect(metrics).toEqual({
      budget: 250,
      spent: 268,
      remaining: -18,
      usage: 1.072,
      overBudget: 18,
    })
  })

  it('returns null usage, never NaN or Infinity, for a zero category budget', () => {
    const empty = calculateCategoryMetrics(0, [])
    const exceeded = calculateCategoryMetrics(0, [
      { type: 'expense', amount: 20, financialCategoryId: 'food' },
    ])
    expect(empty).toEqual({ budget: 0, spent: 0, remaining: 0, usage: null, overBudget: 0 })
    expect(exceeded).toEqual({ budget: 0, spent: 20, remaining: -20, usage: null, overBudget: 20 })
  })

  it('applies only matching category movements to category spent', () => {
    const transactions: BudgetTransaction[] = [
      { type: 'expense', amount: 195, financialCategoryId: 'food' },
      { type: 'expense', amount: 60, financialCategoryId: 'transport' },
      { type: 'refund', amount: 20, financialCategoryId: 'food' },
    ]
    expect(calculateCategorySpent('food', transactions)).toBe(175)
  })

  it('derives budget effects by transaction type', () => {
    expect(transactionBudgetEffect({ type: 'expense', amount: 50, financialCategoryId: 'food' })).toBe(50)
    expect(transactionBudgetEffect({ type: 'income', amount: 1000, financialCategoryId: null })).toBe(0)
    expect(transactionBudgetEffect({ type: 'transfer', amount: 300, financialCategoryId: null })).toBe(0)
    expect(transactionBudgetEffect({ type: 'refund', amount: 20, financialCategoryId: 'food' })).toBe(-20)
  })

  it('uses transaction effects for spent and actual remaining', () => {
    const transactions: BudgetTransaction[] = [
      { type: 'expense', amount: 50, financialCategoryId: 'food' },
      { type: 'income', amount: 1000, financialCategoryId: null },
      { type: 'transfer', amount: 300, financialCategoryId: null },
      { type: 'refund', amount: 20, financialCategoryId: 'food' },
    ]
    expect(calculateSpent(transactions)).toBe(30)
    expect(calculateActualRemaining(100, transactions)).toBe(70)
  })
})
