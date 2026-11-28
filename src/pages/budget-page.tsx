import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { IconClose, IconEye, IconPencil, IconPlusCircle, IconTrash } from '@/components/icons'
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
  setMonthlyBudgetAllocationPaymentsCompleted,
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
  monthlyPeriodBounds,
  nextMonthlyPeriod,
  previousMonthlyPeriod,
} from '@/features/monthly-budget/period'
import { getMonthlyBudgetPeriodSummary } from '@/features/monthly-budget/monthly-budget-summary-api'
import { calculateFreeMoney } from '@/features/monthly-budget/free-money'
import type { MonthlyBudgetPeriodSummary } from '@/features/monthly-budget/transaction-summary'
import { calculateAvailableAfterKnownCommitments, calculateCategoryCommitmentCoverage, calculateMonthlyScheduledCommitments } from '@/features/scheduled-payments/commitments'
import { listScheduledPaymentOccurrencesForPeriod, listScheduledPayments } from '@/features/scheduled-payments/scheduled-payment-api'
import type { ScheduledPayment, ScheduledPaymentOccurrence } from '@/features/scheduled-payments/domain'
import { listTransactions } from '@/features/transactions/transaction-api'
import type { FinancialTransaction } from '@/features/transactions/domain'
import { TransactionForm } from '@/features/transactions/transaction-form'
import { formatYearMonthLabel } from '@/utils/budget/savings-goal'
import { costInputValue, parseCost } from '@/utils/form'
import { useFormatMoney } from '@/utils/format'
import { useModalAccessibility } from '@/hooks/use-modal-accessibility'

