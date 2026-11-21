import { describe, expect, it } from 'vitest'
import { calculateMonthlyRate, estimateCreditCapacity, simulateMortgage, type MortgageInput } from './mortgage-domain'

const base: MortgageInput = { principal: 12000, termYears: 1, annualRate: 0, rateType: 'nominal', compoundingFrequency: 'monthly', startDate: '2026-01-01', monthlyInsurance: 0, monthlyFees: 0, strategy: 'reduce_term' }

describe('mortgage amortization', () => {
  it('splits a zero-interest loan into equal payments without a negative balance', () => {
    const result = simulateMortgage(base)
    expect(result.rows).toHaveLength(12)
    expect(result.totalInterest).toBe(0)
    expect(result.rows.at(-1)?.ordinaryPayment).toBe(1000)
    expect(result.rows.at(-1)?.remainingBalance).toBe(0)
  })
  it('uses nominal and effective annual rates with their respective monthly conversions', () => {
    expect(calculateMonthlyRate(12, 'nominal', 'monthly')).toBeCloseTo(0.01, 10)
    expect(calculateMonthlyRate(12, 'effective', 'monthly')).toBeCloseTo(Math.pow(1.12, 1 / 12) - 1, 10)
  })
  it('applies periodic and one-time extras after the ordinary payment and finishes early', () => {
    const normal = simulateMortgage({ ...base, termYears: 5, annualRate: 6 })
    const withExtras = simulateMortgage({ ...base, termYears: 5, annualRate: 6, periodicExtra: { amount: 500, frequency: 'annual', startMonth: 12 }, oneTimeExtras: [{ month: 6, amount: 300 }], strategy: 'reduce_term' })
    expect(withExtras.rows.length).toBeLessThan(normal.rows.length)
    expect(withExtras.totalInterest).toBeLessThan(normal.totalInterest)
    expect(withExtras.rows.every((row) => row.remainingBalance >= 0)).toBe(true)
  })
  it('recalculates future ordinary payments under reduce-payment strategy', () => {
    const result = simulateMortgage({ ...base, termYears: 2, annualRate: 12, strategy: 'reduce_payment', periodicExtra: { amount: 1000, frequency: 'annual', startMonth: 2 } })
    expect(result.rows).toHaveLength(24)
    expect(result.rows[2]!.ordinaryPayment).toBeLessThan(result.rows[0]!.ordinaryPayment)
  })
  it('caps an extra payment at the remaining balance and adjusts its last payment', () => {
    const result = simulateMortgage({ ...base, principal: 1000, termYears: 10, periodicExtra: { amount: 99999, frequency: 'monthly', startMonth: 1 } })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ remainingBalance: 0, extraPayment: 991.67 })
  })
})

describe('credit capacity', () => {
  it('uses the stricter of payment capacity and financing percentage', () => {
    const result = estimateCreditCapacity({ monthlyIncome: 2000, monthlyDebts: 100, maxIncomePercentage: 30, propertyPrice: 48000, maxFinancingPercentage: 80, termYears: 25, annualRate: 4.99, rateType: 'nominal', compoundingFrequency: 'monthly', requestedCredit: 42000 })
    expect(result.estimatedCredit).toBeLessThanOrEqual(38400)
    expect(result.additionalDownPayment).toBeGreaterThan(0)
  })
})
