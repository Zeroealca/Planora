import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { listFinancialCategories } from '@/features/monthly-budget/monthly-budget-api'
import { getMonthlyBudgetPeriodSummary } from '@/features/monthly-budget/monthly-budget-summary-api'
import {
  currentMonthlyPeriod,
  nextMonthlyPeriod,
  previousMonthlyPeriod,
} from '@/features/monthly-budget/period'
import type { FinancialCategory } from '@/features/monthly-budget/domain'
import {
  fetchProjects,
  listSavingsMovementsForProjects,
  type ProjectListEntry,
} from '@/features/projects/project-api'
import { isSavingsGoalProject } from '@/features/projects/project-kind'
import { useProfile } from '@/features/profile/profile-context'
import {
  listScheduledPaymentOccurrencesForPeriod,
  listScheduledPayments,
} from '@/features/scheduled-payments/scheduled-payment-api'
import { calculateMonthlyScheduledCommitments } from '@/features/scheduled-payments/commitments'
import { formatCivilDateLong } from '@/features/scheduled-payments/reminders'
import { listTransactions } from '@/features/transactions/transaction-api'
import type { FinancialTransaction } from '@/features/transactions/domain'
import {
  calculateActualSpent,
  calculateCompletionPercentage,
  calculatePlannedBudget,
} from '@/utils/budget/calculations'
import { formatYearMonthLabel } from '@/utils/budget/savings-goal'
import { formatPercent, useFormatMoney } from '@/utils/format'
import type { ProjectSavingsMovement } from '@/types/domain'
import {
  calculateGoalAccumulatedBalance,
  calculateGoalProgressPercent,
  calculateGoalRemaining,
  categoryComparisonScale,
  firstNameFromDisplay,
  greetingForHour,
  isPaymentOverdue,
  monthlyFinancialContext,
  relativeBarPercent,
  selectUpcomingPendingPayments,
} from './general-dashboard-model'

type DashboardData = {
  categories: FinancialCategory[]
  monthly: Awaited<ReturnType<typeof getMonthlyBudgetPeriodSummary>>
  projects: ProjectListEntry[]
  movements: ProjectSavingsMovement[]
  payments: Awaited<ReturnType<typeof listScheduledPayments>>
  occurrences: Awaited<ReturnType<typeof listScheduledPaymentOccurrencesForPeriod>>
  transactions: FinancialTransaction[]
}

const PROJECT_LIMIT = 4
const GOAL_LIMIT = 3
const PAYMENT_LIMIT = 5
const TRANSACTION_LIMIT = 6
const CATEGORY_LIMIT = 6

