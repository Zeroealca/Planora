import {
  calculateCompletionPercentage,
  calculateProjectedBalance,
  countItemsByBehavior,
  type BudgetItem,
} from '@/utils/budget/calculations'
import { savingsKind } from '@/utils/budget/item-savings'
import {
  calculateBudgetSliceMetrics,
  calculateMetricsByCategory,
  calculateMetricsByPriority,
  type CategorySliceMetrics,
  type PrioritySliceMetrics,
} from '@/utils/budget/summary'
import { formatPercent, useFormatMoney } from '@/utils/format'
import {
  priorityLabel,
  type ProjectPriorityOption,
  type ProjectStatusOption,
} from '@/features/projects/project-options'
import type { Category, SavingsMode } from '@/types/domain'
import {
  DashboardBreakdownChart,
  type DashboardChartSlice,
} from './dashboard-breakdown-chart'

/**
 * Pie slices use projectedCost (spent + pending) — same “Proyectado” metric as
 * the detailed breakdown cards. Matches the budget chart’s preference for a
 * planned/allocated total over spent-only when available.
 */
function priorityChartSlices(
  byPriority: readonly PrioritySliceMetrics[],
  priorityOptions: readonly ProjectPriorityOption[],
): DashboardChartSlice[] {
  return byPriority.map((slice) => ({
    id: slice.priority,
    name: priorityLabel(slice.priority, priorityOptions),
    value: slice.projectedCost,
  }))
}

function categoryChartSlices(
  byCategory: readonly CategorySliceMetrics[],
  categoryName: (id: string | null) => string,
): DashboardChartSlice[] {
  return byCategory.map((slice) => ({
    id: slice.category_id ?? 'none',
    name: categoryName(slice.category_id),
    value: slice.projectedCost,
  }))
}

function formatSavingsDelta(
  amount: number,
  formatMoney: (value: number) => string,
  mode: 'expected' | 'actual',
): { label: string; value: string; over: boolean } {
  const kind = savingsKind(amount)
  const abs = Math.abs(amount)
  if (kind === 'overcost') {
    return {
      label: mode === 'expected' ? 'Sobrecosto esperado' : 'Sobrecosto real',
      value: formatMoney(abs),
      over: true,
    }
  }
  if (kind === 'savings') {
    return {
      label: mode === 'expected' ? 'Ahorro esperado' : 'Ahorro real',
      value: formatMoney(abs),
      over: false,
    }
  }
  return {
    label: mode === 'expected' ? 'Ahorro esperado' : 'Ahorro real',
    value: formatMoney(0),
    over: false,
  }
}

function formatSignedMoney(amount: number, formatMoney: (value: number) => string): string {
  if (amount < 0) return `−${formatMoney(Math.abs(amount))}`
  return formatMoney(amount)
}

function SliceMetricsList({
  slice,
  formatMoney,
}: {
  slice: {
    originalBudget: number
    projectedCost: number
    spent: number
    pending: number
    expectedSavings: number
    actualSavings: number
  }
  formatMoney: (value: number) => string
}) {
  return (
    <dl className="breakdown-metrics">
      <div>
        <dt>Original</dt>
        <dd>{formatMoney(slice.originalBudget)}</dd>
      </div>
      <div>
        <dt>Proyectado</dt>
        <dd>{formatMoney(slice.projectedCost)}</dd>
      </div>
      <div>
        <dt>Gastado</dt>
        <dd>{formatMoney(slice.spent)}</dd>
      </div>
      <div>
        <dt>Pendiente</dt>
        <dd>{formatMoney(slice.pending)}</dd>
      </div>
      <div>
        <dt>Ahorro esp.</dt>
        <dd>{formatSignedMoney(slice.expectedSavings, formatMoney)}</dd>
      </div>
      <div>
        <dt>Ahorro real</dt>
        <dd>{formatSignedMoney(slice.actualSavings, formatMoney)}</dd>
      </div>
    </dl>
  )
}

