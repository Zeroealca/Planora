import { useState, type FormEvent, type ReactNode } from 'react'
import type {
  ProjectPriorityOption,
  ProjectStatusOption,
  StatusBehavior,
} from '@/features/projects/project-options'
import {
  STATUS_BEHAVIOR_LABELS,
  createPriorityOptionId,
  createStatusOptionId,
  validatePriorityOptions,
  validateStatusOptions,
} from '@/features/projects/project-options'
import {
  updateProjectPriorityOptions,
  updateProjectStatusOptions,
} from './project-options-api'

function reorderOption<T extends { display_order: number }>(
  options: T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const target = index + direction
  if (target < 0 || target >= options.length) return options
  const next = [...options]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  return next.map((option, order) => ({ ...option, display_order: order }))
}

function OptionListEditor<T extends { id: string; label: string; display_order: number }>({
  options,
  onChange,
  renderExtra,
}: {
  options: T[]
  onChange: (next: T[]) => void
  renderExtra?: (option: T, index: number, update: (patch: Partial<T>) => void) => ReactNode
}) {
  return (
    <ul className="plain-list option-editor-list">
      {options.map((option, index) => (
        <li key={option.id} className="option-editor-row">
          <input
            aria-label="Nombre"
            value={option.label}
            onChange={(event) => {
              const next = [...options]
              next[index] = { ...option, label: event.target.value }
              onChange(next)
            }}
          />
          {renderExtra?.(option, index, (patch) => {
            const next = [...options]
            next[index] = { ...next[index]!, ...patch }
            onChange(next)
          })}
          <div className="option-editor-actions">
            <button
              type="button"
              className="btn-icon"
              disabled={index === 0}
              onClick={() => onChange(reorderOption(options, index, -1))}
              aria-label="Subir"
            >
              ↑
            </button>
            <button
              type="button"
              className="btn-icon"
              disabled={index === options.length - 1}
              onClick={() => onChange(reorderOption(options, index, 1))}
              aria-label="Bajar"
            >
              ↓
            </button>
            <button
              type="button"
              className="btn-icon btn-icon-danger"
              disabled={options.length <= 1}
              onClick={() =>
                onChange(
                  options
                    .filter((entry) => entry.id !== option.id)
                    .map((entry, order) => ({ ...entry, display_order: order })),
                )
              }
              aria-label="Eliminar"
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ProjectOptionsSection({
  projectId,
  statusOptions,
  priorityOptions,
  onChanged,
}: {
  projectId: string
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
  onChanged: () => void
}) {
  const [statuses, setStatuses] = useState<ProjectStatusOption[]>([...statusOptions])
  const [priorities, setPriorities] = useState<ProjectPriorityOption[]>([...priorityOptions])
  const [newStatusLabel, setNewStatusLabel] = useState('')
  const [newStatusBehavior, setNewStatusBehavior] = useState<StatusBehavior>('pending')
  const [newPriorityLabel, setNewPriorityLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)

    const statusError = validateStatusOptions(statuses)
    if (statusError) {
      setError(statusError)
      return
    }
    const priorityError = validatePriorityOptions(priorities)
    if (priorityError) {
      setError(priorityError)
      return
    }

    setSubmitting(true)
    try {
      await updateProjectStatusOptions(projectId, statuses)
      await updateProjectPriorityOptions(projectId, priorities)
      setSaved(true)
      onChanged()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las opciones.')
    } finally {
      setSubmitting(false)
    }
  }

  function onAddStatus() {
    if (newStatusLabel.trim() === '') return
    setStatuses([
      ...statuses,
      {
        id: createStatusOptionId(newStatusLabel),
        label: newStatusLabel.trim(),
        behavior: newStatusBehavior,
        display_order: statuses.length,
      },
    ])
    setNewStatusLabel('')
    setSaved(false)
  }

  function onAddPriority() {
    if (newPriorityLabel.trim() === '') return
    setPriorities([
      ...priorities,
      {
        id: createPriorityOptionId(newPriorityLabel),
        label: newPriorityLabel.trim(),
        display_order: priorities.length,
      },
    ])
    setNewPriorityLabel('')
    setSaved(false)
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={onSave}>
        <div className="stack">
          <h3>Estados</h3>
          <OptionListEditor
            options={statuses}
            onChange={(next) => {
              setStatuses(next)
              setSaved(false)
            }}
            renderExtra={(option, _index, update) => (
              <select
                aria-label="Comportamiento del estado"
                value={option.behavior}
                onChange={(event) =>
                  update({ behavior: event.target.value as StatusBehavior })
                }
              >
                {(Object.keys(STATUS_BEHAVIOR_LABELS) as StatusBehavior[]).map((behavior) => (
                  <option key={behavior} value={behavior}>
                    {STATUS_BEHAVIOR_LABELS[behavior]}
                  </option>
                ))}
              </select>
            )}
          />
          <div className="option-editor-add">
            <input
              placeholder="Nuevo estado"
              value={newStatusLabel}
              onChange={(event) => setNewStatusLabel(event.target.value)}
            />
            <select
              value={newStatusBehavior}
              onChange={(event) => setNewStatusBehavior(event.target.value as StatusBehavior)}
            >
              {(Object.keys(STATUS_BEHAVIOR_LABELS) as StatusBehavior[]).map((behavior) => (
                <option key={behavior} value={behavior}>
                  {STATUS_BEHAVIOR_LABELS[behavior]}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={onAddStatus}>
              Añadir
            </button>
          </div>
        </div>

        <div className="stack">
          <h3>Prioridades</h3>
          <OptionListEditor
            options={priorities}
            onChange={(next) => {
              setPriorities(next)
              setSaved(false)
            }}
          />
          <div className="option-editor-add">
            <input
              placeholder="Nueva prioridad"
              value={newPriorityLabel}
              onChange={(event) => setNewPriorityLabel(event.target.value)}
            />
            <button type="button" className="btn" onClick={onAddPriority}>
              Añadir
            </button>
          </div>
        </div>

        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="alert alert-success" role="status">
            Listas actualizadas.
          </p>
        ) : null}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar listas'}
        </button>
      </form>
    </div>
  )
}
