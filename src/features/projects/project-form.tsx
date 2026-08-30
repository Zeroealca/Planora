import { useState, type FormEvent } from 'react'
import type { Project } from '@/types/domain'
import { emptyToNull } from '@/utils/form'
import { createProject, deleteProject, updateProject } from './project-api'
import { SavingsPlanFields } from './savings-plan-fields'
import {
  parseSavingsPlanInput,
  savingsPlanFromProject,
  validateSavingsPlan,
} from './savings-plan-utils'
import { costInputValue } from '@/utils/form'

export function ProjectForm({
  userId,
  project,
  onSaved,
  onDeleted,
}: {
  userId: string
  project?: Project
  onSaved: (projectId: string) => void
  onDeleted?: () => void
}) {
  const isCreate = project == null
  const initialSavings = savingsPlanFromProject(project)
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [icon, setIcon] = useState(project?.icon ?? '')
  const [useTemplate, setUseTemplate] = useState(false)
  const preset = project?.label_preset ?? 'default'
  const [savingsAmount, setSavingsAmount] = useState(
    costInputValue(initialSavings.savings_amount),
  )
  const [savingsStart, setSavingsStart] = useState(initialSavings.savings_start_date ?? '')
  const [savingsEnd, setSavingsEnd] = useState(initialSavings.savings_end_date ?? '')
  const [savingsInterest, setSavingsInterest] = useState(
    initialSavings.savings_accrues_interest,
  )
  const [savingsRate, setSavingsRate] = useState(
    costInputValue(initialSavings.savings_interest_rate_annual),
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (name.trim() === '') {
      setError('El nombre es obligatorio.')
      return
    }

    if (isCreate) {
      const savings = parseSavingsPlanInput({
        amount: savingsAmount,
        accruesInterest: savingsInterest,
        interestRate: savingsRate,
        startDate: savingsStart,
        endDate: savingsEnd,
      })
      const savingsError = validateSavingsPlan(savings)
      if (savingsError) {
        setError(savingsError)
        return
      }

      setSubmitting(true)
      try {
        const created = await createProject({
          userId,
          name,
          description: emptyToNull(description),
          icon: emptyToNull(icon),
          useMoveInTemplate: useTemplate,
          savings,
        })
        onSaved(created.id)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'No se pudo guardar el proyecto.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    setSubmitting(true)
    try {
      await updateProject(project.id, {
        name,
        description: emptyToNull(description),
        icon: emptyToNull(icon),
        label_preset: preset,
      })
      onSaved(project.id)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo guardar el proyecto.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete() {
    if (!project || !onDeleted) return
    if (!window.confirm(`¿Eliminar el proyecto “${project.name}” y todos sus datos?`)) {
      return
    }
    try {
      await deleteProject(project.id)
      onDeleted()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="project-name">Nombre</label>
        <input
          id="project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="project-description">Descripción (opcional)</label>
        <textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </div>

      {isCreate ? (
        <SavingsPlanFields
          amount={savingsAmount}
          accruesInterest={savingsInterest}
          interestRate={savingsRate}
          startDate={savingsStart}
          endDate={savingsEnd}
          onAmountChange={setSavingsAmount}
          onAccruesInterestChange={setSavingsInterest}
          onInterestRateChange={setSavingsRate}
          onStartDateChange={setSavingsStart}
          onEndDateChange={setSavingsEnd}
        />
      ) : null}

      <div className="field">
        <label htmlFor="project-icon">Icono (emoji, opcional)</label>
        <input
          id="project-icon"
          value={icon}
          onChange={(event) => setIcon(event.target.value)}
        />
      </div>
      {isCreate ? (
        <div className="field checkbox-field">
          <input
            id="project-template"
            type="checkbox"
            checked={useTemplate}
            onChange={(event) => setUseTemplate(event.target.checked)}
          />
          <label htmlFor="project-template">
            Usar plantilla “Amueblar mi casa” (categorías y prioridades de ejemplo)
          </label>
        </div>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : isCreate ? 'Crear proyecto' : 'Guardar proyecto'}
      </button>
      {project && onDeleted ? (
        <button type="button" className="btn btn-danger" onClick={() => void onDelete()}>
          Eliminar proyecto
        </button>
      ) : null}
    </form>
  )
}
