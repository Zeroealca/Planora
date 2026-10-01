import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { IconBack, IconClose, IconPencil, IconTrash } from '@/components/icons'
import { useAuth } from '@/features/auth/auth-context'
import { listFinancialCategories } from '@/features/monthly-budget/monthly-budget-api'
import type { FinancialCategory, MonthlyPeriod } from '@/features/monthly-budget/domain'
import { currentMonthlyPeriod, monthlyPeriodBounds, nextMonthlyPeriod, previousMonthlyPeriod } from '@/features/monthly-budget/period'
import {
  listScheduledPaymentOccurrences,
  listScheduledPaymentOccurrencesForPeriod,
  listScheduledPaymentOccurrencesInRange,
  listScheduledPaymentReminderDeliveries,
  listScheduledPayments,
  markScheduledPaymentOccurrencePaid,
  materializeScheduledPaymentsForPeriod,
  skipScheduledPaymentOccurrence,
  createScheduledPayment,
  deleteScheduledPayment,
  updateScheduledPayment,
} from '@/features/scheduled-payments/scheduled-payment-api'
import {
  isOccurrenceOverdue,
  summarizeOccurrences,
  type ScheduledPayment,
  type ScheduledPaymentInput,
  type ScheduledPaymentOccurrence,
} from '@/features/scheduled-payments/domain'
import {
  calculateExpenseProjection,
  periodsForHorizon,
  type ExpenseProjection,
  type ForecastHorizonMonths,
  type ProjectedPaymentLine,
} from '@/features/scheduled-payments/forecast'
import {
  defaultReminderConfig,
  formatReminderSummary,
  type ScheduledPaymentReminderDelivery,
} from '@/features/scheduled-payments/reminders'
import { formatYearMonthLabel } from '@/utils/budget/savings-goal'
import { costInputValue, emptyToNull, parseCost } from '@/utils/form'
import { useFormatMoney } from '@/utils/format'