function todayCivil(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export function BudgetPage() {
  const { user } = useAuth()
  const money = useFormatMoney()
  const [params, setParams] = useSearchParams()
  const [period, setPeriod] = useState(params.get('period') ?? currentMonthlyPeriod())
  const [budget, setBudget] = useState<PersistedMonthlyBudget | null>(null)
  const [summary, setSummary] = useState<MonthlyBudgetPeriodSummary | null | undefined>()
  const [categories, setCategories] = useState<FinancialCategory[]>([])
  const [allocations, setAllocations] = useState<PersistedMonthlyBudgetAllocation[]>([])
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([])
  const [scheduledOccurrences, setScheduledOccurrences] = useState<ScheduledPaymentOccurrence[]>([])
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [available, setAvailable] = useState('')
  const [editing, setEditing] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [amount, setAmount] = useState('')
  const [editAllocation, setEditAllocation] = useState<PersistedMonthlyBudgetAllocation | null>(null)
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false)
  const [transactionType, setTransactionType] = useState<'expense' | 'income' | null>(null)
  const [transactionCategoryId, setTransactionCategoryId] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const allocationDialogRef = useRef<HTMLElement>(null)
  const transactionDialogRef = useRef<HTMLElement>(null)

  async function load() {
    setError(null)
    setSummary(undefined)
    try {
      const bounds = monthlyPeriodBounds(period)
      const [row, result, cats, payments, occurrences, periodTransactions] = await Promise.all([
        fetchMonthlyBudgetByPeriod(period),
        getMonthlyBudgetPeriodSummary(period),
        listFinancialCategories(true),
        listScheduledPayments(),
        listScheduledPaymentOccurrencesForPeriod(period),
        listTransactions({ fromDate: bounds.start, toDateExclusive: bounds.endExclusive }),
      ])
      setBudget(row)
      setSummary(result)
      setCategories(cats)
      setScheduledPayments(payments)
      setScheduledOccurrences(occurrences)
      setTransactions(periodTransactions)
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

  function closeAllocationDialog() {
    setAllocationDialogOpen(false)
    resetAllocationForm()
  }

  function openAllocationDialog(allocation?: PersistedMonthlyBudgetAllocation) {
    setEditAllocation(allocation ?? null)
    setCategoryName(allocation ? categoryLabel(allocation.financialCategoryId) : '')
    setAmount(costInputValue(allocation?.amount ?? null))
    setError(null)
    setAllocationDialogOpen(true)
  }

  function openTransactionDialog(type: 'expense' | 'income', categoryId?: string) {
    setTransactionCategoryId(categoryId)
    setTransactionType(type)
  }

  function closeTransactionDialog() {
    setTransactionType(null)
    setTransactionCategoryId(undefined)
  }

  useModalAccessibility(allocationDialogOpen, allocationDialogRef, closeAllocationDialog)
  useModalAccessibility(transactionType !== null, transactionDialogRef, closeTransactionDialog)

  if (!user) return null

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

      closeAllocationDialog()
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
  const commitments = calculateMonthlyScheduledCommitments({
    period,
    today: todayCivil(),
    payments: scheduledPayments,
    categoriesById: new Map(categories.map((category) => [category.id, category] as const)),
    occurrences: scheduledOccurrences,
  })
  const commitmentByCategory = new Map(
    commitments.byCategory.map((commitment) => [commitment.financialCategoryId, commitment] as const),
  )
  const categorySummaryById = new Map(
    (summary?.categories ?? []).map((category) => [category.financialCategoryId, category] as const),
  )
  const categoryIds = new Set([
    ...categorySummaryById.keys(),
    ...commitmentByCategory.keys(),
  ])
  const freeMoney = calculateFreeMoney({
    period,
    unassigned: m?.unassigned ?? 0,
    allocations,
    transactions,
  })
  const releaseByAllocationId = new Map(
    freeMoney.releases.map((release) => [release.allocationId, release] as const),
  )

  return (
    <div className="page">
      <header className="page-header row-between">
        <div>
          <h1>Presupuesto</h1>
          <p className="muted">Planificación y gasto real del mes.</p>
        </div>
        <div className="row">
          <Link className="btn btn-ghost" to={`/budget/scheduled-payments?period=${period}`}>
            Pagos programados
          </Link>
          {budget ? (
            <>
            <Link className="btn btn-ghost" to={`/budget/transactions?period=${period}`}>
              Movimientos
            </Link>
            <button type="button" className="btn btn-primary" onClick={() => openTransactionDialog('expense')}>
              Registrar gasto
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => openTransactionDialog('income')}>
              Registrar ingreso
            </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="month-nav">
        <button className="btn" aria-label="Mes anterior" onClick={() => { const next = previousMonthlyPeriod(period); setPeriod(next); setParams({ period: next }) }}>
          ←
        </button>
        <strong>{formatYearMonthLabel(period)}</strong>
        <button className="btn" aria-label="Mes siguiente" onClick={() => { const next = nextMonthlyPeriod(period); setPeriod(next); setParams({ period: next }) }}>
          →
        </button>
      </div>

      {error ? <p className="field-error">{error}</p> : null}
      {summary === undefined ? <p>Cargando presupuesto…</p> : null}
      {summary === null ? (
        <section className="stack empty-state">
          <p>
            Aún no hay un presupuesto para este mes. Define el disponible y las categorías
            que quieres planificar; los gastos reales se registran por separado.
          </p>
          <BudgetReusePanel
            userId={user.id}
            period={period}
            categories={categories}
            budget={null}
            onCreated={load}
          />
        </section>
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

            <article className="metric-card metric-card-balance">
              <p className="metric-label">Dinero libre</p>
              <p className="metric-value">{money(freeMoney.freeMoney)}</p>
              <p className="muted">Sin asignar: {money(freeMoney.unassigned)} · liberado: {money(freeMoney.released)}</p>
            </article>

            <article className="metric-card metric-card-spent">
              <p className="metric-label">Gastado</p>
              <p className="metric-value">{money(m.spent)}</p>
            </article>

            <article
              className={`metric-card ${m.actualRemaining < 0 ? 'metric-card-over' : 'metric-card-balance'}`}
            >
              <p className="metric-label">Saldo real</p>
              <p className="metric-value">{money(m.actualRemaining)}</p>
            </article>
          </section>

          <p className="field-hint" role="note">
            <strong>Presupuestado</strong> es tu plan por categoría. <strong>Gastado</strong>{' '}
            proviene de transacciones confirmadas. Los compromisos de pagos programados son una
            previsión y no cambian el saldo real hasta que registres el pago.
          </p>

          <section className="financial-commitments" aria-label="Pagos programados del mes">
            <div>
              <p className="metric-label">Comprometido conocido</p>
              <p className="financial-commitments__amount">{money(commitments.knownAmount)}</p>
              {commitments.unknownAmountCount > 0 ? (
                <p className="muted">
                  Además: {commitments.unknownAmountCount} pago{commitments.unknownAmountCount === 1 ? '' : 's'} variable{commitments.unknownAmountCount === 1 ? '' : 's'} sin importe.
                </p>
              ) : null}
            </div>
            <div>
              <p className="metric-label">Disponible tras compromisos</p>
              <p className="financial-commitments__amount">
                {money(calculateAvailableAfterKnownCommitments(m.availableAmount, commitments.knownAmount))}
              </p>
              <p className="muted">Orientativo; no altera el saldo real.</p>
            </div>
            <div>
              <p className="metric-label">Pagos vencidos</p>
              <p className="financial-commitments__amount">{commitments.overdueCount}</p>
            </div>
            <div>
              <p className="metric-label">Próximo pago</p>
              {commitments.nextPendingPayment ? (
                <p className="financial-commitments__next">
                  <strong>{commitments.nextPendingPayment.name}</strong>
                  <span>
                    {commitments.nextPendingPayment.dueDate < todayCivil() ? 'Vencido · ' : ''}
                    {commitments.nextPendingPayment.dueDate} · {commitments.nextPendingPayment.expectedAmount == null ? 'Importe variable' : money(commitments.nextPendingPayment.expectedAmount)}
                  </span>
                </p>
              ) : (
                <p className="muted">No hay pagos pendientes este mes.</p>
              )}
            </div>
            <Link className="btn btn-ghost" to={`/budget/scheduled-payments?period=${period}`}>
              Ver pagos
            </Link>
          </section>

          <BudgetCategoryChart
            categories={summary.categories}
            categoryName={categoryLabel}
          />

          <section className="stack">
            <h2>Categorías</h2>
            {categoryIds.size === 0 ? (
              <p className="muted">Aún no hay categorías ni obligaciones para este mes. Añade una abajo o crea un pago programado.</p>
            ) : null}
            <ul className="budget-category-list">
              {[...categoryIds].map((financialCategoryId) => {
                const c = categorySummaryById.get(financialCategoryId) ?? {
                  financialCategoryId,
                  hasAllocation: false,
                  budget: 0,
                  spent: 0,
                  remaining: 0,
                  usage: null,
                  overBudget: 0,
                }
                const a = allocations.find((x) => x.financialCategoryId === financialCategoryId)
                const release = a ? releaseByAllocationId.get(a.id) : undefined
                const hasExpenses = c.spent > 0
                const paymentsCompleted = a?.paymentsCompletedAt != null && hasExpenses
                const coverage = calculateCategoryCommitmentCoverage({
                  allocated: c.budget,
                  spent: c.spent,
                  commitment: commitmentByCategory.get(financialCategoryId),
                })
                return (
                  <li className="budget-category-item" key={financialCategoryId}>
                    <div className="budget-category-item__meta">
                      <strong>{categoryLabel(financialCategoryId)}</strong>
                      <p>
                        {a
                          ? `Presupuesto: ${money(c.budget)} · Gastado en el periodo: ${money(c.spent)}`
                          : `Sin presupuesto · ${money(c.spent)} gastado`}
                      </p>
                      {coverage.knownCommitment > 0 ? (
                        <p>Comprometido conocido: {money(coverage.knownCommitment)}</p>
                      ) : null}
                      {coverage.unknownCommitmentCount > 0 ? (
                        <p>{coverage.unknownCommitmentCount} pago{coverage.unknownCommitmentCount === 1 ? '' : 's'} variable{coverage.unknownCommitmentCount === 1 ? '' : 's'} sin importe.</p>
                      ) : null}
                      {coverage.knownCommitment > 0 || coverage.unknownCommitmentCount > 0 ? (
                        <p>Cobertura prevista: {money(coverage.coverage)}</p>
                      ) : null}
                      {coverage.isKnownShortfall ? (
                        <p className="field-error">Los pagos programados superan el presupuesto de esta categoría en {money(Math.abs(coverage.coverage))}.</p>
                      ) : null}
                      {a ? (
                        <div className="stack">
                          {paymentsCompleted ? (
                            <>
                              <p className="page-status">{release && release.amount > 0 ? `Estado: pagos completados · sobrante liberado: ${money(release.amount)}` : 'Estado: pagos completados · no hay sobrante para liberar.'}</p>
                              <button className="btn btn-ghost" type="button" onClick={() => void setMonthlyBudgetAllocationPaymentsCompleted(a.id, false).then(load).catch((err) => setError(err instanceof Error ? err.message : 'No se pudo revertir la confirmación.'))}>Revertir confirmación</button>
                            </>
                          ) : !hasExpenses ? (
                            <p className="muted">Estado: pendiente · registra al menos un gasto real para poder marcar los pagos como completados.</p>
                          ) : (
                            <button className="btn btn-ghost" type="button" onClick={() => void setMonthlyBudgetAllocationPaymentsCompleted(a.id, true).then(load).catch((err) => setError(err instanceof Error ? err.message : 'No se pudo completar los pagos.'))}>Ya realicé todos los pagos</button>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="budget-category-item__actions">
                      <Link
                        className="btn-icon"
                        to={`/budget/transactions?period=${period}&category=${financialCategoryId}`}
                        aria-label={`Ver gastos de ${categoryLabel(financialCategoryId)}`}
                        title="Ver gastos"
                      >
                        <IconEye />
                      </Link>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => openTransactionDialog('expense', financialCategoryId)}
                        aria-label={`Registrar gasto en ${categoryLabel(financialCategoryId)}`}
                        title="Registrar gasto"
                      >
                        <IconPlusCircle />
                      </button>
                      {a ? (
                        <>
                          <button
                            className="btn-icon"
                            type="button"
                            onClick={() => openAllocationDialog(a)}
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

            <button type="button" className="btn btn-primary" onClick={() => openAllocationDialog()}>
              Añadir categoría al presupuesto
            </button>
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
      {allocationDialogOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAllocationDialog() }}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="allocation-dialog-title" ref={allocationDialogRef} tabIndex={-1}>
            <div className="modal-head">
              <h2 id="allocation-dialog-title">{editAllocation ? 'Editar presupuesto de categoría' : 'Añadir categoría al presupuesto'}</h2>
              <button type="button" className="btn-icon" onClick={closeAllocationDialog} aria-label="Cerrar"><IconClose /></button>
            </div>
            <form className="stack" onSubmit={saveAllocation}>
              <div className="field">
                <label htmlFor="budget-category-name">{editAllocation ? 'Categoría' : 'Nombre de categoría'}</label>
                <input id="budget-category-name" type="text" value={editAllocation ? (editingCategoryName ?? '') : categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ej. Alimentación" disabled={!!editAllocation} autoComplete="off" autoFocus data-modal-initial-focus />
              </div>
              <div className="field">
                <label htmlFor="budget-category-amount">Monto presupuestado</label>
                <input id="budget-category-amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" />
              </div>
              <button className="btn btn-primary" disabled={!canSubmitAllocation}>{editAllocation ? 'Guardar' : 'Añadir'}</button>
            </form>
          </section>
        </div>
      ) : null}
      {transactionType ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTransactionDialog() }}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="transaction-dialog-title" ref={transactionDialogRef} tabIndex={-1}>
            <div className="modal-head">
              <h2 id="transaction-dialog-title">Registrar {transactionType === 'expense' ? 'gasto' : 'ingreso'}</h2>
              <button type="button" className="btn-icon" onClick={closeTransactionDialog} aria-label="Cerrar"><IconClose /></button>
            </div>
            <TransactionForm userId={user.id} categories={categories} defaultDate={todayCivil()} defaultType={transactionType} defaultCategoryId={transactionCategoryId} onCategoryCreated={(category) => setCategories((previous) => [...previous, category])} onSaved={() => { closeTransactionDialog(); void load() }} />
          </section>
        </div>
      ) : null}
    </div>
  )
}
