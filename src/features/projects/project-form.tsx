import { useState, type FormEvent } from 'react'
import type { LabelPreset, Project } from '@/types/domain'
import { costInputValue, emptyToNull, parseCost } from '@/utils/form'
import { createProject, deleteProject, updateProject } from './project-api'

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
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [budget, setBudget] = useState(costInputValue(project?.budget ?? null))
  const [icon, setIcon] = useState(project?.icon ?? '')
  const [useTemplate, setUseTemplate] = useState(false)
  const [preset, setPreset] = useState<LabelPreset>(project?.label_preset ?? 'default')
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
    if (Number.isNaN(parsedBudget) || (parsedBudget != null && parsedBudget < 0)) {
      setError('El presupuesto debe ser un número mayor o igual a 0.')
      return
    }

    setSubmitting(true)
    try {
      if (project) {
        await updateProject(project.id, {
          name,
          description: emptyToNull(description),
          budget: parsedBudget,
          icon: emptyToNull(icon),
          label_preset: preset,
        })
        onSaved(project.id)
      } else {
        const created = await createProject({
          userId,
          name,
          description: emptyToNull(description),
          budget: parsedBudget,
          icon: emptyToNull(icon),
          useMoveInTemplate: useTemplate,
        })
        onSaved(created.id)
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
      <div className="field">
        <label htmlFor="project-budget">Presupuesto</label>
        <input
          id="project-budget"
          inputMode="decimal"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="project-icon">Icono (emoji, opcional)</label>
        <input
          id="project-icon"
          value={icon}
          onChange={(event) => setIcon(event.target.value)}
        />
      </div>
      {project ? (
        <div className="field">
          <label htmlFor="project-preset">Etiquetas de prioridad</label>
          <select
            id="project-preset"
            value={preset}
            onChange={(event) => setPreset(event.target.value as LabelPreset)}
          >
            <option value="default">Genéricas (Crítica, Alta, Media, Opcional)</option>
            <option value="move_in">Mudanza / primer mes / después</option>
          </select>
        </div>
      ) : (
        <div className="field checkbox-field">
          <input
            id="project-template"
            type="checkbox"
            checked={useTemplate}
            onChange={(event) => setUseTemplate(event.target.checked)}
          />
          <label htmlFor="project-template">
            Usar plantilla “Amueblar mi casa” (categorías de ejemplo)
          </label>
        </div>
      )}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : project ? 'Guardar proyecto' : 'Crear proyecto'}
      </button>
      {project && onDeleted ? (
        <button type="button" className="btn btn-danger" onClick={() => void onDelete()}>
          Eliminar proyecto
        </button>
      ) : null}
    </form>
  )
}
