import {
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { IconGrip, IconTrash } from '@/components/icons'
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

const DRAG_MOVE_THRESHOLD_PX = 4

function moveOption<T extends { display_order: number }>(
  options: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= options.length ||
    toIndex >= options.length
  ) {
    return options
  }
  const next = [...options]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return options
  next.splice(toIndex, 0, moved)
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
  const listRef = useRef<HTMLUListElement>(null)
  const optionsRef = useRef(options)
  const dragIndexRef = useRef<number | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const didMoveRef = useRef(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function endDrag() {
    dragIndexRef.current = null
    pointerStartRef.current = null
    setDragIndex(null)
  }

  function onGripPointerDown(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    didMoveRef.current = false
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    optionsRef.current = options
    dragIndexRef.current = index
    setDragIndex(index)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onGripPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragIndexRef.current === null) return
    event.preventDefault()

    const start = pointerStartRef.current
    if (start) {
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (Math.hypot(dx, dy) > DRAG_MOVE_THRESHOLD_PX) didMoveRef.current = true
    }

    const fromIndex = dragIndexRef.current
    const under = document.elementFromPoint(event.clientX, event.clientY)
    const row = under?.closest('.option-editor-row')
    if (!row || !listRef.current?.contains(row)) return

    const toIndex = Number((row as HTMLElement).dataset.index)
    if (!Number.isFinite(toIndex) || toIndex === fromIndex) return

    const next = moveOption(optionsRef.current, fromIndex, toIndex)
    if (next === optionsRef.current) return

    optionsRef.current = next
    dragIndexRef.current = toIndex
    setDragIndex(toIndex)
    onChange(next)
  }

  function onGripPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragIndexRef.current === null) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    endDrag()
  }

  function onGripClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (!didMoveRef.current) return
    event.preventDefault()
    event.stopPropagation()
    didMoveRef.current = false
  }

  return (
    <ul
      ref={listRef}
      className={['plain-list', 'option-editor-list', dragIndex !== null ? 'is-reordering' : '']
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((option, index) => (
        <li
          key={option.id}
          data-index={index}
          className={[
            'option-editor-row',
            dragIndex === index ? 'option-editor-row-dragging' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <button
            type="button"
            className="option-editor-grip"
            title="Arrastrar para reordenar"
            aria-label={`Reordenar ${option.label}`}
            onPointerDown={(event) => onGripPointerDown(index, event)}
            onPointerMove={onGripPointerMove}
            onPointerUp={onGripPointerUp}
            onPointerCancel={onGripPointerUp}
            onClick={onGripClick}
          >
            <IconGrip />
          </button>
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
              className="btn-icon btn-icon-danger"
              disabled={options.length <= 1}
              onClick={() =>
                onChange(
                  options
                    .filter((entry) => entry.id !== option.id)
                    .map((entry, order) => ({ ...entry, display_order: order })),
                )
              }
              aria-label={`Eliminar ${option.label}`}
              title="Eliminar"
            >
              <IconTrash />
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
        <div className="options-columns">
          <section className="card stack options-column" aria-labelledby="statuses-heading">
            <div>
              <h3 id="statuses-heading">Estados</h3>
              <p className="muted">Arrastra para cambiar el orden.</p>
            </div>
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
                aria-label="Nuevo estado"
              />
              <select
                value={newStatusBehavior}
                onChange={(event) => setNewStatusBehavior(event.target.value as StatusBehavior)}
                aria-label="Comportamiento del nuevo estado"
              >
                {(Object.keys(STATUS_BEHAVIOR_LABELS) as StatusBehavior[]).map((behavior) => (
                  <option key={behavior} value={behavior}>
                    {STATUS_BEHAVIOR_LABELS[behavior]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                disabled={newStatusLabel.trim() === ''}
                onClick={onAddStatus}
              >
                Añadir
              </button>
            </div>
          </section>

          <section className="card stack options-column" aria-labelledby="priorities-heading">
            <div>
              <h3 id="priorities-heading">Prioridades</h3>
              <p className="muted">Arrastra para cambiar el orden.</p>
            </div>
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
                aria-label="Nueva prioridad"
              />
              <button
                type="button"
                className="btn"
                disabled={newPriorityLabel.trim() === ''}
                onClick={onAddPriority}
              >
                Añadir
              </button>
            </div>
          </section>
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