function todayCivil(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function frequencyLabel(frequency: ScheduledPayment['frequency']): string {
  if (frequency === 'one_time') return 'Una sola vez'
  if (frequency === 'annual') return 'Anual'
  return 'Mensual'
}

/** Plain amount, soft estimate (~), or unknown variable — no technical jargon. */
function formatProjectedAmount(
  line: ProjectedPaymentLine,
  money: (value: number) => string,
): string {
  if (line.expectedAmount == null) return 'Importe variable'
  if (line.amountType === 'variable' && line.source === 'rule') return `~${money(line.expectedAmount)}`
  return money(line.expectedAmount)
}

function inputFromPayment(payment: ScheduledPayment): ScheduledPaymentInput {
  return {
    userId: payment.userId,
    name: payment.name,
    financialCategoryId: payment.financialCategoryId,
    frequency: payment.frequency,
    amountType: payment.amountType,
    expectedAmount: payment.expectedAmount,
    startDate: payment.startDate,
    endDate: payment.endDate,
    active: payment.active,
    reminderEnabled: payment.reminderEnabled,
    reminderDaysBefore: payment.reminderDaysBefore,
  }
}

function blankInput(userId: string): ScheduledPaymentInput {
  const reminder = defaultReminderConfig()
  return {
    userId,
    name: '',
    financialCategoryId: '',
    frequency: 'monthly',
    amountType: 'fixed',
    expectedAmount: null,
    startDate: todayCivil(),
    endDate: null,
    active: true,
    reminderEnabled: reminder.reminderEnabled,
    reminderDaysBefore: reminder.reminderDaysBefore,
  }
}

export function ScheduledPaymentsPage() {
  const { user } = useAuth()
  const money = useFormatMoney()
  const [period, setPeriod] = useState<MonthlyPeriod>(currentMonthlyPeriod())
  const [payments, setPayments] = useState<ScheduledPayment[]>([])
  const [occurrences, setOccurrences] = useState<ScheduledPaymentOccurrence[] | null>(null)
  const [deliveries, setDeliveries] = useState<ScheduledPaymentReminderDelivery[]>([])
  const [categories, setCategories] = useState<FinancialCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ScheduledPayment | null>(null)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [paying, setPaying] = useState<ScheduledPaymentOccurrence | null>(null)
  const [history, setHistory] = useState<{ payment: ScheduledPayment; rows: ScheduledPaymentOccurrence[] } | null>(null)
  const [horizonMonths, setHorizonMonths] = useState<ForecastHorizonMonths>(3)
  const [projection, setProjection] = useState<ExpenseProjection | null>(null)
  const [expandedForecastPeriod, setExpandedForecastPeriod] = useState<MonthlyPeriod | null>(null)

  async function load() {
    setError(null)
    setOccurrences(null)
    try {
      const [rules, cats] = await Promise.all([listScheduledPayments(), listFinancialCategories(true)])
      await materializeScheduledPaymentsForPeriod(period)
      setPayments(rules)
      setCategories(cats)
      const periodOccurrences = await listScheduledPaymentOccurrencesForPeriod(period)
      setOccurrences(periodOccurrences)
      setDeliveries(await listScheduledPaymentReminderDeliveries(periodOccurrences.map((row) => row.id)))

      const horizonPeriods = periodsForHorizon(period, horizonMonths)
      const lastPeriod = horizonPeriods[horizonPeriods.length - 1]!
      const rangeStart = monthlyPeriodBounds(period).start
      const rangeEndExclusive = monthlyPeriodBounds(lastPeriod).endExclusive
      const horizonOccurrences = await listScheduledPaymentOccurrencesInRange(
        rangeStart,
        rangeEndExclusive,
      )
      const categoriesById = new Map(
        cats.map((category) => [category.id, { archivedAt: category.archivedAt }] as const),
      )
      setProjection(
        calculateExpenseProjection({
          startPeriod: period,
          horizonMonths,
          payments: rules,
          categoriesById,
          occurrencesInHorizon: horizonOccurrences,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pagos programados.')
      setOccurrences([])
      setDeliveries([])
      setProjection(null)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when month or forecast horizon changes
  useEffect(() => { void Promise.resolve().then(load) }, [period, horizonMonths])

  if (!user) return null

  const ruleName = (id: string) => payments.find((payment) => payment.id === id)?.name ?? 'Pago programado'
  const category = (id: string) => categories.find((item) => item.id === id)
  const summary = occurrences ? summarizeOccurrences(occurrences, todayCivil()) : null
  const sentReminderIds = new Set(
    deliveries.filter((delivery) => delivery.status === 'sent').map((delivery) => delivery.occurrenceId),
  )

  async function openHistory(payment: ScheduledPayment) {
    try {
      setHistory({ payment, rows: await listScheduledPaymentOccurrences(payment.id) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.')
    }
  }

  async function deactivate(payment: ScheduledPayment) {
    if (!window.confirm(`¿${payment.active ? 'Desactivar' : 'Reactivar'} “${payment.name}”?`)) return
    try {
      await updateScheduledPayment(payment.id, { ...inputFromPayment(payment), active: !payment.active })
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el pago.')
    }
  }

  async function remove(payment: ScheduledPayment) {
    if (
      !window.confirm(
        `¿Eliminar “${payment.name}”? Se borrarán sus vencimientos y recordatorios. Las transacciones ya registradas se conservan.`,
      )
    ) {
      return
    }
    try {
      await deleteScheduledPayment(payment.id)
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el pago programado.')
    }
  }

  async function skip(occurrence: ScheduledPaymentOccurrence) {
    if (!window.confirm('¿Omitir este vencimiento? No se creará una transacción.')) return
    try {
      await skipScheduledPaymentOccurrence(occurrence)
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo omitir el vencimiento.')
    }
  }

  return (
    <div className="page">
      <p>
        <Link to="/budget" className="back-link">
          <IconBack />
          Volver a presupuesto
        </Link>
      </p>
      <header className="page-header row-between">
        <div>
          <h1>Pagos programados</h1>
          <p className="muted">Obligaciones por vencer; el pago siempre se confirma manualmente.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null)
            setShowRuleForm(true)
          }}
        >
          Nuevo pago
        </button>
      </header>
      <div className="month-nav">
        <button className="btn" aria-label="Mes anterior" onClick={() => setPeriod(previousMonthlyPeriod(period))}>
          ←
        </button>
        <strong>{formatYearMonthLabel(period)}</strong>
        <button className="btn" aria-label="Mes siguiente" onClick={() => setPeriod(nextMonthlyPeriod(period))}>
          →
        </button>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {summary ? (
        <section className="metrics-grid metrics-grid-secondary" aria-label="Resumen de pagos programados">
          <article className="metric-card">
            <p className="metric-label">Vencimientos</p>
            <p className="metric-value">{summary.total}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Pendientes</p>
            <p className="metric-value">{summary.pending}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Pagados</p>
            <p className="metric-value">{summary.paid}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Vencidos</p>
            <p className="metric-value">{summary.overdue}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Pendiente conocido</p>
            <p className="metric-value">{money(summary.pendingKnownAmount)}</p>
            {summary.pendingUnknownAmountCount ? (
              <p className="muted">
                + {summary.pendingUnknownAmountCount} variable
                {summary.pendingUnknownAmountCount === 1 ? '' : 's'}
              </p>
            ) : null}
          </article>
        </section>
      ) : null}
      {occurrences === null ? <p className="page-status">Cargando vencimientos…</p> : null}
      {occurrences?.length === 0 ? (
        <div className="empty-state stack">
          <p>No hay pagos programados para este mes.</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null)
              setShowRuleForm(true)
            }}
          >
            Crear pago programado
          </button>
        </div>
      ) : null}
      {occurrences?.length ? (
        <section className="stack">
          <h2>Vencimientos del mes</h2>
          <ul className="transaction-list">
            {occurrences.map((occurrence) => {
              const overdue = isOccurrenceOverdue(occurrence, todayCivil())
              const payment = payments.find((item) => item.id === occurrence.scheduledPaymentId)
              const label =
                occurrence.status === 'paid'
                  ? 'Pagado'
                  : occurrence.status === 'skipped'
                    ? 'Omitido'
                    : overdue
                      ? 'Vencido'
                      : 'Pendiente'
              return (
                <li key={occurrence.id} className="card row-between">
                  <div>
                    <strong>{ruleName(occurrence.scheduledPaymentId)}</strong>
                    <p className="muted">
                      Vence {occurrence.dueDate} ·{' '}
                      {occurrence.expectedAmount == null ? 'Importe variable' : money(occurrence.expectedAmount)}
                    </p>
                    <span className="badge">{label}</span>
                    {sentReminderIds.has(occurrence.id) ? (
                      <p className="muted">Recordatorio enviado</p>
                    ) : null}
                  </div>
                  <div className="row">
                    {occurrence.status === 'pending' ? (
                      <>
                        <button className="btn btn-primary" onClick={() => setPaying(occurrence)}>
                          Marcar pagado
                        </button>
                        <button className="btn" onClick={() => void skip(occurrence)}>
                          Omitir
                        </button>
                      </>
                    ) : null}
                    {occurrence.status === 'paid' && occurrence.transactionId ? (
                      <Link className="btn" to={`/budget/transactions?transaction=${occurrence.transactionId}`}>
                        Ver transacción
                      </Link>
                    ) : null}
                    {payment ? (
                      <button className="btn btn-ghost" onClick={() => void openHistory(payment)}>
                        Historial
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
      <UpcomingExpensesSection
        projection={projection}
        horizonMonths={horizonMonths}
        expandedPeriod={expandedForecastPeriod}
        money={money}
        onHorizonChange={setHorizonMonths}
        onTogglePeriod={(next) =>
          setExpandedForecastPeriod((current) => (current === next ? null : next))
        }
      />
      <section className="stack">
        <div className="row-between">
          <h2>Reglas</h2>
        </div>
        {payments.length === 0 ? (
          <p className="muted">Aún no hay reglas creadas.</p>
        ) : (
          <ul className="transaction-list">
            {payments.map((payment) => {
              const categoryRow = category(payment.financialCategoryId)
              return (
                <li key={payment.id} className="card row-between">
                  <div>
                    <strong>{payment.name}</strong>
                    <p className="muted">
                      {frequencyLabel(payment.frequency)} ·{' '}
                      {payment.amountType === 'fixed' ? 'Fijo' : 'Variable'} ·{' '}
                      {categoryRow?.name ?? 'Categoría eliminada'}
                      {payment.frequency === 'one_time' ? ` · ${payment.startDate}` : ''}
                    </p>
                    <p className="muted">
                      {formatReminderSummary({
                        reminderEnabled: payment.reminderEnabled,
                        reminderDaysBefore: payment.reminderDaysBefore,
                      })}
                    </p>
                    {!payment.active ? <span className="badge">Inactivo</span> : null}
                    {categoryRow?.archivedAt ? (
                      <p className="field-error">
                        Requiere atención: la categoría está archivada. Selecciona una activa.
                      </p>
                    ) : null}
                  </div>
                  <div className="row">
                    <button
                      className="btn-icon"
                      aria-label={`Editar ${payment.name}`}
                      onClick={() => {
                        setEditing(payment)
                        setShowRuleForm(true)
                      }}
                    >
                      <IconPencil />
                    </button>
                    <button className="btn" onClick={() => void deactivate(payment)}>
                      {payment.active ? 'Desactivar' : 'Reactivar'}
                    </button>
                    <button
                      className="btn-icon btn-icon-danger"
                      aria-label={`Eliminar ${payment.name}`}
                      title="Eliminar"
                      onClick={() => void remove(payment)}
                    >
                      <IconTrash />
                    </button>
                    <button className="btn btn-ghost" onClick={() => void openHistory(payment)}>
                      Historial
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {showRuleForm ? (
        <RuleModal
          userId={user.id}
          categories={categories}
          payment={editing ?? undefined}
          onClose={() => setShowRuleForm(false)}
          onSaved={() => {
            setShowRuleForm(false)
            void load()
          }}
        />
      ) : null}
      {paying ? (
        <PaymentModal
          occurrence={paying}
          payment={payments.find((item) => item.id === paying.scheduledPaymentId)}
          categoryName={
            category(payments.find((item) => item.id === paying.scheduledPaymentId)?.financialCategoryId ?? '')
              ?.name ?? 'Categoría'
          }
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null)
            void load()
          }}
        />
      ) : null}
      {history ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHistory(null)
          }}
        >
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="history-title">
            <div className="modal-head">
              <h2 id="history-title">Historial: {history.payment.name}</h2>
              <button className="btn-icon" aria-label="Cerrar" onClick={() => setHistory(null)}>
                <IconClose />
              </button>
            </div>
            <ul className="transaction-list">
              {history.rows.map((row) => (
                <li className="card row-between" key={row.id}>
                  <span>{row.dueDate}</span>
                  <span>
                    {row.expectedAmount == null ? 'Variable' : money(row.expectedAmount)} ·{' '}
                    {row.status === 'pending' ? 'Pendiente' : row.status === 'paid' ? 'Pagado' : 'Omitido'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function UpcomingExpensesSection({
  projection,
  horizonMonths,
  expandedPeriod,
  money,
  onHorizonChange,
  onTogglePeriod,
}: {
  projection: ExpenseProjection | null
  horizonMonths: ForecastHorizonMonths
  expandedPeriod: MonthlyPeriod | null
  money: (value: number) => string
  onHorizonChange: (value: ForecastHorizonMonths) => void
  onTogglePeriod: (period: MonthlyPeriod) => void
}) {
  return (
    <section className="stack" aria-label="Próximos gastos">
      <div className="row-between">
        <div>
          <h2>Próximos gastos</h2>
          <p className="muted">Obligaciones esperadas; no es gasto registrado.</p>
        </div>
        <div className="field">
          <label htmlFor="forecast-horizon">Horizonte</label>
          <select
            id="forecast-horizon"
            value={horizonMonths}
            onChange={(event) => onHorizonChange(Number(event.target.value) as ForecastHorizonMonths)}
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </div>
      </div>
      {projection === null ? <p className="page-status">Calculando proyección…</p> : null}
      {projection ? (
        <>
          <p>
            <strong>
              Total conocido próximos {projection.horizonMonths} meses: {money(projection.totalKnownExpectedAmount)}
            </strong>
            {projection.totalUnknownVariableCount > 0 ? (
              <span className="muted">
                {' '}
                + {projection.totalUnknownVariableCount} importe
                {projection.totalUnknownVariableCount === 1 ? '' : 's'} variable
                {projection.totalUnknownVariableCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </p>
          <ul className="transaction-list">
            {projection.months.map((month) => {
              const expanded = expandedPeriod === month.period
              return (
                <li key={month.period} className="card stack">
                  <button
                    type="button"
                    className="btn btn-ghost row-between"
                    style={{ width: '100%' }}
                    aria-expanded={expanded}
                    onClick={() => onTogglePeriod(month.period)}
                  >
                    <strong>{formatYearMonthLabel(month.period)}</strong>
                    <span className="muted">{expanded ? 'Ocultar' : 'Ver detalle'}</span>
                  </button>
                  <p className="muted">
                    Esperado conocido: {money(month.knownExpectedAmount)}
                    {month.unknownVariableCount > 0
                      ? ` · ${month.unknownVariableCount} gasto${month.unknownVariableCount === 1 ? '' : 's'} variable${month.unknownVariableCount === 1 ? '' : 's'}`
                      : ''}
                    {month.paidCount > 0 ? ` · ${month.paidCount} pagado${month.paidCount === 1 ? '' : 's'}` : ''}
                  </p>
                  {expanded ? (
                    month.lines.length === 0 ? (
                      <p className="muted">Sin obligaciones en este mes.</p>
                    ) : (
                      <ul className="transaction-list">
                        {month.lines.map((line) => (
                          <li key={`${line.scheduledPaymentId}-${line.dueDate}`} className="row-between">
                            <div>
                              <strong>{line.name}</strong>
                              <p className="muted">
                                Vence {line.dueDate}
                                {line.status === 'paid'
                                  ? ' · Pagado'
                                  : line.status === 'skipped'
                                    ? ' · Omitido'
                                    : ''}
                              </p>
                            </div>
                            <span>{formatProjectedAmount(line, money)}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </section>
  )
}

function RuleModal({
  userId,
  categories,
  payment,
  onClose,
  onSaved,
}: {
  userId: string
  categories: readonly FinancialCategory[]
  payment?: ScheduledPayment
  onClose: () => void
  onSaved: () => void
}) {
  const initial = payment ? inputFromPayment(payment) : blankInput(userId)
  const [form, setForm] = useState(initial)
  const [amount, setAmount] = useState(costInputValue(initial.expectedAmount))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const activeCategories = categories.filter(
    (category) => !category.archivedAt || category.id === form.financialCategoryId,
  )

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = parseCost(amount)
    const expectedAmount = amount.trim() === '' ? null : parsed
    if (expectedAmount != null && (Number.isNaN(expectedAmount) || expectedAmount <= 0)) {
      setError('El importe esperado debe ser mayor a cero.')
      return
    }
    if (
      form.reminderEnabled &&
      (!Number.isInteger(form.reminderDaysBefore) || form.reminderDaysBefore < 0)
    ) {
      setError('Los días de anticipación deben ser un entero mayor o igual a cero.')
      return
    }
    setSaving(true)
    try {
      const input = {
        ...form,
        expectedAmount,
        endDate: form.frequency === 'one_time' ? null : form.endDate,
      }
      if (payment) await updateScheduledPayment(payment.id, input)
      else await createScheduledPayment(input)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el pago.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="rule-title">
        <div className="modal-head">
          <h2 id="rule-title">{payment ? 'Editar pago programado' : 'Nuevo pago programado'}</h2>
          <button className="btn-icon" aria-label="Cerrar" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <form className="stack" onSubmit={save}>
          <div className="field">
            <label htmlFor="scheduled-name">Nombre</label>
            <input
              id="scheduled-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="scheduled-category">Categoría</label>
            <select
              id="scheduled-category"
              value={form.financialCategoryId}
              onChange={(event) => setForm({ ...form, financialCategoryId: event.target.value })}
              required
            >
              <option value="">Selecciona una categoría</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.archivedAt ? ' (archivada)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="scheduled-frequency">Frecuencia</label>
            <select
              id="scheduled-frequency"
              value={form.frequency}
              onChange={(event) => {
                const frequency = event.target.value as ScheduledPayment['frequency']
                setForm({
                  ...form,
                  frequency,
                  endDate: frequency === 'one_time' ? null : form.endDate,
                })
              }}
            >
              <option value="one_time">Una sola vez</option>
              <option value="monthly">Mensual</option>
              <option value="annual">Anual</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="scheduled-amount-type">Tipo de importe</label>
            <select
              id="scheduled-amount-type"
              value={form.amountType}
              onChange={(event) =>
                setForm({ ...form, amountType: event.target.value as ScheduledPayment['amountType'] })
              }
            >
              <option value="fixed">Fijo</option>
              <option value="variable">Variable</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="scheduled-amount">
              Importe esperado {form.amountType === 'fixed' ? '' : '(opcional)'}
            </label>
            <input
              id="scheduled-amount"
              type="number"
              min="0.01"
              step="0.01"
              required={form.amountType === 'fixed'}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="scheduled-start">
              {form.frequency === 'one_time' ? 'Fecha de vencimiento' : 'Fecha del primer vencimiento'}
            </label>
            <input
              id="scheduled-start"
              type="date"
              value={form.startDate}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              required
            />
          </div>
          {form.frequency !== 'one_time' ? (
            <div className="field">
              <label htmlFor="scheduled-end">Fecha final (opcional)</label>
              <input
                id="scheduled-end"
                type="date"
                min={form.startDate}
                value={form.endDate ?? ''}
                onChange={(event) => setForm({ ...form, endDate: emptyToNull(event.target.value) })}
              />
            </div>
          ) : null}
          <fieldset className="stack">
            <legend>Recordatorio por correo</legend>
            <label className="row">
              <input
                type="checkbox"
                checked={form.reminderEnabled}
                onChange={(event) => setForm({ ...form, reminderEnabled: event.target.checked })}
              />
              Activar recordatorio
            </label>
            {form.reminderEnabled ? (
              <>
                <div className="field">
                  <label htmlFor="scheduled-reminder-days">Avisarme (días antes)</label>
                  <input
                    id="scheduled-reminder-days"
                    type="number"
                    min={0}
                    step={1}
                    value={form.reminderDaysBefore}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        reminderDaysBefore: Number.parseInt(event.target.value, 10) || 0,
                      })
                    }
                    required
                  />
                  <p className="muted">0 = el día del vencimiento · 7 = una semana antes</p>
                </div>
                <p className="muted">Se enviará al correo de tu cuenta.</p>
              </>
            ) : null}
          </fieldset>
          {payment ? (
            <p className="muted">
              {payment.frequency === 'one_time'
                ? 'Si ya existe el vencimiento, su fecha e importe no se reescriben al editar la regla.'
                : 'Los cambios aplican a futuros vencimientos; el historial no se reescribe.'}
            </p>
          ) : null}
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar pago'}
          </button>
        </form>
      </section>
    </div>
  )
}

function PaymentModal({
  occurrence,
  payment,
  categoryName,
  onClose,
  onSaved,
}: {
  occurrence: ScheduledPaymentOccurrence
  payment?: ScheduledPayment
  categoryName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(costInputValue(occurrence.expectedAmount))
  const [date, setDate] = useState(todayCivil())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    const parsed = parseCost(amount)
    setSaving(true)
    setError(null)
    try {
      await markScheduledPaymentOccurrencePaid({
        occurrence,
        amount: parsed,
        occurredOn: date,
        notes: emptyToNull(notes),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <div className="modal-head">
          <h2 id="payment-title">Registrar pago</h2>
          <button className="btn-icon" aria-label="Cerrar" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <form className="stack" onSubmit={save}>
          <p>
            <strong>{payment?.name ?? 'Pago programado'}</strong>
            <br />
            <span className="muted">
              {categoryName} · Vence {occurrence.dueDate}
            </span>
          </p>
          {occurrence.expectedAmount != null ? (
            <p className="muted">Importe esperado: {occurrence.expectedAmount}</p>
          ) : (
            <p className="muted">Importe variable: indica el importe real.</p>
          )}
          <div className="field">
            <label htmlFor="payment-amount">Importe pagado</label>
            <input
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="payment-date">Fecha de pago</label>
            <input
              id="payment-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="payment-notes">Notas (opcional)</label>
            <textarea
              id="payment-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Registrando…' : 'Confirmar pago'}
          </button>
        </form>
      </section>
    </div>
  )
}
