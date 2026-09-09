import {
  formatYearMonthLabel,
  projectSavingsGoal,
  type SavingsGoalConfig,
  type SavingsMovementInput,
} from '@/utils/budget/savings-goal'
import { useFormatMoney } from '@/utils/format'

export function SavingsGoalDashboardPanel({
  config,
  movements,
}: {
  config: SavingsGoalConfig
  movements: readonly SavingsMovementInput[]
}) {
  const formatMoney = useFormatMoney()
  const projection =
    config.enabled && config.startDate
      ? projectSavingsGoal(config, movements)
      : null

  if (!config.enabled || !config.startDate) {
    return (
      <div className="dashboard stack">
        <p className="muted">
          Configura la meta en la pestaña <strong>Meta</strong> para ver la proyección.
        </p>
      </div>
    )
  }

  if (!projection) {
    return (
      <div className="dashboard stack">
        <p className="muted">
          No se puede proyectar todavía. Revisa aporte mensual, fechas y movimientos.
        </p>
      </div>
    )
  }

  return (
    <div className="dashboard stack">
      <section className="dashboard-section" aria-label="Proyección de la meta">
        <div className="metrics-grid metrics-grid-hero">
          <article className="metric-card metric-card-budget">
            <p className="metric-label">Cantidad objetivo</p>
            <p className="metric-value">{formatMoney(config.targetAmount)}</p>
            <p className="metric-hint">Dinero que quieres poder gastar</p>
          </article>
          <article className="metric-card metric-card-projected">
            <p className="metric-label">Reserva mínima</p>
            <p className="metric-value">{formatMoney(config.minimumReserve)}</p>
            <p className="metric-hint">A conservar después del gasto</p>
          </article>
          <article className="metric-card metric-card-balance">
            <p className="metric-label">Necesitas acumular</p>
            <p className="metric-value">{formatMoney(projection.requiredSavings)}</p>
            <p className="metric-hint">Objetivo + reserva</p>
          </article>
          <article className="metric-card metric-card-progress">
            <p className="metric-label">Primer mes viable</p>
            <p className="metric-value metric-value-text">
              {formatYearMonthLabel(projection.viableYearMonth)}
            </p>
            <p className="metric-hint">{projection.monthsNeeded} meses necesarios</p>
          </article>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="goal-flow-heading">
        <h3 id="goal-flow-heading">Proyección</h3>
        <div className="metrics-grid metrics-grid-secondary">
          <article className="metric-card metric-card-compact">
            <p className="metric-label">Saldo inicial</p>
            <p className="metric-value">{formatMoney(config.initialBalance)}</p>
          </article>
          <article className="metric-card metric-card-compact">
            <p className="metric-label">Aporte mensual</p>
            <p className="metric-value">{formatMoney(config.monthlyContribution)}</p>
          </article>
          <article className="metric-card metric-card-compact">
            <p className="metric-label">Saldo proyectado</p>
            <p className="metric-value">{formatMoney(projection.projectedBalance)}</p>
          </article>
          <article className="metric-card metric-card-compact metric-card-savings">
            <p className="metric-label">Después de la meta</p>
            <p className="metric-value">{formatMoney(projection.remainingAfterGoal)}</p>
          </article>
          <article className="metric-card metric-card-compact">
            <p className="metric-label">Movimientos</p>
            <p className="metric-value">{movements.length}</p>
          </article>
        </div>
      </section>
    </div>
  )
}