export function DashboardPanel({
  budget,
  items,
  categories,
  statusOptions,
  priorityOptions,
  savingsMode = 'none',
  attentionCount = 0,
}: {
  budget: number | null
  items: readonly BudgetItem[]
  categories: readonly Category[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
  /** Charts only for savings plan projects (not goal, not purchase-only). */
  savingsMode?: SavingsMode
  /** Project-wide count of items needing attention (not a status). */
  attentionCount?: number
}) {
  const formatMoney = useFormatMoney()
  const totals = calculateBudgetSliceMetrics(items, statusOptions)
  const projectedBalance = calculateProjectedBalance(budget, items, statusOptions)
  const completion = calculateCompletionPercentage(items, statusOptions)
  const counts = countItemsByBehavior(items, statusOptions)
  const byPriority = calculateMetricsByPriority(
    items,
    statusOptions,
    priorityOptions.map((option) => option.id),
  )
  const byCategory = calculateMetricsByCategory(
    items,
    statusOptions,
    categories.map((category) => category.id),
  )
  const overBudget = projectedBalance != null && projectedBalance < 0
  const expectedDisplay = formatSavingsDelta(totals.expectedSavings, formatMoney, 'expected')
  const actualDisplay = formatSavingsDelta(totals.actualSavings, formatMoney, 'actual')
  const showPlanCharts = savingsMode === 'plan'
  const categoryName = (id: string | null) => {
    if (!id) return 'Sin categoría'
    return categories.find((category) => category.id === id)?.name ?? 'Categoría'
  }

  return (
    <div className="dashboard stack">
      {attentionCount > 0 ? (
        <p className="attention-banner" role="status">
          {attentionCount === 1
            ? '1 ítem necesita atención'
            : `${attentionCount} ítems necesitan atención`}
        </p>
      ) : null}

      <section className="dashboard-section" aria-label="Indicadores principales">
        <div className="metrics-grid metrics-grid-hero">
          <article className="metric-card metric-card-budget">
            <p className="metric-label">Presupuesto disponible</p>
            <p className="metric-value">
              {budget == null ? 'Sin definir' : formatMoney(budget)}
            </p>
            <p className="metric-hint">Tope manual del proyecto</p>
          </article>
          <article className="metric-card metric-card-projected">
            <p className="metric-label">Costo proyectado</p>
            <p className="metric-value">{formatMoney(totals.projectedCost)}</p>
            <p className="metric-hint">Gastado + pendiente</p>
          </article>
          <article
            className={`metric-card metric-card-balance${overBudget ? ' metric-card-over' : ''}`}
          >
            <p className="metric-label">Saldo proyectado</p>
            <p className="metric-value">
              {projectedBalance == null ? '—' : formatMoney(projectedBalance)}
            </p>
            {overBudget ? (
              <p className="metric-hint metric-hint-over">Supera el presupuesto</p>
            ) : (
              <p className="metric-hint">Disponible − proyectado</p>
            )}
          </article>
          <article className="metric-card metric-card-progress">
            <p className="metric-label">Progreso</p>
            <p className="metric-value">{formatPercent(completion)}</p>
            <p className="metric-hint">
              {counts.completed} de {counts.total} completados
            </p>
            <div
              className="progress-bar"
              role="presentation"
              aria-hidden="true"
            >
              <span style={{ width: `${Math.min(100, Math.max(0, completion))}%` }} />
            </div>
          </article>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-money-heading">
        <h3 id="dashboard-money-heading">Flujo de dinero</h3>
        <div className="metrics-grid metrics-grid-secondary">
          <article className="metric-card metric-card-compact">
            <p className="metric-label">Presupuesto original</p>
            <p className="metric-value">{formatMoney(totals.originalBudget)}</p>
          </article>
          <article className="metric-card metric-card-compact metric-card-spent">
            <p className="metric-label">Gastado</p>
            <p className="metric-value">{formatMoney(totals.spent)}</p>
          </article>
          <article className="metric-card metric-card-compact metric-card-pending">
            <p className="metric-label">Pendiente</p>
            <p className="metric-value">{formatMoney(totals.pending)}</p>
          </article>
          <article
            className={`metric-card metric-card-compact${expectedDisplay.over ? ' metric-card-over' : ' metric-card-savings'}`}
          >
            <p className="metric-label">{expectedDisplay.label}</p>
            <p className="metric-value">{expectedDisplay.value}</p>
          </article>
          <article
            className={`metric-card metric-card-compact${actualDisplay.over ? ' metric-card-over' : ' metric-card-savings'}`}
          >
            <p className="metric-label">{actualDisplay.label}</p>
            <p className="metric-value">{actualDisplay.value}</p>
          </article>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-counts-heading">
        <h3 id="dashboard-counts-heading">Estado de ítems</h3>
        <ul className="progress-chips" aria-label="Conteo de ítems">
          <li className="progress-chip progress-chip-purchased">
            <span className="progress-chip-value">{counts.purchased}</span>
            <span className="progress-chip-label">Comprados</span>
          </li>
          <li className="progress-chip progress-chip-owned">
            <span className="progress-chip-value">{counts.owned}</span>
            <span className="progress-chip-label">Ya lo tengo</span>
          </li>
          <li className="progress-chip progress-chip-pending">
            <span className="progress-chip-value">{counts.pending}</span>
            <span className="progress-chip-label">Pendientes</span>
          </li>
          <li className="progress-chip progress-chip-done">
            <span className="progress-chip-value">{counts.completed}</span>
            <span className="progress-chip-label">Completados</span>
          </li>
        </ul>
      </section>

      {showPlanCharts ? (
        <div className="breakdown-grid" aria-label="Distribución proyectada">
          <DashboardBreakdownChart
            title="Proyectado por prioridad"
            titleId="dashboard-priority-chart-heading"
            slices={priorityChartSlices(byPriority, priorityOptions)}
          />
          <DashboardBreakdownChart
            title="Proyectado por categoría"
            titleId="dashboard-category-chart-heading"
            slices={categoryChartSlices(byCategory, categoryName)}
          />
        </div>
      ) : null}

      <div className="breakdown-grid">
        <section className="breakdown-panel" aria-labelledby="dashboard-priority-heading">
          <h3 id="dashboard-priority-heading">Por prioridad</h3>
          <ul className="breakdown-list">
            {byPriority.map((slice) => (
              <li key={slice.priority} className="breakdown-item">
                <p className="breakdown-title">
                  {priorityLabel(slice.priority, priorityOptions)}
                  <span className="muted"> · {slice.itemCount} ítems</span>
                </p>
                <SliceMetricsList slice={slice} formatMoney={formatMoney} />
              </li>
            ))}
          </ul>
        </section>
        <section className="breakdown-panel" aria-labelledby="dashboard-category-heading">
          <h3 id="dashboard-category-heading">Por categoría</h3>
          {byCategory.length === 0 ? (
            <p className="muted">Sin datos para desglosar.</p>
          ) : (
            <ul className="breakdown-list">
              {byCategory.map((slice) => (
                <li key={slice.category_id ?? 'none'} className="breakdown-item">
                  <p className="breakdown-title">
                    {categoryName(slice.category_id)}
                    <span className="muted"> · {slice.itemCount} ítems</span>
                  </p>
                  <SliceMetricsList slice={slice} formatMoney={formatMoney} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
