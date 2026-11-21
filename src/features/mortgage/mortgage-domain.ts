import { fromCents, toCents, type Cents } from '@/features/monthly-budget/money'

export type InterestRateType = 'nominal' | 'effective'
export type CompoundingFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual'
export type ExtraPaymentFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual'
export type RepaymentStrategy = 'reduce_term' | 'reduce_payment'
export type CreditCapacityMethod = 'after_debts' | 'total_obligations'

export type ExtraPayment = { month: number; amount: number }

export type MortgageInput = {
  principal: number
  termYears: number
  annualRate: number
  rateType: InterestRateType
  compoundingFrequency: CompoundingFrequency
  startDate: string
  monthlyInsurance: number
  monthlyFees: number
  strategy: RepaymentStrategy
  periodicExtra?: { amount: number; frequency: ExtraPaymentFrequency; startMonth: number } | null
  oneTimeExtras?: readonly ExtraPayment[]
}

export type AmortizationRow = {
  month: number
  date: string
  ordinaryPayment: number
  principalPayment: number
  interest: number
  extraPayment: number
  remainingBalance: number
}

export type MortgageSimulation = {
  monthlyRate: number
  initialMonthlyPayment: number
  totalInterest: number
  totalPrincipal: number
  totalExtraPayments: number
  totalDisbursed: number
  monthlyPaymentWithCosts: number
  payoffDate: string
  rows: AmortizationRow[]
}

export type CreditCapacityInput = {
  monthlyIncome: number
  monthlyDebts: number
  maxIncomePercentage: number
  propertyPrice: number
  maxFinancingPercentage: number
  termYears: number
  annualRate: number
  rateType: InterestRateType
  compoundingFrequency: CompoundingFrequency
  requestedCredit: number
  calculationMethod?: CreditCapacityMethod
}

export type CreditCapacity = {
  monthlyPaymentCapacity: number
  maximumByPayment: number
  maximumByFinancing: number
  estimatedCredit: number
  requestedDifference: number
  additionalDownPayment: number
}

const frequencyMonths: Record<ExtraPaymentFrequency | CompoundingFrequency, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
}

function roundCents(value: number): Cents { return toCents(value) }
function asMoney(cents: Cents): number { return fromCents(cents) }
function nonNegative(value: number): number { return Number.isFinite(value) && value > 0 ? value : 0 }

export function calculateMonthlyRate(
  annualRate: number,
  rateType: InterestRateType,
  compoundingFrequency: CompoundingFrequency,
): number {
  const annual = nonNegative(annualRate) / 100
  if (annual === 0) return 0
  if (rateType === 'effective') return Math.pow(1 + annual, 1 / 12) - 1
  const periods = 12 / frequencyMonths[compoundingFrequency]
  return Math.pow(1 + annual / periods, periods / 12) - 1
}

export function calculatePayment(principal: number, monthlyRate: number, months: number): number {
  if (months <= 0 || principal <= 0) return 0
  if (monthlyRate === 0) return asMoney(roundCents(principal / months))
  return asMoney(roundCents(principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months))))
}

function addMonths(isoDate: string, months: number): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? new Date(`${isoDate}T12:00:00`) : new Date(`${isoDate}-01T12:00:00`)
  date.setMonth(date.getMonth() + months)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function extraForMonth(input: MortgageInput, month: number, balance: Cents): Cents {
  let requested = 0
  const recurring = input.periodicExtra
  if (recurring && recurring.amount > 0 && month >= recurring.startMonth && (month - recurring.startMonth) % frequencyMonths[recurring.frequency] === 0) requested += recurring.amount
  for (const extra of input.oneTimeExtras ?? []) if (extra.month === month) requested += nonNegative(extra.amount)
  return Math.min(balance, roundCents(requested))
}

/** French amortization. Every row is rounded to cents and extras are applied after its ordinary payment. */
export function simulateMortgage(input: MortgageInput): MortgageSimulation {
  const months = Math.max(0, Math.round(nonNegative(input.termYears) * 12))
  const monthlyRate = calculateMonthlyRate(input.annualRate, input.rateType, input.compoundingFrequency)
  let balance = roundCents(nonNegative(input.principal))
  let payment = calculatePayment(asMoney(balance), monthlyRate, months)
  let interestTotal = 0
  let principalTotal = 0
  let extrasTotal = 0
  const rows: AmortizationRow[] = []
  const maxRows = Math.max(months, 1) + 1200

  for (let month = 1; balance > 0 && month <= maxRows; month += 1) {
    const remainingMonths = Math.max(1, months - month + 1)
    if (input.strategy === 'reduce_payment' && month > 1) payment = calculatePayment(asMoney(balance), monthlyRate, remainingMonths)
    const interest = roundCents(asMoney(balance) * monthlyRate)
    const due = balance + interest
    const ordinary = Math.min(roundCents(payment), due)
    const principalPayment = Math.min(balance, ordinary - interest)
    balance -= principalPayment
    const extra = extraForMonth(input, month, balance)
    balance -= extra
    interestTotal += interest
    principalTotal += principalPayment + extra
    extrasTotal += extra
    rows.push({ month, date: addMonths(input.startDate, month - 1), ordinaryPayment: asMoney(ordinary), principalPayment: asMoney(principalPayment), interest: asMoney(interest), extraPayment: asMoney(extra), remainingBalance: asMoney(Math.max(0, balance)) })
  }
  const initialPayment = rows[0]?.ordinaryPayment ?? 0
  const monthlyCosts = asMoney(roundCents(nonNegative(input.monthlyInsurance) + nonNegative(input.monthlyFees)))
  return {
    monthlyRate,
    initialMonthlyPayment: initialPayment,
    totalInterest: asMoney(interestTotal),
    totalPrincipal: asMoney(principalTotal),
    totalExtraPayments: asMoney(extrasTotal),
    totalDisbursed: asMoney(interestTotal + principalTotal),
    monthlyPaymentWithCosts: asMoney(roundCents(initialPayment + monthlyCosts)),
    payoffDate: rows.at(-1)?.date ?? input.startDate,
    rows,
  }
}

export function estimateCreditCapacity(input: CreditCapacityInput): CreditCapacity {
  const income = nonNegative(input.monthlyIncome)
  const debts = nonNegative(input.monthlyDebts)
  const percentage = nonNegative(input.maxIncomePercentage) / 100
  const paymentCapacity = input.calculationMethod === 'total_obligations'
    ? Math.max(0, income * percentage - debts)
    : Math.max(0, (income - debts) * percentage)
  const months = Math.max(0, Math.round(nonNegative(input.termYears) * 12))
  const rate = calculateMonthlyRate(input.annualRate, input.rateType, input.compoundingFrequency)
  const maximumByPayment = months === 0 ? 0 : rate === 0 ? paymentCapacity * months : paymentCapacity * (1 - Math.pow(1 + rate, -months)) / rate
  const maximumByFinancing = nonNegative(input.propertyPrice) * Math.min(100, nonNegative(input.maxFinancingPercentage)) / 100
  const estimatedCredit = Math.min(maximumByPayment, maximumByFinancing)
  const requestedDifference = estimatedCredit - nonNegative(input.requestedCredit)
  return {
    monthlyPaymentCapacity: asMoney(roundCents(paymentCapacity)),
    maximumByPayment: asMoney(roundCents(maximumByPayment)),
    maximumByFinancing: asMoney(roundCents(maximumByFinancing)),
    estimatedCredit: asMoney(roundCents(estimatedCredit)),
    requestedDifference: asMoney(roundCents(requestedDifference)),
    additionalDownPayment: asMoney(roundCents(Math.max(0, -requestedDifference))),
  }
}
