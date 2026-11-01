import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { IconPencil, IconTrash } from '@/components/icons'
import { useAuth } from '@/features/auth/auth-context'
import { currentMonthlyPeriod, nextMonthlyPeriod, previousMonthlyPeriod } from '@/features/monthly-budget/period'
import { costInputValue, emptyToNull, parseCost } from '@/utils/form'
import { formatMoney } from '@/utils/format'
import { formatYearMonthLabel } from '@/utils/budget/savings-goal'
import {
  archiveManagedFund,
  createManagedFund,
  createManagedFundMovement,
  deleteManagedFundMovement,
  listManagedFundMovements,
  listManagedFunds,
  updateManagedFund,
  updateManagedFundMovement,
} from '@/features/managed-funds/managed-funds-api'
import {
  calculateManagedFundPeriodSummary,
  type ManagedFund,
  type ManagedFundMovement,
  type ManagedFundMovementType,
} from '@/features/managed-funds/domain'

function today(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type FundFormState = { fund?: ManagedFund } | null
type MovementFormState = { type: ManagedFundMovementType; movement?: ManagedFundMovement } | null

export function ManagedFundsPage() {
  const { user } = useAuth()
  const money = (value: number) => formatMoney(value, 'USD')
  const [params, setParams] = useSearchParams()
  const period = params.get('period') ?? currentMonthlyPeriod()
  const selectedId = params.get('fund')
  const [funds, setFunds] = useState<ManagedFund[] | null>(null)
  const [fundBalances, setFundBalances] = useState<Record<string, number>>({})
  const [movements, setMovements] = useState<ManagedFundMovement[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fundForm, setFundForm] = useState<FundFormState>(null)
  const [movementForm, setMovementForm] = useState<MovementFormState>(null)

  const selectedFund = funds?.find((fund) => fund.id === selectedId) ?? null

  async function loadFunds() {
    setError(null)
    try {
      const rows = await listManagedFunds()
      const histories = await Promise.all(rows.map((fund) => listManagedFundMovements(fund.id)))
      setFunds(rows)
      setFundBalances(Object.fromEntries(rows.map((fund, index) => [
        fund.id,
        calculateManagedFundPeriodSummary(histories[index] ?? [], currentMonthlyPeriod()).availableBalance,
      ])))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los fondos.')
      setFunds([])
    }
  }

  async function loadMovements(fundId: string) {
    setError(null)
    setMovements(null)
    try {
      setMovements(await listManagedFundMovements(fundId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los movimientos.')
      setMovements([])
    }
  }

  useEffect(() => { void Promise.resolve().then(loadFunds) }, [])
  useEffect(() => {
    if (!selectedId) return
    void Promise.resolve().then(() => loadMovements(selectedId))
  }, [selectedId])

  function setPeriod(nextPeriod: string) {
    setParams((current) => {
      current.set('period', nextPeriod)
      return current
    })
  }

  function selectFund(fundId: string) {
    setParams({ fund: fundId, period })
  }

  async function saveFund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !fundForm) return
    const data = new FormData(event.currentTarget)
    try {
      if (fundForm.fund) await updateManagedFund(fundForm.fund.id, { name: String(data.get('name') ?? ''), description: emptyToNull(String(data.get('description') ?? '')) })
      else {
        const created = await createManagedFund(user.id, { name: String(data.get('name') ?? ''), description: emptyToNull(String(data.get('description') ?? '')) })
        selectFund(created.id)
      }
      setFundForm(null)
      void loadFunds()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el fondo.') }
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedFund || !movementForm) return
    const data = new FormData(event.currentTarget)
    const amount = parseCost(String(data.get('amount') ?? ''))
    if (amount == null) { setError('Indica un importe válido.'); return }
    const input = { occurredOn: String(data.get('date') ?? ''), amount, type: movementForm.type, description: emptyToNull(String(data.get('description') ?? '')) }
    try {
      if (movementForm.movement) await updateManagedFundMovement(movementForm.movement.id, input)
      else await createManagedFundMovement(selectedFund.id, input)
      setMovementForm(null)
      void loadMovements(selectedFund.id)
      void loadFunds()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el movimiento.') }
  }

  async function removeMovement(movement: ManagedFundMovement) {
    if (!selectedFund || !window.confirm(`¿Eliminar este movimiento de ${money(movement.amount)}?`)) return
    try { await deleteManagedFundMovement(movement.id); void loadMovements(selectedFund.id); void loadFunds() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el movimiento.') }
  }

  async function archiveFund() {
    if (!selectedFund || !window.confirm(`¿Archivar “${selectedFund.name}”? Sus movimientos se conservarán.`)) return
    try {
      await archiveManagedFund(selectedFund.id)
      setParams({ period })
      void loadFunds()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo archivar el fondo.') }
  }

  if (!user) return null
  const summary = selectedFund && movements ? calculateManagedFundPeriodSummary(movements, period) : null
  const periodMovements = movements?.filter((movement) => movement.occurredOn.startsWith(`${period}-`)) ?? []

  return <div className="page stack">
    <header className="page-header row-between"><div><h1>Fondos administrados</h1><p className="muted">Dinero de terceros, separado de tus finanzas personales.</p></div><button className="btn btn-primary" onClick={() => setFundForm({})}>Crear fondo</button></header>
    {error ? <p className="field-error" role="alert">{error}</p> : null}
    {funds === null ? <p className="page-status" role="status">Cargando fondos…</p> : null}
    {funds?.length === 0 ? <div className="empty-state stack"><p>Aún no administras ningún fondo.</p><button className="btn btn-primary" onClick={() => setFundForm({})}>Crear primer fondo</button></div> : null}
    {funds?.length ? <section className="stack" aria-label="Tus fondos"><h2>Fondos</h2><ul className="transaction-list">{funds.map((fund) => {
      const fundBalance = fundBalances[fund.id] ?? 0
      return <li key={fund.id} className="card row-between"><div><strong>{fund.name}</strong><p className="muted">{fund.archivedAt ? 'Archivado' : fund.description ?? 'Sin descripción'}</p></div><div className="row"><strong>{money(fundBalance)}</strong><button className="btn" onClick={() => selectFund(fund.id)}>Abrir</button></div></li>
    })}</ul></section> : null}
    {selectedId && !selectedFund && funds ? <p className="field-error">El fondo solicitado no está disponible.</p> : null}
    {selectedFund ? <section className="stack" aria-labelledby="managed-fund-detail-title">
      <header className="row-between"><div><h2 id="managed-fund-detail-title">{selectedFund.name}</h2>{selectedFund.description ? <p className="muted">{selectedFund.description}</p> : null}</div><div className="row"><button className="btn" onClick={() => setFundForm({ fund: selectedFund })}>Editar fondo</button>{!selectedFund.archivedAt ? <button className="btn btn-danger" onClick={() => void archiveFund()}>Archivar</button> : null}</div></header>
      {selectedFund.archivedAt ? <p className="page-status">Este fondo está archivado. Su historial permanece disponible.</p> : null}
      <div className="month-nav"><button className="btn" aria-label="Mes anterior" onClick={() => setPeriod(previousMonthlyPeriod(period))}>←</button><strong>{formatYearMonthLabel(period)}</strong><button className="btn" aria-label="Mes siguiente" onClick={() => setPeriod(nextMonthlyPeriod(period))}>→</button></div>
      {movements === null ? <p className="page-status">Calculando saldos…</p> : null}
      {summary ? <div className="metrics-grid"><article className="metric-card"><span className="metric-label">Saldo disponible</span><strong className="metric-value">{money(summary.availableBalance)}</strong></article><article className="metric-card"><span className="metric-label">Saldo inicial</span><strong className="metric-value">{money(summary.openingBalance)}</strong></article><article className="metric-card"><span className="metric-label">Entradas del mes</span><strong className="metric-value amount-income">+{money(summary.income)}</strong></article><article className="metric-card"><span className="metric-label">Gastos del mes</span><strong className="metric-value amount-expense">−{money(summary.expenses)}</strong></article><article className="metric-card"><span className="metric-label">Saldo final del mes</span><strong className="metric-value">{money(summary.closingBalance)}</strong></article></div> : null}
      {!selectedFund.archivedAt ? <div className="row"><button className="btn btn-primary" onClick={() => setMovementForm({ type: 'income' })}>Registrar entrada</button><button className="btn" onClick={() => setMovementForm({ type: 'expense' })}>Registrar gasto</button></div> : null}
      <section className="stack"><h3>Movimientos de {formatYearMonthLabel(period)}</h3>{movements && periodMovements.length === 0 ? <div className="empty-state"><p>No hay movimientos en este mes. El saldo anterior se conserva automáticamente.</p></div> : null}<ul className="transaction-list">{periodMovements.map((movement) => <li key={movement.id} className="card row-between"><div><strong>{movement.description ?? (movement.type === 'income' ? 'Entrada' : 'Gasto')}</strong><p className="muted">{movement.occurredOn} · {movement.type === 'income' ? 'Entrada' : 'Gasto'}</p></div><div className="row"><strong className={movement.type === 'income' ? 'amount-income' : 'amount-expense'}>{movement.type === 'income' ? '+' : '−'}{money(movement.amount)}</strong>{!selectedFund.archivedAt ? <><button className="btn-icon" onClick={() => setMovementForm({ type: movement.type, movement })} aria-label="Editar movimiento"><IconPencil /></button><button className="btn-icon btn-icon-danger" onClick={() => void removeMovement(movement)} aria-label="Eliminar movimiento"><IconTrash /></button></> : null}</div></li>)}</ul></section>
    </section> : null}
    {fundForm ? <section className="card stack" aria-label="Formulario de fondo"><h2>{fundForm.fund ? 'Editar fondo' : 'Nuevo fondo'}</h2><form className="stack" onSubmit={saveFund}><label>Nombre<input name="name" required defaultValue={fundForm.fund?.name ?? ''} /></label><label>Descripción (opcional)<textarea name="description" defaultValue={fundForm.fund?.description ?? ''} /></label><div className="row"><button className="btn btn-primary" type="submit">Guardar</button><button className="btn" type="button" onClick={() => setFundForm(null)}>Cancelar</button></div></form></section> : null}
    {movementForm ? <section className="card stack" aria-label="Formulario de movimiento"><h2>{movementForm.movement ? 'Editar movimiento' : movementForm.type === 'income' ? 'Registrar entrada' : 'Registrar gasto'}</h2><form className="stack" onSubmit={saveMovement}><label>Fecha<input name="date" type="date" required defaultValue={movementForm.movement?.occurredOn ?? (period === currentMonthlyPeriod() ? today() : `${period}-01`)} /></label><label>Importe (USD)<input name="amount" type="number" min="0.01" step="0.01" required defaultValue={costInputValue(movementForm.movement?.amount ?? null)} /></label><label>Descripción{movementForm.type === 'expense' ? '' : ' (opcional)'}<textarea name="description" required={movementForm.type === 'expense'} defaultValue={movementForm.movement?.description ?? ''} /></label><div className="row"><button className="btn btn-primary" type="submit">Guardar</button><button className="btn" type="button" onClick={() => setMovementForm(null)}>Cancelar</button></div></form></section> : null}
  </div>
}
