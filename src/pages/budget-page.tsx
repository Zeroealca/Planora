import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
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
  setMonthlyBudgetAllocationManualCompletion,
  updateMonthlyBudgetAllocationAmount,
  updateMonthlyBudgetAllocationPaymentSettings,
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
import { formatYearMonthLabel } from '@/utils/budget/savings-goal'
import { costInputValue, parseCost } from '@/utils/form'
import { useFormatMoney } from '@/utils/format'

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
  const [paymentMode, setPaymentMode] = useState<'multiple' | 'single'>('multiple')
  const [scheduledPaymentId, setScheduledPaymentId] = useState('')
  const [manualTransactionId, setManualTransactionId] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

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
    setPaymentMode('multiple')
    setScheduledPaymentId('')
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
        await updateMonthlyBudgetAllocationPaymentSettings({
          allocationId: editAllocation.id,
          paymentMode,
          scheduledPaymentId: paymentMode === 'single' && scheduledPaymentId !== ''
            ? scheduledPaymentId
            : null,
        })
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
    occurrences: scheduledOccurrences,
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
            <Link className="btn btn-primary" to={`/budget/transactions?period=${period}&create=1`}>
              Registrar gasto
            </Link>
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
                const manualCandidates = a?.paymentMode === 'single' && a.scheduledPaymentId === null
                  ? transactions.filter((transaction) => transaction.type === 'expense' && transaction.financialCategoryId === a.financialCategoryId)
                  : []
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
                          ? `${money(c.spent)} de ${money(c.budget)}`
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
                      {a?.paymentMode === 'single' ? (
                        <div className="stack">
                          <p>
                            <strong>Un pago por periodo.</strong>{' '}
                            {a.scheduledPaymentId
                              ? 'Se completa automáticamente solo con la ocurrencia pagada y su transacción de este periodo.'
                              : 'Requiere confirmar una transacción concreta de este periodo.'}
                          </p>
                          {release ? (
                            <>
                              <p className="page-status">{release.amount > 0 ? `Pago completado · sobrante liberado: ${money(release.amount)}` : 'Pago completado · no hay sobrante para liberar.'}</p>
                              {release.source === 'manual' ? (
                                <button className="btn btn-ghost" type="button" onClick={() => void setMonthlyBudgetAllocationManualCompletion(a.id, null).then(load).catch((err) => setError(err instanceof Error ? err.message : 'No se pudo revertir la confirmación.'))}>Revertir confirmación</button>
                              ) : null}
                            </>
                          ) : a.scheduledPaymentId ? (
                            <p className="muted">Pendiente: no hay una ocurrencia pagada con una transacción válida en este periodo.</p>
                          ) : a.manualCompletionTransactionId ? (
                            <>
                              <p className="muted">Confirmado manualmente, pero la transacción ya no es válida para este periodo; no se libera dinero.</p>
                              <button className="btn btn-ghost" type="button" onClick={() => void setMonthlyBudgetAllocationManualCompletion(a.id, null).then(load).catch((err) => setError(err instanceof Error ? err.message : 'No se pudo revertir la confirmación.'))}>Revertir confirmación</button>
                            </>
                          ) : manualCandidates.length === 0 ? (
                            <p className="muted">No se puede liberar dinero: registra y selecciona un gasto real de esta categoría y periodo.</p>
                          ) : (
                            <div className="row">
                              <label className="sr-only" htmlFor={`manual-payment-${a.id}`}>Transacción que completa el pago</label>
                              <select id={`manual-payment-${a.id}`} value={manualTransactionId[a.id] ?? ''} onChange={(event) => setManualTransactionId((current) => ({ ...current, [a.id]: event.target.value }))}>
                                <option value="">Selecciona el gasto real</option>
                                {manualCandidates.map((transaction) => <option key={transaction.id} value={transaction.id}>{transaction.occurredOn} · {transaction.name} · {money(transaction.amount)}</option>)}
                              </select>
                              <button className="btn btn-ghost" type="button" disabled={!manualTransactionId[a.id]} onClick={() => void setMonthlyBudgetAllocationManualCompletion(a.id, manualTransactionId[a.id] ?? null).then(load).catch((err) => setError(err instanceof Error ? err.message : 'No se pudo confirmar el pago.'))}>Confirmar pago</button>
                            </div>
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
                      <Link
                        className="btn-icon"
                        to={`/budget/transactions?period=${period}&create=1&category=${financialCategoryId}`}
                        aria-label={`Registrar gasto en ${categoryLabel(financialCategoryId)}`}
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
                              setPaymentMode(a.paymentMode)
                              setScheduledPaymentId(a.scheduledPaymentId ?? '')
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
              {editAllocation ? (
                <>
                  <div className="field">
                    <label htmlFor="budget-payment-mode">Pagos por periodo</label>
                    <select id="budget-payment-mode" value={paymentMode} onChange={(event) => setPaymentMode(event.target.value === 'single' ? 'single' : 'multiple')}>
                      <option value="multiple">Múltiples pagos por periodo</option>
                      <option value="single">Un pago por periodo</option>
                    </select>
                  </div>
                  {paymentMode === 'single' ? (
                    <div className="field">
                      <label htmlFor="budget-scheduled-payment">Pago programado vinculado (opcional)</label>
                      <select id="budget-scheduled-payment" value={scheduledPaymentId} onChange={(event) => setScheduledPaymentId(event.target.value)}>
                        <option value="">Sin vínculo: confirmación manual</option>
                        {scheduledPayments.filter((payment) => payment.financialCategoryId === editAllocation.financialCategoryId).map((payment) => <option key={payment.id} value={payment.id}>{payment.name} · {payment.frequency === 'annual' ? 'anual' : payment.frequency === 'monthly' ? 'mensual' : 'único'}</option>)}
                      </select>
                    </div>
                  ) : null}
                </>
              ) : null}
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
