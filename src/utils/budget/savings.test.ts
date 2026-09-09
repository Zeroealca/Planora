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
      extraordinaryNet: 0,
      interestEarned: 0,
      total: 600,
    })
  })

  it('includes extraordinary inflows and outflows inside the window', () => {
    const breakdown = calculateSavingsBreakdown(basePlan, [
      { date: '2026-03-15', amount: 200, type: 'inflow' },
      { date: '2026-05-01', amount: 50, type: 'outflow' },
      { date: '2025-12-01', amount: 999, type: 'inflow' }, // outside window
      { date: '2026-07-01', amount: 999, type: 'inflow' }, // outside window
    ])
    expect(breakdown).toEqual({
      months: 6,
      contributions: 600,
      extraordinaryNet: 150,
      interestEarned: 0,
      total: 750,
    })
  })

  it('matches closed-form annuity when there are no movements', () => {
    const withInterest = {
      ...basePlan,
      savings_accrues_interest: true,
      savings_interest_rate_annual: 12,
    }
    const monthlyRate = 0.12 / 12
    const months = 6
    const payment = 100
    const closedForm =
      Math.round(
        payment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * 100,
      ) / 100
    expect(calculateSavingsBreakdown(withInterest)?.total).toBe(closedForm)
  })

  it('compounds interest after monthly contribution and movements', () => {
    const withInterest = {
      ...basePlan,
      savings_amount: 100,
      savings_accrues_interest: true,
      savings_interest_rate_annual: 12,
      savings_start_date: '2026-01-01',
      savings_end_date: '2026-02-01',
    }
    const withoutExtra = calculateSavingsBreakdown(withInterest)
    const withExtra = calculateSavingsBreakdown(withInterest, [
      { date: '2026-01-10', amount: 100, type: 'inflow' },
    ])
    expect(withoutExtra).not.toBeNull()
    expect(withExtra).not.toBeNull()
    expect(withExtra!.extraordinaryNet).toBe(100)
    expect(withExtra!.total).toBeGreaterThan(withoutExtra!.total)
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
