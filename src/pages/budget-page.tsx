import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { IconEye, IconPencil, IconPlusCircle, IconTrash } from '@/components/icons'
import { useAuth } from '@/features/auth/auth-context'
import { BudgetCategoryChart } from '@/features/monthly-budget/budget-category-chart'
import { BudgetReusePanel } from '@/features/monthly-budget/budget-reuse-panel'
import {
  createFinancialCategory,
  createMonthlyBudgetAllocation,
  deleteMonthlyBudgetAllocation,
  fetchMonthlyBudgetByPeriod,
  listFinancialCategories,
  listMonthlyBudgetAllocations,
  updateMonthlyBudgetAllocationAmount,
  updateMonthlyBudgetAvailableAmount,
} from '@/features/monthly-budget/monthly-budget-api'
import type {
  FinancialCategory,
  PersistedMonthlyBudget,
  PersistedMonthlyBudgetAllocation,
} from '@/features/monthly-budget/domain'
import {
  currentMonthlyPeriod,
  nextMonthlyPeriod,
  previousMonthlyPeriod,
} from '@/features/monthly-budget/period'
import { getMonthlyBudgetPeriodSummary } from '@/features/monthly-budget/monthly-budget-summary-api'
import type { MonthlyBudgetPeriodSummary } from '@/features/monthly-budget/transaction-summary'
import { formatYearMonthLabel } from '@/utils/budget/savings-goal'
import { costInputValue, parseCost } from '@/utils/form'
import { useFormatMoney } from '@/utils/format'

