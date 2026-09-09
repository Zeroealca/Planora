import { describe, expect, it } from 'vitest'
import {
  compareSavingsProjections,
  describeMonthsDelta,
  formatYearMonthLabel,
  projectSavingsGoal,
  requiredSavings,
  type SavingsGoalConfig,
  type SavingsMovementInput,
} from './savings-goal'

const autoExample: SavingsGoalConfig = {
  enabled: true,
  initialBalance: 8444.19,
  targetAmount: 12000,
  minimumReserve: 2000,
  monthlyContribution: 1408.33,
  startDate: '2027-04-01',
}

describe('savings goal projection', () => {
  it('computes required savings as target + reserve', () => {
    expect(requiredSavings(12000, 2000)).toBe(14000)
  })

  it('matches the auto example without movements', () => {
    const result = projectSavingsGoal(autoExample)
    expect(result).not.toBeNull()
    expect(result!.requiredSavings).toBe(14000)
    expect(result!.monthsNeeded).toBe(4)
    expect(result!.viableYearMonth).toBe('2027-08')
    expect(result!.projectedBalance).toBe(14077.51)
    expect(result!.remainingAfterGoal).toBe(2077.51)
    expect(formatYearMonthLabel(result!.viableYearMonth)).toMatch(/agosto.*2027/i)
  })

  it('applies extraordinary inflows and outflows', () => {
    const movements: SavingsMovementInput[] = [
      {
        name: 'Décimo cuarto',
        date: '2027-08-15',
        amount: 482,
        type: 'inflow',
      },
      {
        name: 'Décimo tercero',
        date: '2027-12-01',
        amount: 1300,
        type: 'inflow',
      },
      {
        name: 'Trámites',
        date: '2027-12-10',
        amount: 500,
        type: 'outflow',
      },
    ]

    const withMovements = projectSavingsGoal(autoExample, movements)
    const without = projectSavingsGoal(autoExample)
    expect(withMovements).not.toBeNull()
    expect(without).not.toBeNull()
    // August inflow helps the August balance.
    expect(withMovements!.projectedBalance).toBe(
      roundAdd(without!.projectedBalance, 482),
    )
    expect(withMovements!.viableYearMonth).toBe('2027-08')
  })

  it('can reach the goal earlier with a large early inflow', () => {
    const movements: SavingsMovementInput[] = [
      {
        name: 'Bono',
        date: '2027-05-01',
        amount: 5000,
        type: 'inflow',
      },
    ]
    const result = projectSavingsGoal(autoExample, movements)
    expect(result).not.toBeNull()
    expect(result!.monthsNeeded).toBeLessThan(4)
    expect(result!.viableYearMonth).toBe('2027-05')
  })

  it('returns null when unreachable', () => {
    expect(
      projectSavingsGoal({
        ...autoExample,
        monthlyContribution: 0,
        initialBalance: 100,
        targetAmount: 5000,
        minimumReserve: 0,
      }),
    ).toBeNull()
  })

  it('compares simulation vs actual month delta', () => {
    const actual = projectSavingsGoal(autoExample)
    const simulation = projectSavingsGoal({
      ...autoExample,
      monthlyContribution: 2000,
    })
    const comparison = compareSavingsProjections(actual, simulation)
    expect(actual!.monthsNeeded).toBe(4)
    expect(simulation!.monthsNeeded).toBe(3)
    expect(comparison.monthsDelta).toBe(-1)
    expect(describeMonthsDelta(comparison.monthsDelta)).toBe('1 mes antes')
    expect(simulation!.viableYearMonth).toBe('2027-07')
  })
})

function roundAdd(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100
}
