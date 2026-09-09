import { useState } from 'react'
import {
  duplicateProject,
  type DuplicateProjectMode,
} from '@/features/projects/project-api'

export function ProjectDuplicatePanel({
  projectId,
  projectName,
  userId,
  isGoalProject = false,
  onDuplicated,
  onCancel,
}: {
  projectId: string
  projectName: string
  userId: string
  isGoalProject?: boolean
  onDuplicated: (newProjectId: string) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<DuplicateProjectMode>(
    isGoalProject ? 'config' : 'full',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    setBusy(true)
    setError(null)
    try {
      const created = await duplicateProject(
        projectId,
        userId,
        isGoalProject ? 'config' : mode,
      )
      onDuplicated(created.id)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo duplicar el proyecto.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack card" role="group" aria-labelledby="duplicate-heading">
      <h2 id="duplicate-heading">Duplicar proyecto</h2>
      <p className="muted">
        Se creará una copia de <strong>{projectName}</strong>.
      </p>

      <fieldset className="stack duplicate-mode-fieldset">
        <legend>Qué quieres copiar</legend>
        {!isGoalProject ? (
          <label className="duplicate-mode-option">
            <input
              type="radio"
              name="duplicate-mode"
              value="full"
              checked={mode === 'full'}
              disabled={busy}
              onChange={() => setMode('full')}
            />
            <span>
              <strong>Todo</strong>
              <span className="muted">
                {' '}
                — configuración, categorías e ítems (con opciones).
              </span>
            </span>
          </label>
        ) : null}
        <label className="duplicate-mode-option">
          <input
            type="radio"
            name="duplicate-mode"
            value="config"
            checked={mode === 'config' || isGoalProject}
            disabled={busy}
            onChange={() => setMode('config')}
          />
          <span>
            <strong>{isGoalProject ? 'Meta y movimientos' : 'Solo configuración'}</strong>
            <span className="muted">
              {isGoalProject
                ? ' — copia la meta de ahorro y sus movimientos (sin convertir el tipo).'
                : ' — presupuesto, ahorros, estados, prioridades y categorías (sin ítems).'}
            </span>
          </span>
        </label>
      </fieldset>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void onConfirm()}
        >
          {busy ? 'Duplicando…' : 'Duplicar'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