export function BudgetPage() {
  const { user } = useAuth()
  const money = useFormatMoney()
  const [period, setPeriod] = useState(currentMonthlyPeriod())
  const [budget, setBudget] = useState<PersistedMonthlyBudget | null>(null)
  const [summary, setSummary] = useState<MonthlyBudgetPeriodSummary | null | undefined>()
  const [categories, setCategories] = useState<FinancialCategory[]>([])
  const [allocations, setAllocations] = useState<PersistedMonthlyBudgetAllocation[]>([])
  const [available, setAvailable] = useState('')
  const [editing, setEditing] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [amount, setAmount] = useState('')
  const [editAllocation, setEditAllocation] = useState<PersistedMonthlyBudgetAllocation | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    setSummary(undefined)
    try {
      const [row, result, cats] = await Promise.all([
        fetchMonthlyBudgetByPeriod(period),
        getMonthlyBudgetPeriodSummary(period),
        listFinancialCategories(true),
      ])
      setBudget(row)
      setSummary(result)
      setCategories(cats)
      setAllocations(row ? await listMonthlyBudgetAllocations(row.id) : [])
      setAvailable(costInputValue(row?.availableAmount ?? null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el presupuesto.')
      setSummary(null)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when period changes
  }, [period])

  if (!user) return null

  async function saveAvailable(e: FormEvent) {
    e.preventDefault()
    const v = parseCost(available)
    if (!budget || v == null || v < 0) return
    try {
      await updateMonthlyBudgetAvailableAmount(budget.id, v)
      setEditing(false)
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  function resetAllocationForm() {
    setEditAllocation(null)
    setCategoryName('')
    setAmount('')
  }

  async function saveAllocation(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!budget || !user) return

    const v = parseCost(amount)
    if (v == null || Number.isNaN(v) || v < 0) {
      setError('Indica un monto válido (0 o mayor).')
      return
    }

    try {
      if (editAllocation) {
        await updateMonthlyBudgetAllocationAmount(editAllocation.id, v)
      } else {
        const trimmed = categoryName.trim()
        if (!trimmed) {
          setError('Indica el nombre de la categoría.')
          return
        }

        const normalized = trimmed.toLocaleLowerCase()
        const existing = categories.find(
          (c) => !c.archivedAt && c.name.toLocaleLowerCase() === normalized,
        )

        if (existing && allocations.some((a) => a.financialCategoryId === existing.id)) {
          setError('Esa categoría ya tiene presupuesto este mes.')
          return
        }

        const category =
          existing ?? (await createFinancialCategory(user.id, trimmed))
        await createMonthlyBudgetAllocation({
          monthlyBudgetId: budget.id,
          financialCategoryId: category.id,
          amount: v,
        })
      }

      resetAllocationForm()
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la asignación.')
    }
  }

  const categoryLabel = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? 'Categoría archivada'
  const m = summary?.metrics
  const editingCategoryName = editAllocation
    ? categoryLabel(editAllocation.financialCategoryId)
    : null
  const allocationAmount = parseCost(amount)
  const canSubmitAllocation =
    (editAllocation != null || categoryName.trim() !== '') &&
    allocationAmount != null &&
    allocationAmount >= 0

  return (
    <div className="page">
      <header className="page-header row-between">
        <div>
          <h1>Presupuesto</h1>
          <p className="muted">Planificación y gasto real del mes.</p>
        </div>
        {budget ? (
          <div className="row">
            <Link className="btn btn-ghost" to={`/budget/transactions?period=${period}`}>
              Movimientos
            </Link>
            <Link className="btn btn-primary" to={`/budget/transactions?period=${period}&create=1`}>
              Registrar gasto
            </Link>
          </div>
        ) : null}
      </header>

      <div className="month-nav">
        <button className="btn" onClick={() => setPeriod(previousMonthlyPeriod(period))}>
          ←
        </button>
        <strong>{formatYearMonthLabel(period)}</strong>
        <button className="btn" onClick={() => setPeriod(nextMonthlyPeriod(period))}>
          →
        </button>
      </div>

      {error ? <p className="field-error">{error}</p> : null}
      {summary === undefined ? <p>Cargando presupuesto…</p> : null}
      {summary === null ? (
        <BudgetReusePanel
          userId={user.id}
          period={period}
          categories={categories}
          budget={null}
          onCreated={load}
        />
      ) : null}

      {budget && m ? (
        <>
          <section className="metrics-grid metrics-grid-budget" aria-label="Resumen del mes">
            <article className="metric-card metric-card-budget metric-card-editable">
              <div className="metric-card-head">
                <p className="metric-label">Disponible inicial</p>
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={editing ? 'Cerrar edición de disponible' : 'Editar disponible inicial'}
                  title={editing ? 'Cerrar edición' : 'Editar'}
                  aria-pressed={editing}
                  onClick={() => setEditing(!editing)}
                >
                  <IconPencil />
                </button>
              </div>
              {editing ? (
                <form className="metric-edit-form" onSubmit={saveAvailable}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={available}
                    onChange={(e) => setAvailable(e.target.value)}
                    aria-label="Disponible inicial"
                    autoFocus
                  />
                  <button className="btn btn-primary" type="submit">
                    Guardar
                  </button>
                </form>
              ) : (
                <p className="metric-value">{money(m.availableAmount)}</p>
              )}
            </article>

            <article className="metric-card metric-card-projected">
              <p className="metric-label">Presupuestado</p>
              <p className="metric-value">{money(m.assigned)}</p>
            </article>

            <article
              className={`metric-card metric-card-compact ${m.unassigned < 0 ? 'metric-card-over' : 'metric-card-pending'}`}
            >
              <p className="metric-label">{m.unassigned < 0 ? 'Sobreasignado' : 'Sin asignar'}</p>
              <p className="metric-value">{money(Math.abs(m.unassigned))}</p>
            </article>

            <article className="metric-card metric-card-spent">
              <p className="metric-label">Gastado</p>
              <p className="metric-value">{money(m.spent)}</p>
            </article>

            <article
              className={`metric-card ${m.actualRemaining < 0 ? 'metric-card-over' : 'metric-card-balance'}`}
            >
              <p className="metric-label">Disponible actual</p>
              <p className="metric-value">{money(m.actualRemaining)}</p>
            </article>
          </section>

          <BudgetCategoryChart
            categories={summary.categories}
            categoryName={categoryLabel}
          />

          <section className="stack">
            <h2>Categorías</h2>
            {summary.categories.length === 0 ? (
              <p className="muted">Aún no hay categorías en este mes. Añade una abajo.</p>
            ) : null}
            <ul className="budget-category-list">
              {summary.categories.map((c) => {
                const a = allocations.find((x) => x.financialCategoryId === c.financialCategoryId)
                return (
                  <li className="budget-category-item" key={c.financialCategoryId}>
                    <div className="budget-category-item__meta">
                      <strong>{categoryLabel(c.financialCategoryId)}</strong>
                      <p>
                        {a
                          ? `${money(c.spent)} de ${money(c.budget)}`
                          : `Sin presupuesto · ${money(c.spent)} gastado`}
                      </p>
                    </div>
                    <div className="budget-category-item__actions">
                      <Link
                        className="btn-icon"
                        to={`/budget/transactions?period=${period}&category=${c.financialCategoryId}`}
                        aria-label={`Ver gastos de ${categoryLabel(c.financialCategoryId)}`}
                        title="Ver gastos"
                      >
                        <IconEye />
                      </Link>
                      <Link
                        className="btn-icon"
                        to={`/budget/transactions?period=${period}&create=1&category=${c.financialCategoryId}`}
                        aria-label={`Registrar gasto en ${categoryLabel(c.financialCategoryId)}`}
                        title="Registrar gasto"
                      >
                        <IconPlusCircle />
                      </Link>
                      {a ? (
                        <>
                          <button
                            className="btn-icon"
                            type="button"
                            onClick={() => {
                              setEditAllocation(a)
                              setCategoryName(categoryLabel(a.financialCategoryId))
                              setAmount(costInputValue(a.amount))
                              setError(null)
                            }}
                            aria-label={`Editar asignación de ${categoryLabel(a.financialCategoryId)}`}
                            title="Editar"
                          >
                            <IconPencil />
                          </button>
                          <button
                            className="btn-icon btn-icon-danger"
                            type="button"
                            onClick={() => {
                              if (window.confirm("¿Eliminar asignación?")) {
                                void deleteMonthlyBudgetAllocation(a.id)
                                  .then(load)
                                  .catch((err) =>
                                    setError(
                                      err instanceof Error ? err.message : "No se pudo eliminar.",
                                    ),
                                  )
                              }
                            }}
                            aria-label={`Eliminar asignación de ${categoryLabel(a.financialCategoryId)}`}
                            title="Eliminar"
                          >
                            <IconTrash />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>

            <form className="budget-form-compact" onSubmit={saveAllocation}>
              <div className="field">
                <label htmlFor="budget-category-name">
                  {editAllocation ? 'Categoría' : 'Nombre de categoría'}
                </label>
                <input
                  id="budget-category-name"
                  type="text"
                  value={editAllocation ? (editingCategoryName ?? '') : categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Ej. Alimentación"
                  disabled={!!editAllocation}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="budget-category-amount">Monto presupuestado</label>
                <input
                  id="budget-category-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="budget-form-compact-actions">
                <button className="btn" disabled={!canSubmitAllocation}>
                  {editAllocation ? 'Guardar' : 'Añadir'}
                </button>
                {editAllocation ? (
                  <button type="button" className="btn btn-ghost" onClick={resetAllocationForm}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <BudgetReusePanel
            userId={user.id}
            period={period}
            categories={categories}
            budget={budget}
            onCreated={load}
          />
        </>
      ) : null}
    </div>
  )
}
