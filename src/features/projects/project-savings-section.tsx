import { useState, type FormEvent } from 'react'
import type { Project } from '@/types/domain'
import {
  calculateSavingsBreakdown,
  isSavingsPlanComplete,
  resolveProjectBudget,
} from '@/utils/budget/savings'
import { useFormatMoney } from '@/utils/format'
import { costInputValue } from '@/utils/form'
import { updateProjectSavings } from './project-api'
import { SavingsPlanFields } from './savings-plan-fields'
import {
  parseSavingsPlanInput,
  savingsPlanFromProject,
  validateSavingsPlan,
} from './savings-plan-utils'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function ProjectSavingsSection({
  project,
  onChanged,
}: {
  project: Project
  onChanged: () => void
}) {
  const formatMoney = useFormatMoney()
  const initial = savingsPlanFromProject(project)
  const [amount, setAmount] = useState(costInputValue(initial.savings_amount))
  const [startDate, setStartDate] = useState(initial.savings_start_date ?? '')
  const [endDate, setEndDate] = useState(initial.savings_end_date ?? '')
  const [accruesInterest, setAccruesInterest] = useState(initial.savings_accrues_interest)
  const [interestRate, setInterestRate] = useState(
    costInputValue(initial.savings_interest_rate_annual),
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const currentPlan = parseSavingsPlanInput({
    amount,
    accruesInterest,
    interestRate,
    startDate,
    endDate,
  })
  const planComplete = isSavingsPlanComplete(currentPlan)
  const breakdown = planComplete ? calculateSavingsBreakdown(currentPlan) : null
  const budget = planComplete ? resolveProjectBudget({ ...project, ...currentPlan }) : null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)

    const savingsError = validateSavingsPlan(currentPlan)
    if (savingsError) {
      setError(savingsError)
      return
    }

    setSubmitting(true)
    try {
      await updateProjectSavings(project.id, currentPlan)
      setSaved(true)
      onChanged()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo guardar el plan de ahorro.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="ahorros" className="stack project-section" aria-labelledby="savings-heading">
      <header className="page-header">
        <h2 id="savings-heading">Ahorros</h2>
        <p className="muted">
          Define cuánto ahorrarás cada mes y el periodo. El presupuesto del proyecto se calcula
          automáticamente.
        </p>
      </header>

      <form className="stack" onSubmit={onSubmit}>
        <SavingsPlanFields
          amount={amount}
          accruesInterest={accruesInterest}
          interestRate={interestRate}
          startDate={startDate}
          endDate={endDate}
          onAmountChange={(value) => {
            setAmount(value)
            setSaved(false)
          }}
          onAccruesInterestChange={(value) => {
            setAccruesInterest(value)
            setSaved(false)
          }}
          onInterestRateChange={(value) => {
            setInterestRate(value)
            setSaved(false)
          }}
          onStartDateChange={(value) => {
            setStartDate(value)
            setSaved(false)
          }}
          onEndDateChange={(value) => {
            setEndDate(value)
            setSaved(false)
          }}
        />

        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="alert alert-success" role="status">
            Plan de ahorro guardado.
          </p>
        ) : null}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar plan de ahorro'}
        </button>
      </form>

      {breakdown ? (
        <ul className="plain-list savings-summary">
          <li>
            <span>Periodo</span>
            <span>
              {formatDate(currentPlan.savings_start_date!)} –{' '}
              {formatDate(currentPlan.savings_end_date!)}
            </span>
          </li>
          <li>
            <span>Meses</span>
            <span>{breakdown.months}</span>
          </li>
          <li>
            <span>Aportes totales</span>
            <span>{formatMoney(breakdown.contributions)}</span>
          </li>
          {breakdown.interestEarned > 0 ? (
            <li>
              <span>Intereses ganados</span>
              <span>{formatMoney(breakdown.interestEarned)}</span>
            </li>
          ) : null}
          <li>
            <span>Presupuesto del proyecto</span>
            <strong>{budget == null ? '—' : formatMoney(budget)}</strong>
          </li>
        </ul>
      ) : null}
    </section>
  )
}
