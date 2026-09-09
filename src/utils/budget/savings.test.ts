import { describe, expect, it } from 'vitest'
import {
  calculateSavingsBreakdown,
  calculateSavingsBudget,
  countSavingsMonths,
  isSavingsPlanComplete,
  resolveProjectBudget,
} from './savings'

const basePlan = {
  savings_amount: 100,
  savings_accrues_interest: false,
  savings_interest_rate_annual: null,
  savings_start_date: '2026-01-01',
  savings_end_date: '2026-06-01',
}

describe('savings calculations', () => {
  it('counts inclusive calendar months', () => {
    expect(countSavingsMonths('2026-01-01', '2026-01-31')).toBe(1)
    expect(countSavingsMonths('2026-01-01', '2026-06-01')).toBe(6)
    expect(countSavingsMonths('2026-06-01', '2026-01-01')).toBe(0)
  })

  it('calculates budget without interest', () => {
    expect(calculateSavingsBudget(basePlan)).toBe(600)
    expect(calculateSavingsBreakdown(basePlan)).toEqual({
      months: 6,
      contributions: 600,
      interestEarned: 0,
      total: 600,
    })
  })

  it('calculates budget with monthly compound interest', () => {
    const withInterest = {
      ...basePlan,
      savings_accrues_interest: true,
      savings_interest_rate_annual: 12,
    }
    const breakdown = calculateSavingsBreakdown(withInterest)
    expect(breakdown).not.toBeNull()
    expect(breakdown!.total).toBeGreaterThan(600)
    expect(breakdown!.interestEarned).toBeGreaterThan(0)
    expect(breakdown!.contributions).toBe(600)
  })

  it('requires a complete plan', () => {
    expect(isSavingsPlanComplete({ ...basePlan, savings_amount: null })).toBe(false)
    expect(isSavingsPlanComplete({ ...basePlan, savings_start_date: null })).toBe(false)
    expect(
      isSavingsPlanComplete({
        ...basePlan,
        savings_accrues_interest: true,
        savings_interest_rate_annual: null,
      }),
    ).toBe(false)
  })

  it('uses projects.budget only and ignores savings totals', () => {
    expect(
      resolveProjectBudget({
        ...basePlan,
        budget: 999,
      }),
    ).toBe(999)
    expect(
      resolveProjectBudget({
        ...basePlan,
        budget: null,
      }),
    ).toBeNull()
  })

  it('returns manual budget when present', () => {
    expect(
      resolveProjectBudget({
        budget: 1500,
      }),
    ).toBe(1500)
  })
})
