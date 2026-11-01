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
  interestRateType,
  interestCompoundingFrequency,
  startDate,
  endDate,
  movements = [],
  onAmountChange,
  onAccruesInterestChange,
  onInterestRateChange,
  onInterestRateTypeChange,
  onInterestCompoundingFrequencyChange,
  onStartDateChange,
  onEndDateChange,
}: {
  amount: string
  accruesInterest: boolean
  interestRate: string
  interestRateType: 'tea' | 'tna'
  interestCompoundingFrequency:
    'monthly' | 'quarterly' | 'semiannual' | 'annual'
  startDate: string
  endDate: string
  movements?: readonly SavingsPlanMovement[]
  onAmountChange: (value: string) => void
  onAccruesInterestChange: (value: boolean) => void
  onInterestRateChange: (value: string) => void
  onInterestRateTypeChange: (value: 'tea' | 'tna') => void
  onInterestCompoundingFrequencyChange: (
    value: 'monthly' | 'quarterly' | 'semiannual' | 'annual',
  ) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
}) {
  const formatMoney = useFormatMoney()

  const preview = useMemo(() => {
    const plan = parseSavingsPlanInput({
      amount,
      accruesInterest,
      interestRate,
      interestRateType,
      interestCompoundingFrequency,
      startDate,
      endDate,
    })
    return calculateSavingsBreakdown(plan, movements)
  }, [
    amount,
    accruesInterest,
    interestRate,
    interestRateType,
    interestCompoundingFrequency,
    startDate,
    endDate,
    movements,
  ])

  return (
    <fieldset className="stack savings-fieldset">
      <legend>Plan de ahorro</legend>
      <p className="field-hint">
        Aportes mensuales en un periodo, más ingresos/retiros extraordinarios.
        No sustituye el presupuesto/tope del proyecto
        {accruesInterest ? ' (incluye proyección de intereses)' : ''}.
      </p>

      <div className="field">
        <label htmlFor="savings-amount">Ahorro mensual</label>
        <input
          id="savings-amount"
          type="number"
          step="0.01"
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
        <>
          <div className="field">
            <label htmlFor="savings-rate">Tasa anual (%)</label>
            <input
              id="savings-rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={interestRate}
              onChange={(event) => onInterestRateChange(event.target.value)}
              placeholder="4.5"
            />
          </div>
          <div className="field">
            <label htmlFor="savings-rate-type">Tipo de tasa</label>
            <select
              id="savings-rate-type"
              value={interestRateType}
              onChange={(event) =>
                onInterestRateTypeChange(event.target.value as 'tea' | 'tna')
              }
            >
              <option value="tea">TEA (tasa efectiva anual)</option>
              <option value="tna">TNA (tasa nominal anual)</option>
            </select>
            <span className="field-hint">
              TEA ya incorpora la capitalización anual; TNA necesita su
              frecuencia de capitalización.
            </span>
          </div>
          {interestRateType === 'tna' ? (
            <div className="field">
              <label htmlFor="savings-compounding">Capitalización</label>
              <select
                id="savings-compounding"
                value={interestCompoundingFrequency}
                onChange={(event) =>
                  onInterestCompoundingFrequencyChange(
                    event.target.value as
                      'monthly' | 'quarterly' | 'semiannual' | 'annual',
                  )
                }
              >
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="semiannual">Semestral</option>
                <option value="annual">Anual</option>
              </select>
            </div>
          ) : null}
        </>
      ) : null}

      {preview ? (
        <div className="alert savings-preview">
          <p>
            <strong>Total proyectado del plan:</strong>{' '}
            {formatMoney(preview.total)}
          </p>
          <p className="muted">
            {preview.months} meses · aportes{' '}
            {formatMoney(preview.contributions)}
            {preview.extraordinaryNet !== 0
              ? ` · extras ${formatMoney(preview.extraordinaryNet)}`
              : ''}
            {preview.interestEarned > 0
              ? ` · intereses futuros estimados ${formatMoney(preview.interestEarned)}`
              : ''}
          </p>
          <p className="field-hint">
            La simulación coloca los aportes al final de cada mes y no garantiza
            rendimientos.
          </p>
        </div>
      ) : null}
    </fieldset>
  )
}
