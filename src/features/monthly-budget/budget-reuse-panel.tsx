import { useEffect, useState, type FormEvent } from 'react'
import { IconTrash } from '@/components/icons'
import { costInputValue, parseCost } from '@/utils/form'
import { useFormatMoney } from '@/utils/format'
import type {
  BudgetTemplate,
  BudgetTemplateAllocation,
  FinancialCategory,
  PersistedMonthlyBudget,
} from './domain'
import {
  createBudgetTemplateAllocation,
  createBudgetTemplateFromMonthlyBudget,
  createMonthlyBudget,
  createMonthlyBudgetSnapshot,
  deleteBudgetTemplate,
  deleteBudgetTemplateAllocation,
  listBudgetTemplateAllocations,
  listBudgetTemplates,
  listMonthlyBudgetAllocations,
  listMonthlyBudgets,
  updateBudgetTemplate,
  updateBudgetTemplateAllocation,
} from './monthly-budget-api'
import { previewReusablePlan } from './templates'

type Props = {
  userId: string
  period: string
  categories: readonly FinancialCategory[]
  budget: PersistedMonthlyBudget | null
  onCreated: () => void | Promise<void>
}

type ReusePreview = {
  label: string
  availableAmount: number
  allocations: readonly { financialCategoryId: string; amount: number }[]
}