function todayCivil(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function loadDashboard(period: string): Promise<DashboardData> {
  const [monthly, categories, projects, payments, occurrences, transactions] = await Promise.all([
    getMonthlyBudgetPeriodSummary(period),
    listFinancialCategories(true),
    fetchProjects(),
    listScheduledPayments(),
    listScheduledPaymentOccurrencesForPeriod(period),
    listTransactions({ limit: TRANSACTION_LIMIT }),
  ])

  const goalIds = projects
    .filter((project) => isSavingsGoalProject(project.savings_mode))
    .map((project) => project.id)
  const movements = await listSavingsMovementsForProjects(goalIds)

  return { categories, monthly, projects, movements, payments, occurrences, transactions }
}

function EmptySection({
  children,
  to,
  action,
}: {
  children: string
  to: string
  action: string
}) {
  return (
    <div className="general-dashboard-empty">
      <p>{children}</p>
      <Link className="btn btn-ghost" to={to}>
        {action}
      </Link>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="page general-dashboard" aria-busy="true" aria-live="polite">
      <p className="page-status" role="status">
        Preparando tu resumen…
      </p>
      <div className="general-dashboard-skeleton" aria-hidden="true">
        <div className="general-dashboard-skeleton__hero" />
        <div className="general-dashboard-skeleton__row" />
        <div className="general-dashboard-skeleton__split">
          <div />
          <div />
        </div>
      </div>
    </div>
  )
}

export function GeneralDashboard() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const money = useFormatMoney()
  const [period, setPeriod] = useState(currentMonthlyPeriod())
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    void loadDashboard(period).then(
      (result) => {
        if (cancelled) return
        setData(result)
        setError(null)
        setRefreshing(false)
      },
      (reason: unknown) => {
        if (cancelled) return
        console.error(reason)
        setError(reason instanceof Error ? reason.message : 'No se pudo cargar el resumen.')
        setRefreshing(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [period, reloadKey])

  function changePeriod(next: string) {
    setRefreshing(true)
    setPeriod(next)
  }

  function retryLoad() {
    setRefreshing(true)
    setError(null)
    setReloadKey((value) => value + 1)
  }

  if (!user) return null
  if (!data && !error) return <DashboardSkeleton />
  if (error && !data) {
    return (
      <div className="page stack">
        <p className="field-error" role="alert">
          {error}
        </p>
        <button className="btn" type="button" onClick={retryLoad}>
          Reintentar
        </button>
      </div>
    )
  }
  if (!data) return null

  const loading = refreshing

  const today = todayCivil()
  const month = data.monthly?.metrics ?? null
  const firstName = firstNameFromDisplay(profile?.display_name, user.email)
  const greeting = greetingForHour(new Date().getHours())
  const categoryName = (id: string) =>
    data.categories.find((category) => category.id === id)?.name ?? 'Categoría archivada'

  const commitments = calculateMonthlyScheduledCommitments({
    period,
    today,
    payments: data.payments,
    categoriesById: new Map(data.categories.map((category) => [category.id, category] as const)),
    occurrences: data.occurrences,
  })
  const upcomingPayments = selectUpcomingPendingPayments(commitments.lines, PAYMENT_LIMIT)

  const purchaseProjects = data.projects.filter(
    (project) => !isSavingsGoalProject(project.savings_mode),
  )
  const goalProjects = data.projects.filter((project) =>
    isSavingsGoalProject(project.savings_mode),
  )

  const movementsByProject = new Map<string, ProjectSavingsMovement[]>()
  for (const movement of data.movements) {
    const current = movementsByProject.get(movement.project_id) ?? []
    current.push(movement)
    movementsByProject.set(movement.project_id, current)
  }

  const budgetCategories = data.monthly
    ? [...data.monthly.categories].sort((a, b) => b.budget - a.budget || b.spent - a.spent)
    : []
  const visibleCategories = budgetCategories.slice(0, CATEGORY_LIMIT)
  const comparisonScale = categoryComparisonScale(visibleCategories)

  return (
    <div className="page general-dashboard" aria-busy={loading}>
      <header className="general-dashboard-hero">
        <div>
          <p className="general-dashboard-eyebrow">{formatYearMonthLabel(period)}</p>
          <h1>
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="page-lede">{monthlyFinancialContext(month, money)}</p>
        </div>
        <Link className="btn btn-primary" to={`/budget/transactions?period=${period}&create=1`}>
          Registrar transacción
        </Link>
      </header>

      <div className="month-nav" aria-label="Periodo del dashboard">
        <button
          className="btn"
          type="button"
          aria-label="Mes anterior"
          disabled={loading}
          onClick={() => changePeriod(previousMonthlyPeriod(period))}
        >
          ←
        </button>
        <strong>{formatYearMonthLabel(period)}</strong>
        <button
          className="btn"
          type="button"
          aria-label="Mes siguiente"
          disabled={loading}
          onClick={() => changePeriod(nextMonthlyPeriod(period))}
        >
          →
        </button>
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}{' '}
          <button className="btn btn-ghost" type="button" onClick={retryLoad}>
            Reintentar
          </button>
        </p>
      ) : null}

      <section aria-labelledby="general-finance-heading">
        <div className="general-dashboard-section-heading">
          <div>
            <h2 id="general-finance-heading">Resumen mensual</h2>
            <p className="muted">
              Planificación y movimientos reales de {formatYearMonthLabel(period).toLowerCase()}.
            </p>
          </div>
          <Link to={`/budget?period=${period}`}>Ver presupuesto</Link>
        </div>
        {month ? (
          <div className="metrics-grid metrics-grid-budget">
            <article className="metric-card metric-card-budget">
              <p className="metric-label">Disponible del mes</p>
              <p className="metric-value">{money(month.availableAmount)}</p>
            </article>
            <article className="metric-card metric-card-projected">
              <p className="metric-label">Asignado a categorías</p>
              <p className="metric-value">{money(month.assigned)}</p>
            </article>
            <article className="metric-card metric-card-spent">
              <p className="metric-label">Gastos reales</p>
              <p className="metric-value">{money(month.spent)}</p>
            </article>
            <article
              className={`metric-card ${month.unassigned < 0 ? 'metric-card-over' : 'metric-card-pending'}`}
            >
              <p className="metric-label">{month.unassigned < 0 ? 'Sobreasignado' : 'Sin asignar'}</p>
              <p className="metric-value">{money(Math.abs(month.unassigned))}</p>
            </article>
            <article
              className={`metric-card ${month.actualRemaining < 0 ? 'metric-card-over' : 'metric-card-balance'}`}
            >
              <p className="metric-label">Disponible tras gastos</p>
              <p className="metric-value">{money(month.actualRemaining)}</p>
            </article>
          </div>
        ) : (
          <EmptySection to={`/budget?period=${period}`} action="Crear presupuesto">
            No hay presupuesto para este mes todavía. Sin él no inventamos cifras.
          </EmptySection>
        )}
      </section>

      <section className="general-dashboard-split" aria-label="Distribución y próximos pagos">
        <div className="general-dashboard-panel">
          <div className="general-dashboard-section-heading">
            <div>
              <h2>Distribución del presupuesto</h2>
              <p className="muted">Barras comparables: asignado frente a gasto real.</p>
            </div>
          </div>
          {visibleCategories.length > 0 ? (
            <>
              <ul className="general-budget-list">
                {visibleCategories.map((category) => {
                  const assignedWidth = relativeBarPercent(category.budget, comparisonScale)
                  const spentWidth = relativeBarPercent(category.spent, comparisonScale)
                  const over = category.remaining < 0
                  return (
                    <li key={category.financialCategoryId}>
                      <div className="general-budget-list__head">
                        <strong>{categoryName(category.financialCategoryId)}</strong>
                        <span className={over ? 'is-over-text' : undefined}>
                          {over ? 'Exceso ' : 'Disponible '}
                          {money(Math.abs(category.remaining))}
                        </span>
                      </div>
                      <div
                        className="general-budget-compare"
                        aria-label={`Asignado ${money(category.budget)}, gastado ${money(category.spent)}`}
                      >
                        <div className="general-budget-compare__track" aria-hidden="true">
                          <span
                            className="general-budget-compare__assigned"
                            style={{ width: `${assignedWidth}%` }}
                          />
                          <span
                            className={`general-budget-compare__spent${over ? ' is-over' : ''}`}
                            style={{ width: `${spentWidth}%` }}
                          />
                        </div>
                      </div>
                      <p>
                        {money(category.budget)} asignado · {money(category.spent)} gastado
                        {category.usage == null
                          ? ''
                          : ` · ${formatPercent(Math.min(999, category.usage * 100))} del cupo`}
                      </p>
                    </li>
                  )
                })}
              </ul>
              {budgetCategories.length > CATEGORY_LIMIT ? (
                <p className="general-dashboard-more">
                  <Link to={`/budget?period=${period}`}>
                    Ver las {budgetCategories.length} categorías en presupuesto
                  </Link>
                </p>
              ) : null}
            </>
          ) : (
            <EmptySection to={`/budget?period=${period}`} action="Asignar categorías">
              Aún no hay categorías presupuestadas este mes.
            </EmptySection>
          )}
        </div>

        <div className="general-dashboard-panel">
          <div className="general-dashboard-section-heading">
            <div>
              <h2>Próximos pagos</h2>
              <p className="muted">Solo pendientes; no cuentan como gasto real.</p>
            </div>
            <Link to="/budget/scheduled-payments">Gestionar</Link>
          </div>
          {upcomingPayments.length > 0 ? (
            <ul className="general-payment-list">
              {upcomingPayments.map((line) => {
                const overdue = isPaymentOverdue(line.dueDate, today)
                return (
                  <li
                    key={`${line.scheduledPaymentId}-${line.dueDate}`}
                    className={overdue ? 'is-overdue' : undefined}
                  >
                    <div>
                      <strong>{line.name}</strong>
                      <span>
                        {overdue ? 'Vencido' : 'Pendiente'} · {formatCivilDateLong(line.dueDate)}
                      </span>
                    </div>
                    <b>
                      {line.expectedAmount == null
                        ? 'Importe variable'
                        : money(line.expectedAmount)}
                    </b>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptySection to="/budget/scheduled-payments" action="Crear pago programado">
              No hay pagos pendientes para este mes.
            </EmptySection>
          )}
        </div>
      </section>

      <section aria-labelledby="general-projects-heading">
        <div className="general-dashboard-section-heading">
          <div>
            <h2 id="general-projects-heading">Proyectos activos</h2>
            <p className="muted">Presupuesto, planificado y gasto real de compras.</p>
          </div>
          <Link to="/projects">Ver todos</Link>
        </div>
        {purchaseProjects.length > 0 ? (
          <ul className="general-project-grid">
            {purchaseProjects.slice(0, PROJECT_LIMIT).map((project) => {
              const planned = calculatePlannedBudget(project.items, project.status_options)
              const spent = calculateActualSpent(project.items, project.status_options)
              const completion = calculateCompletionPercentage(
                project.items,
                project.status_options,
              )
              return (
                <li key={project.id}>
                  <Link to={`/projects/${project.id}`}>
                    <h3>
                      {project.icon ? `${project.icon} ` : ''}
                      {project.name}
                    </h3>
                    <dl>
                      <div>
                        <dt>Presupuesto</dt>
                        <dd>{project.budget == null ? 'Sin definir' : money(project.budget)}</dd>
                      </div>
                      <div>
                        <dt>Planificado</dt>
                        <dd>{money(planned)}</dd>
                      </div>
                      <div>
                        <dt>Gasto real</dt>
                        <dd>{money(spent)}</dd>
                      </div>
                    </dl>
                    <div className="general-project-progress">
                      <span style={{ width: `${completion}%` }} />
                      <small>{formatPercent(completion)} completado</small>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptySection to="/projects" action="Crear proyecto">
            No hay proyectos de compras todavía.
          </EmptySection>
        )}
      </section>

      <section className="general-dashboard-split" aria-label="Metas y actividad reciente">
        <div className="general-dashboard-panel">
          <div className="general-dashboard-section-heading">
            <div>
              <h2>Metas de ahorro</h2>
              <p className="muted">Acumulado por movimientos; no es gasto real.</p>
            </div>
            <Link to="/projects">Ver metas</Link>
          </div>
          {goalProjects.length > 0 ? (
            <ul className="general-goal-list">
              {goalProjects.slice(0, GOAL_LIMIT).map((project) => {
                const target = project.savings_target_amount
                const accumulated = calculateGoalAccumulatedBalance({
                  initialBalance: project.savings_initial_balance,
                  movements: movementsByProject.get(project.id) ?? [],
                })
                const remaining = calculateGoalRemaining(target, accumulated)
                const progress = calculateGoalProgressPercent(target, accumulated)
                return (
                  <li key={project.id}>
                    <Link to={`/projects/${project.id}`}>
                      <div>
                        <strong>{project.name}</strong>
                        <span>
                          {target != null && target > 0
                            ? `${formatPercent(progress)} alcanzado`
                            : 'Objetivo por definir'}
                        </span>
                      </div>
                      <p>
                        {money(accumulated)} acumulado
                        {remaining == null
                          ? ' · Sin objetivo'
                          : ` · ${money(remaining)} pendiente`}
                      </p>
                      <div className="general-budget-list__track" aria-hidden="true">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptySection to="/projects" action="Crear meta">
              No hay metas de ahorro todavía.
            </EmptySection>
          )}
        </div>

        <div className="general-dashboard-panel">
          <div className="general-dashboard-section-heading">
            <div>
              <h2>Actividad reciente</h2>
              <p className="muted">Últimos movimientos registrados.</p>
            </div>
            <Link to="/budget/transactions">Ver movimientos</Link>
          </div>
          {data.transactions.length > 0 ? (
            <ul className="general-transaction-list">
              {data.transactions.map((transaction) => (
                <li key={transaction.id}>
                  <div>
                    <strong>{transaction.name}</strong>
                    <span>
                      {transaction.type === 'income'
                        ? 'Ingreso'
                        : transaction.financialCategoryId
                          ? categoryName(transaction.financialCategoryId)
                          : 'Sin categoría'}
                      {' · '}
                      {formatCivilDateLong(transaction.occurredOn)}
                    </span>
                  </div>
                  <b className={transaction.type === 'income' ? 'is-income' : 'is-expense'}>
                    {transaction.type === 'income' ? '+' : '−'}
                    {money(transaction.amount)}
                  </b>
                </li>
              ))}
            </ul>
          ) : (
            <EmptySection
              to={`/budget/transactions?period=${period}&create=1`}
              action="Registrar transacción"
            >
              Aún no hay transacciones registradas.
            </EmptySection>
          )}
        </div>
      </section>
    </div>
  )
}
