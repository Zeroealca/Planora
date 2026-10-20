import { describe, expect, it } from 'vitest'
import { updateTransactionPeriodParams } from '@/features/transactions/period-navigation'

describe('updateTransactionPeriodParams', () => {
  it('keeps navigation context while replacing the selected period', () => {
    const next = updateTransactionPeriodParams(
      new URLSearchParams('period=2026-09&category=food&create=1&transaction=transaction-1'),
      '2026-10',
    )

    expect(next.toString()).toBe('period=2026-10&category=food&create=1')
  })
})