function ReusePreviewCard({
  preview,
  categories,
}: {
  preview: ReusePreview
  categories: readonly FinancialCategory[]
}) {
  const money = useFormatMoney()
  const plan = previewReusablePlan(preview.availableAmount, preview.allocations, categories)
  return (
    <div className="card stack" aria-live="polite">
      <h3>Vista previa: {preview.label}</h3>
      <p>
        Disponible: <strong>{money(preview.availableAmount)}</strong>
      </p>
      <p>
        Asignaciones: <strong>{plan.active.length}</strong>
      </p>
      <p>
        Total presupuestado: <strong>{money(plan.assigned)}</strong>
      </p>
      <p>
        {plan.unassigned < 0 ? 'Sobreasignado' : 'Sin asignar'}:{' '}
        <strong>{money(Math.abs(plan.unassigned))}</strong>
      </p>
      {plan.archived.length > 0 ? (
        <div className="field-error">
          <strong>No se copiará:</strong>
          <ul>
            {plan.archived.map((allocation) => {
              const category = categories.find(
                (item) => item.id === allocation.financialCategoryId,
              )
              return (
                <li key={allocation.financialCategoryId}>
                  {category?.name ?? 'Categoría archivada'} — {money(allocation.amount)}
                  <br />
                  <span className="muted">Categoría archivada</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function BudgetCreationOptions({
  userId,
  period,
  categories,
  templates,
  onCreated,
  setError,
}: {
  userId: string
  period: string
  categories: readonly FinancialCategory[]
  templates: readonly BudgetTemplate[]
  onCreated: () => void | Promise<void>
  setError: (message: string | null) => void
}) {
  const [emptyAvailable, setEmptyAvailable] = useState('')
  const [sourceBudgets, setSourceBudgets] = useState<PersistedMonthlyBudget[]>([])
  const [sourceId, setSourceId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [copyPreview, setCopyPreview] = useState<ReusePreview | null>(null)
  const [templatePreview, setTemplatePreview] = useState<ReusePreview | null>(null)
  const [templateAvailable, setTemplateAvailable] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void listMonthlyBudgets()
      .then((items) => {
        if (active) setSourceBudgets(items.filter((item) => item.period !== period))
      })
      .catch((error) => {
        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar los presupuestos disponibles.',
          )
        }
      })
    return () => {
      active = false
    }
  }, [period, setError])

  const emptyAmount = parseCost(emptyAvailable)
  const canCreateEmpty = emptyAmount != null && emptyAmount >= 0
  const canPreviewCopy = sourceId !== ''
  const canPreviewTemplate = templateId !== ''
  const templateAmount = parseCost(templateAvailable)
  const canConfirmTemplate = templateAmount != null && templateAmount >= 0

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await action()
      await onCreated()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo crear el presupuesto.')
    } finally {
      setBusy(null)
    }
  }

  async function loadCopyPreview() {
    const source = sourceBudgets.find((item) => item.id === sourceId)
    if (!source) {
      setError('Selecciona un presupuesto de origen.')
      return
    }
    setBusy('copy-preview')
    setError(null)
    try {
      setCopyPreview({
        label: `Copiar ${source.period}`,
        availableAmount: source.availableAmount,
        allocations: await listMonthlyBudgetAllocations(source.id),
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo generar la vista previa.')
    } finally {
      setBusy(null)
    }
  }

  async function loadTemplatePreview() {
    const template = templates.find((item) => item.id === templateId)
    if (!template) {
      setError('Selecciona una plantilla.')
      return
    }
    setBusy('template-preview')
    setError(null)
    try {
      const allocations = await listBudgetTemplateAllocations(template.id)
      setTemplateAvailable(costInputValue(template.suggestedAvailableAmount))
      setTemplatePreview({
        label: template.name,
        availableAmount: template.suggestedAvailableAmount ?? 0,
        allocations,
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo generar la vista previa.')
    } finally {
      setBusy(null)
    }
  }

  function submitEmpty(event: FormEvent) {
    event.preventDefault()
    if (!canCreateEmpty || emptyAmount == null) {
      setError('Indica un disponible válido.')
      return
    }
    void run('create-empty', () =>
      createMonthlyBudget({ userId, period, availableAmount: emptyAmount }).then(() => undefined),
    )
  }

  return (
    <section className="card stack">
      <h2>Crear presupuesto</h2>
      <form className="budget-form-compact" onSubmit={submitEmpty}>
        <div className="field">
          <label htmlFor="budget-create-available">Disponible inicial</label>
          <input
            id="budget-create-available"
            type="number"
            min="0"
            step="0.01"
            value={emptyAvailable}
            onChange={(event) => setEmptyAvailable(event.target.value)}
          />
        </div>
        <div className="budget-form-compact-actions">
          <button className="btn" disabled={busy !== null || !canCreateEmpty}>
            {busy === 'create-empty' ? 'Creando…' : 'Crear vacío'}
          </button>
        </div>
      </form>

      <div className="stack templates-panel__block">
        <h3>Copiar otro mes</h3>
        {sourceBudgets.length === 0 ? (
          <p className="muted">No hay otros presupuestos disponibles para copiar.</p>
        ) : (
          <>
            <div className="budget-form-compact">
              <div className="field">
                <label htmlFor="budget-copy-source">Presupuesto origen</label>
                <select
                  id="budget-copy-source"
                  value={sourceId}
                  onChange={(event) => {
                    setSourceId(event.target.value)
                    setCopyPreview(null)
                  }}
                >
                  <option value="">Selecciona un mes</option>
                  {sourceBudgets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.period}
                    </option>
                  ))}
                </select>
              </div>
              <div className="budget-form-compact-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy !== null || !canPreviewCopy}
                  onClick={() => void loadCopyPreview()}
                >
                  {busy === 'copy-preview' ? 'Cargando…' : 'Ver vista previa'}
                </button>
              </div>
            </div>
            {copyPreview ? (
              <>
                <ReusePreviewCard preview={copyPreview} categories={categories} />
                <button
                  className="btn"
                  disabled={busy !== null}
                  onClick={() =>
                    void run('copy-budget', () =>
                      createMonthlyBudgetSnapshot({
                        period,
                        availableAmount: copyPreview.availableAmount,
                        sourceBudgetId: sourceId,
                      }).then(() => undefined),
                    )
                  }
                >
                  {busy === 'copy-budget' ? 'Copiando…' : 'Confirmar copia'}
                </button>
              </>
            ) : null}
          </>
        )}
      </div>

      <div className="stack templates-panel__block">
        <h3>Usar plantilla</h3>
        {templates.length === 0 ? (
          <p className="muted">
            No hay plantillas disponibles. Puedes gestionarlas cuando exista un presupuesto.
          </p>
        ) : (
          <>
            <div className="budget-form-compact">
              <div className="field">
                <label htmlFor="budget-use-template">Plantilla</label>
                <select
                  id="budget-use-template"
                  value={templateId}
                  onChange={(event) => {
                    setTemplateId(event.target.value)
                    setTemplatePreview(null)
                  }}
                >
                  <option value="">Selecciona una plantilla</option>
                  {templates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="budget-form-compact-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy !== null || !canPreviewTemplate}
                  onClick={() => void loadTemplatePreview()}
                >
                  {busy === 'template-preview' ? 'Cargando…' : 'Ver vista previa'}
                </button>
              </div>
            </div>
            {templatePreview ? (
              <>
                <div className="field field-narrow">
                  <label htmlFor="budget-template-available-create">Disponible inicial</label>
                  <input
                    id="budget-template-available-create"
                    type="number"
                    min="0"
                    step="0.01"
                    value={templateAvailable}
                    onChange={(event) => {
                      setTemplateAvailable(event.target.value)
                      const value = parseCost(event.target.value)
                      if (value != null) {
                        setTemplatePreview({ ...templatePreview, availableAmount: value })
                      }
                    }}
                    placeholder="Indica el disponible"
                  />
                </div>
                {templates.find((item) => item.id === templateId)?.suggestedAvailableAmount ==
                null ? (
                  <p className="muted">
                    Esta plantilla no tiene disponible sugerido; indica uno para continuar.
                  </p>
                ) : null}
                <ReusePreviewCard preview={templatePreview} categories={categories} />
                <button
                  className="btn"
                  disabled={busy !== null || !canConfirmTemplate}
                  onClick={() => {
                    if (!canConfirmTemplate || templateAmount == null) {
                      setError('Indica un disponible válido.')
                      return
                    }
                    void run('create-template', () =>
                      createMonthlyBudgetSnapshot({
                        period,
                        availableAmount: templateAmount,
                        sourceTemplateId: templateId,
                      }).then(() => undefined),
                    )
                  }}
                >
                  {busy === 'create-template' ? 'Creando…' : 'Confirmar uso de plantilla'}
                </button>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

function TemplateManagement({
  categories,
  budget,
  templates,
  refreshTemplates,
  setError,
}: {
  categories: readonly FinancialCategory[]
  budget: PersistedMonthlyBudget | null
  templates: readonly BudgetTemplate[]
  refreshTemplates: () => Promise<void>
  setError: (message: string | null) => void
}) {
  const [selected, setSelected] = useState<BudgetTemplate | null>(null)
  const [rows, setRows] = useState<BudgetTemplateAllocation[]>([])
  const [newName, setNewName] = useState('')
  const [editName, setEditName] = useState('')
  const [available, setAvailable] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const canSaveNew = newName.trim().length > 0
  const editAvailableParsed = available === '' ? null : parseCost(available)
  const editAvailableValid = available === '' || (editAvailableParsed != null && editAvailableParsed >= 0)
  const canSaveEdit = editName.trim().length > 0 && editAvailableValid
  const canClearSuggestion = available !== ''
  const addAmount = parseCost(amount)
  const canAddAllocation = category !== '' && addAmount != null && addAmount >= 0
  const active = categories.filter(
    (item) => !item.archivedAt && !rows.some((row) => row.financialCategoryId === item.id),
  )

  async function choose(template: BudgetTemplate) {
    setError(null)
    try {
      setSelected(template)
      setEditName(template.name)
      setAvailable(costInputValue(template.suggestedAvailableAmount))
      setCategory('')
      setAmount('')
      setRows(await listBudgetTemplateAllocations(template.id))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudieron cargar las asignaciones.')
    }
  }

  async function mutate(key: string, action: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await action()
      await refreshTemplates()
      if (selected) setRows(await listBudgetTemplateAllocations(selected.id))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      setBusy(null)
    }
  }

  async function onRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      await refreshTemplates()
      if (selected) {
        const latest = (await listBudgetTemplates()).find((item) => item.id === selected.id)
        if (latest) await choose(latest)
        else {
          setSelected(null)
          setRows([])
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudieron actualizar las plantillas.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="card stack templates-panel">
      <div className="row-between templates-panel__head">
        <div>
          <h2>Plantillas</h2>
          <p className="muted">
            Guarda la distribución de este mes o reutiliza una plantilla ya creada.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={refreshing || busy !== null}
          onClick={() => void onRefresh()}
        >
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {budget ? (
        <div className="templates-panel__block stack">
          <h3>Guardar mes actual</h3>
          <p className="muted">
            Crea una plantilla con el disponible y las categorías de este presupuesto.
          </p>
          <form
            className="budget-form-compact"
            onSubmit={(event) => {
              event.preventDefault()
              if (!canSaveNew) return
              void mutate('from-budget', async () => {
                await createBudgetTemplateFromMonthlyBudget(budget.id, newName.trim())
                setNewName('')
              })
            }}
          >
            <div className="field">
              <label htmlFor="budget-template-new-name">Nombre de plantilla</label>
              <input
                id="budget-template-new-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ej. Mes típico"
                autoComplete="off"
              />
            </div>
            <div className="budget-form-compact-actions">
              <button
                className="btn btn-primary"
                disabled={busy !== null || !canSaveNew}
              >
                {busy === 'from-budget' ? 'Guardando…' : 'Guardar como plantilla'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="muted">Crea un presupuesto para poder guardar tu primera plantilla.</p>
      )}

      <div className="templates-panel__block stack">
        <h3>Editar plantilla</h3>
        {templates.length === 0 ? (
          <p className="muted">Todavía no hay plantillas guardadas.</p>
        ) : (
          <div className="budget-form-compact">
            <div className="field">
              <label htmlFor="budget-template-select">Plantilla</label>
              <select
                id="budget-template-select"
                aria-label="Seleccionar plantilla"
                value={selected?.id ?? ''}
                onChange={(event) => {
                  const item = templates.find((template) => template.id === event.target.value)
                  if (item) void choose(item)
                  else {
                    setSelected(null)
                    setRows([])
                    setEditName('')
                    setAvailable('')
                  }
                }}
              >
                <option value="">Selecciona una plantilla</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selected ? (
          <div className="stack templates-panel__editor">
            <form
              className="budget-form-compact"
              onSubmit={(event) => {
                event.preventDefault()
                if (!canSaveEdit) return
                void mutate('template', async () => {
                  await updateBudgetTemplate(selected.id, {
                    name: editName.trim(),
                    suggestedAvailableAmount: editAvailableParsed,
                  })
                })
              }}
            >
              <div className="field">
                <label htmlFor="budget-template-rename">Nombre</label>
                <input
                  id="budget-template-rename"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  aria-label="Renombrar plantilla"
                />
              </div>
              <div className="field">
                <label htmlFor="budget-template-available">Disponible sugerido</label>
                <input
                  id="budget-template-available"
                  type="number"
                  min="0"
                  step="0.01"
                  value={available}
                  onChange={(event) => setAvailable(event.target.value)}
                  placeholder="Sin definir"
                  aria-label="Disponible sugerido"
                />
              </div>
              <div className="budget-form-compact-actions">
                <button className="btn" disabled={busy !== null || !canSaveEdit}>
                  {busy === 'template' ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy !== null || !canClearSuggestion}
                  onClick={() => {
                    setAvailable('')
                    void mutate('template', () =>
                      updateBudgetTemplate(selected.id, {
                        name: editName.trim() || selected.name,
                        suggestedAvailableAmount: null,
                      }),
                    )
                  }}
                >
                  Quitar sugerencia
                </button>
              </div>
            </form>

            <div className="stack">
              <h4 className="templates-panel__subtitle">Asignaciones</h4>
              {rows.length ? (
                <ul className="templates-allocation-list">
                  {rows.map((row) => {
                    const categoryName =
                      categories.find((item) => item.id === row.financialCategoryId)?.name ??
                      'Categoría'
                    const archived = Boolean(
                      categories.find((item) => item.id === row.financialCategoryId)?.archivedAt,
                    )
                    return (
                      <li className="templates-allocation-item" key={row.id}>
                        <span className="budget-inline-label">
                          {categoryName}
                          {archived ? ' (archivada)' : ''}
                        </span>
                        <input
                          type="number"
                          defaultValue={row.amount}
                          aria-label={`Editar asignación ${categoryName}`}
                          onBlur={(event) => {
                            const value = parseCost(event.target.value)
                            if (value != null)
                              void mutate(row.id, () =>
                                updateBudgetTemplateAllocation(row.id, value),
                              )
                          }}
                        />
                        <button
                          type="button"
                          disabled={busy === `del-${row.id}`}
                          className="btn-icon btn-icon-danger"
                          onClick={() => {
                            if (window.confirm('¿Eliminar asignación?'))
                              void mutate(`del-${row.id}`, () =>
                                deleteBudgetTemplateAllocation(row.id),
                              )
                          }}
                          aria-label={`Eliminar asignación de ${categoryName}`}
                          title="Eliminar"
                        >
                          <IconTrash />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="muted">Sin asignaciones.</p>
              )}

              <form
                className="budget-form-compact"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!canAddAllocation || addAmount == null) return
                  void mutate('new', async () => {
                    await createBudgetTemplateAllocation({
                      budgetTemplateId: selected.id,
                      financialCategoryId: category,
                      amount: addAmount,
                    })
                    setCategory('')
                    setAmount('')
                  })
                }}
              >
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  aria-label="Añadir categoría a plantilla"
                  disabled={active.length === 0}
                >
                  <option value="">
                    {active.length === 0 ? 'No hay categorías disponibles' : 'Añadir categoría'}
                  </option>
                  {active.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  aria-label="Monto de asignación"
                  placeholder="Monto"
                  disabled={active.length === 0}
                />
                <div className="budget-form-compact-actions">
                  <button className="btn" disabled={busy !== null || !canAddAllocation}>
                    {busy === 'new' ? 'Añadiendo…' : 'Añadir'}
                  </button>
                </div>
              </form>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-danger-ghost"
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm('¿Eliminar plantilla?'))
                  void mutate('delete', async () => {
                    await deleteBudgetTemplate(selected.id)
                    setSelected(null)
                    setRows([])
                    setEditName('')
                    setAvailable('')
                  })
              }}
            >
              {busy === 'delete' ? 'Eliminando…' : 'Eliminar plantilla'}
            </button>
          </div>
        ) : templates.length > 0 ? (
          <p className="muted">Selecciona una plantilla para editarla.</p>
        ) : null}
      </div>
    </section>
  )
}

export function BudgetReusePanel({ userId, period, categories, budget, onCreated }: Props) {
  const [templates, setTemplates] = useState<BudgetTemplate[]>([])
  const [error, setError] = useState<string | null>(null)

  async function refreshTemplates() {
    setTemplates(await listBudgetTemplates())
  }

  useEffect(() => {
    void listBudgetTemplates()
      .then(setTemplates)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'No se pudieron cargar plantillas.'),
      )
  }, [period])

  return (
    <div className="stack">
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {budget ? null : (
        <BudgetCreationOptions
          userId={userId}
          period={period}
          categories={categories}
          templates={templates}
          onCreated={onCreated}
          setError={setError}
        />
      )}
      <TemplateManagement
        categories={categories}
        budget={budget}
        templates={templates}
        refreshTemplates={refreshTemplates}
        setError={setError}
      />
    </div>
  )
}
