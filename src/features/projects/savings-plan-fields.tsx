import { useMemo } from 'react'
import {
  calculateSavingsBreakdown,
  type SavingsPlanMovement,
} from '@/utils/budget/savings'
import { useFormatMoney } from '@/utils/format'
import { costInputValue } from '@/utils/form'
import { parseSavingsPlanInput } from './savings-plan-utils'

export function SavingsPlanFields({
  amount,
  accruesInterest,
  interestRate,
  startDate,
  endDate,
  movements = [],
  onAmountChange,
  onAccruesInterestChange,
  onInterestRateChange,
  onStartDateChange,
  onEndDateChange,
}: {
  amount: string
  accruesInterest: boolean
  interestRate: string
  startDate: string
  endDate: string
  movements?: readonly SavingsPlanMovement[]
  onAmountChange: (value: string) => void
  onAccruesInterestChange: (value: boolean) => void
  onInterestRateChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
}) {
  const formatMoney = useFormatMoney()

  const preview = useMemo(() => {
    const plan = parseSavingsPlanInput({
      amount,
      accruesInterest,
      interestRate,
      startDate,
      endDate,
    })
    return calculateSavingsBreakdown(plan, movements)
  }, [amount, accruesInterest, interestRate, startDate, endDate, movements])

  return (
    <fieldset className="stack savings-fieldset">
      <legend>Plan de ahorro</legend>
      <p className="field-hint">
        Aportes mensuales en un periodo, más ingresos/retiros extraordinarios. No sustituye el
        presupuesto/tope del proyecto
        {accruesInterest ? ' (incluye proyección de intereses)' : ''}.
      </p>

      <div className="field">
        <label htmlFor="savings-amount">Ahorro mensual</label>
        <input
          id="savings-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder={costInputValue(null)}
        />
      </div>

      <div className="field">
        <label htmlFor="savings-start">Desde</label>
        <input
          id="savings-start"
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="savings-end">Hasta</label>
        <input
          id="savings-end"
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(event) => onEndDateChange(event.target.value)}
        />
      </div>

      <div className="field checkbox-field">
        <input
          id="savings-interest"
          type="checkbox"
          checked={accruesInterest}
          onChange={(event) => onAccruesInterestChange(event.target.checked)}
        />
        <label htmlFor="savings-interest">Esta cuenta genera intereses</label>
      </div>

      {accruesInterest ? (
        <div className="field">
          <label htmlFor="savings-rate">Tasa anual (%)</label>
          <input
            id="savings-rate"
            inputMode="decimal"
            value={interestRate}
            onChange={(event) => onInterestRateChange(event.target.value)}
            placeholder="4.5"
          />
        </div>
      ) : null}

      {preview ? (
        <div className="alert savings-preview">
          <p>
            <strong>Total proyectado del plan:</strong> {formatMoney(preview.total)}
          </p>
          <p className="muted">
            {preview.months} meses · aportes {formatMoney(preview.contributions)}
            {preview.extraordinaryNet !== 0
              ? ` · extras ${formatMoney(preview.extraordinaryNet)}`
              : ''}
            {preview.interestEarned > 0
              ? ` · intereses ${formatMoney(preview.interestEarned)}`
              : ''}
          </p>
        </div>
      ) : null}
    </fieldset>
  )
}
