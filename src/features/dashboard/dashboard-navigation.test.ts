import { describe, expect, it } from 'vitest'
import {
  budgetHref,
  dashboardPeriodFromSearch,
  projectCreateHref,
  scheduledPaymentHref,
  transactionCreateHref,
} from './dashboard-navigation'

describe('dashboard navigation intents', () => {
  it('preserves the selected period and preselects the requested transaction type', () => {
    expect(transactionCreateHref('2026-10', 'expense')).toBe(
      '/budget/transactions?period=2026-10&create=1&type=expense',
    )
    expect(transactionCreateHref('2026-10', 'income')).toContain('type=income')
    expect(budgetHref('2026-09')).toBe('/budget?period=2026-09')
  })

  it('opens a scheduled payment in the existing module and starts a project creation flow', () => {
    expect(scheduledPaymentHref('2026-10', 'payment-id')).toBe(
      '/budget/scheduled-payments?period=2026-10&payment=payment-id',
    )
    expect(projectCreateHref()).toBe('/projects?create=1')
  })

  it('uses the URL period only when it is a valid monthly period', () => {
    expect(dashboardPeriodFromSearch('2026-10')).toBe('2026-10')
    expect(dashboardPeriodFromSearch('2026-13')).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/)
  })
})
