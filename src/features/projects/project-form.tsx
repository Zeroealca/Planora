import { useState, type FormEvent } from 'react'
import type { Project, SavingsMode } from '@/types/domain'
import { costInputValue, emptyToNull, parseCost } from '@/utils/form'
import { isSavingsGoalProject } from './project-kind'
import { createProject, deleteProject, updateProject } from './project-api'

type CreateKind = 'budget' | 'goal'

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
  const isGoal = project ? isSavingsGoalProject(project.savings_mode) : false
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [icon, setIcon] = useState(project?.icon ?? '')
  const [budget, setBudget] = useState(costInputValue(project?.budget ?? null))
  const [createKind, setCreateKind] = useState<CreateKind>('budget')
  const [useTemplate, setUseTemplate] = useState(false)
  const preset = project?.label_preset ?? 'default'
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (name.trim() === '') {
      setError('El nombre es obligatorio.')
      return
    }

    const parsedBudget = parseCost(budget)
    if (
      !isGoal &&
      createKind !== 'goal' &&
      (Number.isNaN(parsedBudget) || (parsedBudget != null && parsedBudget < 0))
    ) {
      setError('El presupuesto del proyecto no es válido.')
      return
    }

    setSubmitting(true)
    try {
      if (isCreate) {
        const savingsMode: SavingsMode = createKind === 'goal' ? 'goal' : 'none'
        const created = await createProject({
          userId,
          name,
          description: emptyToNull(description),
          icon: emptyToNull(icon),
          budget: createKind === 'goal' ? null : parsedBudget,
          useMoveInTemplate: createKind === 'budget' && useTemplate,
          savingsMode,
        })
        onSaved(created.id)
      } else {
        await updateProject(project.id, {
          name,
          description: emptyToNull(description),
          icon: emptyToNull(icon),
          budget: isGoal ? project.budget : parsedBudget,
          label_preset: preset,
        })
        onSaved(project.id)
      }
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
      {isCreate ? (
        <fieldset className="stack savings-fieldset">
          <legend>Tipo de proyecto</legend>
          <p className="field-hint">
            Esta elección es definitiva: un proyecto de meta de ahorro no se puede convertir
            después en uno de compras, ni al revés.
          </p>
          <div className="savings-mode-options" role="radiogroup" aria-label="Tipo de proyecto">
            <label className="savings-mode-option">
              <input
                type="radio"
                name="project-kind"
                checked={createKind === 'budget'}
                onChange={() => setCreateKind('budget')}
              />
              <span>
                <strong>Compras / presupuesto</strong>
                <span className="muted">
                  Ítems, categorías y tope de gasto. Puedes añadir un plan de ahorro opcional.
                </span>
              </span>
            </label>
            <label className="savings-mode-option">
              <input
                type="radio"
                name="project-kind"
                checked={createKind === 'goal'}
                onChange={() => setCreateKind('goal')}
              />
              <span>
                <strong>Meta de ahorro</strong>
                <span className="muted">
                  Cómo y cuándo reunir dinero (objetivo + reserva). Queda fijo para siempre.
                </span>
              </span>
            </label>
          </div>
        </fieldset>
      ) : isGoal ? (
        <p className="alert" role="status">
          Proyecto de <strong>meta de ahorro</strong> (tipo fijo).
        </p>
      ) : null}

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

      {!isGoal && (isCreate ? createKind === 'budget' : true) ? (
        <div className="field">
          <label htmlFor="project-budget">Presupuesto del proyecto</label>
          <input
            id="project-budget"
            inputMode="decimal"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            placeholder="Tope que puedes o quieres gastar"
          />
          <p className="field-hint">Cuánto puedes o quieres gastar en las compras de este proyecto.</p>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="project-icon">Icono (emoji, opcional)</label>
        <input
          id="project-icon"
          value={icon}
          onChange={(event) => setIcon(event.target.value)}
        />
      </div>

      {isCreate && createKind === 'budget' ? (
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
