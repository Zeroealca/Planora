import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import {
  fetchProjectBundle,
  fetchProjects,
  type ProjectListEntry,
} from '@/features/projects/project-api'
import {
  DEFAULT_PRIORITY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
} from '@/features/projects/project-options'
import { costInputValue, parseCost } from '@/utils/form'
import {
  applyDuplicateAction,
  applyRowSelected,
  buildPreviewRows,
  rebuildPreviewAfterDraftEdit,
  type DraftEditField,
  type PreviewContext,
} from './build-preview'
import { commitImport } from './commit-import'
import { parseCsv } from './csv-parse'
import {
  canConfirmImport,
  computeImportSummary,
} from './import-summary'
import type {
  DuplicateAction,
  ImportDestination,
  MappedDraft,
  PreviewRow,
} from './import-types'
import { mapCsvToDrafts } from './map-row'
import { problemsLabel } from './validate-preview'

type Step = 'upload' | 'destination' | 'preview' | 'done'

export function ImportWizard({
  lockedProjectId = null,
}: {
  /** When set, import always targets this existing project and skips destination choice. */
  lockedProjectId?: string | null
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const destinationLocked = Boolean(lockedProjectId)
  const [step, setStep] = useState<Step>('upload')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [drafts, setDrafts] = useState<MappedDraft[]>([])
  const [suggestedBudget, setSuggestedBudget] = useState<number | null>(null)

  const [destMode, setDestMode] = useState<'new' | 'existing'>(
    destinationLocked ? 'existing' : 'new',
  )
  const [newName, setNewName] = useState('')
  const [newBudget, setNewBudget] = useState('')
  const [projects, setProjects] = useState<ProjectListEntry[] | null>(null)
  const [existingProjectId, setExistingProjectId] = useState(lockedProjectId ?? '')
  const [lockedProjectName, setLockedProjectName] = useState<string | null>(null)

  const [rows, setRows] = useState<PreviewRow[]>([])
  const [previewContext, setPreviewContext] = useState<PreviewContext | null>(null)
  const [resultProjectId, setResultProjectId] = useState<string | null>(null)
  const [resultSummary, setResultSummary] = useState<
    ReturnType<typeof computeImportSummary> | null
  >(null)

  useEffect(() => {
    let cancelled = false
    void fetchProjects().then(
      (data) => {
        if (cancelled) return
        setProjects(data)
        if (lockedProjectId) {
          const match = data.find((p) => p.id === lockedProjectId)
          setLockedProjectName(match?.name ?? null)
        }
      },
      (err: unknown) => {
        if (!cancelled) {
          console.error(err)
          setProjects([])
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [lockedProjectId])

  const activeDestMode = destinationLocked ? 'existing' : destMode
  const activeExistingProjectId = destinationLocked
    ? (lockedProjectId ?? '')
    : existingProjectId
  const displayLockedName =
    lockedProjectName ??
    projects?.find((p) => p.id === lockedProjectId)?.name ??
    null

  async function previewForExistingProject(
    projectId: string,
    draftRows: MappedDraft[],
  ) {
    setBusy(true)
    setError(null)
    try {
      const bundle = await fetchProjectBundle(projectId)
      if (destinationLocked) {
        setLockedProjectName(bundle.project.name)
      }
      const context: PreviewContext = {
        categories: bundle.categories,
        items: bundle.items,
        statusOptions: bundle.project.status_options,
        priorityOptions: bundle.project.priority_options,
      }
      setPreviewContext(context)
      setRows(
        buildPreviewRows({
          drafts: draftRows,
          ...context,
        }),
      )
      setStep('preview')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo cargar el proyecto.')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File) {
    setError(null)
    try {
      const text = await file.text()
      const table = parseCsv(text)
      if (table.headers.length === 0) {
        setError('El CSV no tiene encabezados.')
        return
      }
      const mapped = mapCsvToDrafts(table)
      if (mapped.drafts.length === 0) {
        setError('El CSV no tiene filas de datos.')
        return
      }
      setDrafts(mapped.drafts)
      setSuggestedBudget(mapped.suggestedProjectBudget)
      if (mapped.suggestedProjectBudget != null) {
        setNewBudget(costInputValue(mapped.suggestedProjectBudget))
      }

      if (destinationLocked && lockedProjectId) {
        await previewForExistingProject(lockedProjectId, mapped.drafts)
        return
      }
      setStep('destination')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo leer el CSV.')
    }
  }

  async function goPreview() {
    setError(null)
    if (activeDestMode === 'new') {
      if (newName.trim() === '') {
        setError('Indica el nombre del proyecto.')
        return
      }
      const budget = parseCost(newBudget)
      if (newBudget.trim() !== '' && (budget == null || Number.isNaN(budget) || budget < 0)) {
        setError('Presupuesto inválido.')
        return
      }
      const context: PreviewContext = {
        categories: [],
        items: [],
        statusOptions: DEFAULT_STATUS_OPTIONS,
        priorityOptions: DEFAULT_PRIORITY_OPTIONS,
      }
      setPreviewContext(context)
      setRows(
        buildPreviewRows({
          drafts,
          ...context,
        }),
      )
      setStep('preview')
      return
    }

    if (!activeExistingProjectId) {
      setError('Elige un proyecto destino.')
      return
    }
    await previewForExistingProject(activeExistingProjectId, drafts)
  }

  async function onConfirm() {
    if (!user) return
    setError(null)
    setBusy(true)
    try {
      const destination: ImportDestination =
        activeDestMode === 'new'
          ? {
              mode: 'new',
              name: newName.trim(),
              budget: (() => {
                const n = parseCost(newBudget)
                return newBudget.trim() === '' || n == null || Number.isNaN(n) ? null : n
              })(),
            }
          : {
              mode: 'existing',
              projectId: activeExistingProjectId,
            }

      const result = await commitImport({
        userId: user.id,
        destination,
        rows,
      })
      setResultProjectId(result.projectId)
      setResultSummary(result.summary)
      setStep('done')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'La importación falló.')
    } finally {
      setBusy(false)
    }
  }

  const summary = computeImportSummary(rows)

  if (!user) return null

  return (
    <div className="stack import-wizard">
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      {step === 'upload' ? (
        <section className="stack">
          {destinationLocked ? (
            <p className="alert" role="status">
              Subida masiva al proyecto{' '}
              <strong>{displayLockedName ?? '…'}</strong>.
            </p>
          ) : null}
          <p className="muted">
            Sube un CSV exportado desde Excel (UTF-8). Encabezados admitidos:
            Estado, Prioridad, Categoria, Producto, Presupuesto objetivo, Precio
            real, Tienda, Enlace, Fecha compra, Notas.
          </p>
          <div className="field">
            <label htmlFor="import-csv">Archivo CSV</label>
            <input
              id="import-csv"
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onFile(file)
              }}
            />
          </div>
          {busy ? <p className="page-status">Preparando vista previa…</p> : null}
        </section>
      ) : null}

      {step === 'destination' && !destinationLocked ? (
        <section className="stack">
          <fieldset className="stack">
            <legend>Destino</legend>
            <label className="checkbox-field">
              <input
                type="radio"
                name="dest"
                checked={destMode === 'new'}
                onChange={() => setDestMode('new')}
              />
              Crear proyecto nuevo
            </label>
            <label className="checkbox-field">
              <input
                type="radio"
                name="dest"
                checked={destMode === 'existing'}
                onChange={() => setDestMode('existing')}
              />
              Añadir a un proyecto existente
            </label>
          </fieldset>

          {destMode === 'new' ? (
            <>
              <div className="field">
                <label htmlFor="import-project-name">Nombre del proyecto</label>
                <input
                  id="import-project-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="import-project-budget">Presupuesto disponible</label>
                <input
                  id="import-project-budget"
                  inputMode="decimal"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                />
                {suggestedBudget != null ? (
                  <p className="field-hint">
                    Sugerido desde el CSV: {suggestedBudget}. Confirma o edita.
                  </p>
                ) : (
                  <p className="field-hint">
                    No se infiere sumando ítems. Déjalo vacío si aún no lo defines.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor="import-existing-project">Proyecto destino</label>
              <select
                id="import-existing-project"
                value={existingProjectId}
                onChange={(e) => setExistingProjectId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setStep('upload')
                setDrafts([])
              }}
            >
              Atrás
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void goPreview()}
            >
              {busy ? 'Cargando…' : 'Vista previa'}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'preview' ? (
        <section className="stack">
          {destinationLocked ? (
            <p className="muted">
              Destino: <strong>{displayLockedName ?? 'proyecto seleccionado'}</strong>
            </p>
          ) : null}
          <p className="muted">
            Revisa y edita los valores, desmarca filas y resuelve duplicados. Nada se
            guarda hasta confirmar.
          </p>

          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th scope="col">Importar</th>
                  <th scope="col">Producto</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Prioridad</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Presupuesto</th>
                  <th scope="col">Precio planeado</th>
                  <th scope="col">Precio pagado</th>
                  <th scope="col">Tienda</th>
                  <th scope="col">Problemas</th>
                  <th scope="col">Duplicado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <PreviewTableRow
                    key={row.id}
                    row={row}
                    context={previewContext}
                    onSelected={(selected) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? applyRowSelected(r, selected) : r,
                        ),
                      )
                    }
                    onDuplicateAction={(action) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? applyDuplicateAction(r, action) : r,
                        ),
                      )
                    }
                    onFieldChange={(field, value) => {
                      if (!previewContext) return
                      setRows((prev) =>
                        rebuildPreviewAfterDraftEdit({
                          rows: prev,
                          rowId: row.id,
                          field,
                          value,
                          context: previewContext,
                        }),
                      )
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-summary stack" aria-live="polite">
            <p>
              {summary.itemsImported} items a importar · {summary.itemsOmitted}{' '}
              omitidos · {summary.optionsCreated} opciones
            </p>
            <p className="muted">
              {summary.categoriesCreated} categorías · {summary.prioritiesCreated}{' '}
              prioridades · {summary.warningRows} advertencias ·{' '}
              {summary.errorRows} errores
            </p>
            <p className="field-hint">
              Al confirmar se valida el modelo completo antes de escribir. Si falla
              un paso crítico, se revierten los cambios parciales. El dashboard se
              calculará después con las reglas de Planora (no se importa desde el
              CSV).
            </p>
          </div>

          <div className="row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setStep(destinationLocked ? 'upload' : 'destination')
              }
            >
              Atrás
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !canConfirmImport(summary)}
              onClick={() => void onConfirm()}
            >
              {busy ? 'Importando…' : 'Confirmar importación'}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'done' && resultProjectId && resultSummary ? (
        <section className="stack import-done">
          <div className="alert alert-success" role="status">
            <h2 className="import-done-title">Importación completada</h2>
            <ul className="import-done-stats">
              <li>{resultSummary.itemsImported} items importados</li>
              <li>{resultSummary.categoriesCreated} categorías</li>
              <li>{resultSummary.prioritiesCreated} prioridades</li>
              <li>{resultSummary.optionsCreated} opciones de compra</li>
              <li>{resultSummary.itemsOmitted} items omitidos</li>
              <li>{resultSummary.warningRows} advertencias</li>
            </ul>
          </div>
          <p className="muted">
            El dashboard no se importa desde el CSV: Planora calcula solo
            presupuesto original, costo proyectado, gastado, pendiente, saldo
            proyectado, ahorro y progreso con las reglas financieras actuales.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void navigate(`/projects/${resultProjectId}`)}
            >
              Ver proyecto
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                void navigate(
                  `/projects/${resultProjectId}?tab=items&attention=needs_attention`,
                )
              }
            >
              Ver items que necesitan atención
            </button>
          </div>
          <Link to="/projects" className="btn btn-ghost">
            Volver a proyectos
          </Link>
        </section>
      ) : null}
    </div>
  )
}

function moneyInputValue(value: number | null): string {
  return value == null ? '' : String(value)
}

function PreviewTableRow(props: {
  row: PreviewRow
  context: PreviewContext | null
  onSelected: (selected: boolean) => void
  onDuplicateAction: (action: DuplicateAction) => void
  onFieldChange: (field: DraftEditField, value: string) => void
}) {
  const { row, context, onSelected, onDuplicateAction, onFieldChange } = props
  const statusOptions = context?.statusOptions ?? []
  const priorityOptions = context?.priorityOptions ?? []
  const categories = context?.categories ?? []
  const categoryListId = `import-cat-${row.id}`
  const label = row.draft.name || `fila ${row.draft.rowIndex}`

  return (
    <>
      <tr
        className={
          row.severity === 'error'
            ? 'import-row-error'
            : row.severity === 'warning'
              ? 'import-row-warning'
              : undefined
        }
      >
        <td>
          <input
            type="checkbox"
            checked={row.selected}
            disabled={row.severity === 'error'}
            aria-label={`Importar ${label}`}
            onChange={(e) => onSelected(e.target.checked)}
          />
        </td>
        <td>
          <input
            className="import-cell-input"
            aria-label={`Producto ${label}`}
            value={row.draft.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
          />
        </td>
        <td>
          <input
            className="import-cell-input"
            list={categoryListId}
            aria-label={`Categoría ${label}`}
            value={row.draft.categoryName ?? ''}
            onChange={(e) => onFieldChange('categoryName', e.target.value)}
          />
          <datalist id={categoryListId}>
            {categories.map((category) => (
              <option key={category.id} value={category.name} />
            ))}
          </datalist>
        </td>
        <td>
          <select
            className="import-cell-input"
            aria-label={`Prioridad ${label}`}
            value={
              row.priority.kind === 'create'
                ? `__create__:${row.priority.label}`
                : row.priority.id
            }
            onChange={(e) => {
              const value = e.target.value
              if (value.startsWith('__create__:')) {
                onFieldChange('priorityRaw', value.slice('__create__:'.length))
                return
              }
              onFieldChange('priorityRaw', value)
            }}
          >
            {priorityOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
            {row.priority.kind === 'create' ? (
              <option value={`__create__:${row.priority.label}`}>
                Nueva: {row.priority.label}
              </option>
            ) : null}
          </select>
        </td>
        <td>
          <select
            className="import-cell-input"
            aria-label={`Estado ${label}`}
            value={
              row.status.kind === 'unknown' ? '__unknown__' : row.status.id
            }
            onChange={(e) => {
              const value = e.target.value
              if (value === '__unknown__') return
              onFieldChange('statusRaw', value)
            }}
          >
            {statusOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
            {row.status.kind === 'unknown' ? (
              <option value="__unknown__">
                Desconocido: {row.status.raw}
              </option>
            ) : null}
          </select>
        </td>
        <td>
          <input
            className="import-cell-input import-cell-input-num"
            inputMode="decimal"
            aria-label={`Presupuesto ${label}`}
            value={moneyInputValue(row.draft.estimatedCost)}
            onChange={(e) => onFieldChange('estimatedCost', e.target.value)}
          />
        </td>
        <td>
          <input
            className="import-cell-input import-cell-input-num"
            inputMode="decimal"
            aria-label={`Precio planeado ${label}`}
            value={moneyInputValue(row.draft.plannedPrice)}
            onChange={(e) => onFieldChange('plannedPrice', e.target.value)}
          />
        </td>
        <td>
          <input
            className="import-cell-input import-cell-input-num"
            inputMode="decimal"
            aria-label={`Precio pagado ${label}`}
            value={moneyInputValue(row.draft.actualCost)}
            onChange={(e) => onFieldChange('actualCost', e.target.value)}
          />
        </td>
        <td>
          <input
            className="import-cell-input"
            aria-label={`Tienda ${label}`}
            value={row.draft.store ?? ''}
            onChange={(e) => onFieldChange('store', e.target.value)}
          />
        </td>
        <td>{problemsLabel(row.issues)}</td>
        <td>
          {row.duplicateAction != null ? (
            <select
              aria-label={`Acción duplicado ${label}`}
              value={row.duplicateAction}
              disabled={row.severity === 'error'}
              onChange={(e) =>
                onDuplicateAction(e.target.value as DuplicateAction)
              }
            >
              <option value="omit">Omitir</option>
              <option value="create_new">Importar como nuevo</option>
              <option value="update_existing" disabled={row.matchedItemId == null}>
                Actualizar existente
              </option>
            </select>
          ) : (
            '—'
          )}
        </td>
      </tr>
      {row.duplicateAction === 'update_existing' && row.updateDiff.length > 0 ? (
        <tr className="import-diff-row">
          <td colSpan={11}>
            <ul className="import-diff-list">
              {row.updateDiff.map((diff) => (
                <li key={`${diff.field}-${diff.kind}`}>
                  <strong>{diff.label}:</strong> {diff.from} → {diff.to}
                  {diff.kind === 'protected' ? ' (protegido)' : ''}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  )
}
