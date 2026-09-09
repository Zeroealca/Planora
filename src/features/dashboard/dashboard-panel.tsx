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
} from '@/utils/budget/summary'
import { formatPercent, useFormatMoney } from '@/utils/format'
import {
  priorityLabel,
  type ProjectPriorityOption,
  type ProjectStatusOption,
} from '@/features/projects/project-options'
import type { Category } from '@/types/domain'

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
    <ul className="breakdown-metrics plain-list">
      <li>
        <span>Presupuesto original</span>
        <span>{formatMoney(slice.originalBudget)}</span>
      </li>
      <li>
        <span>Costo proyectado</span>
        <span>{formatMoney(slice.projectedCost)}</span>
      </li>
      <li>
        <span>Gastado</span>
        <span>{formatMoney(slice.spent)}</span>
      </li>
      <li>
        <span>Pendiente</span>
        <span>{formatMoney(slice.pending)}</span>
      </li>
      <li>
        <span>Ahorro esperado</span>
        <span>{formatSignedMoney(slice.expectedSavings, formatMoney)}</span>
      </li>
      <li>
        <span>Ahorro real</span>
        <span>{formatSignedMoney(slice.actualSavings, formatMoney)}</span>
      </li>
    </ul>
  )
}

export function DashboardPanel({
  budget,
  items,
  categories,
  statusOptions,
  priorityOptions,
  attentionCount = 0,
}: {
  budget: number | null
  items: readonly BudgetItem[]
  categories: readonly Category[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
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
  const byCategory = calculateMetricsByCategory(items, statusOptions)
  const overBudget = projectedBalance != null && projectedBalance < 0
  const expectedDisplay = formatSavingsDelta(totals.expectedSavings, formatMoney, 'expected')
  const actualDisplay = formatSavingsDelta(totals.actualSavings, formatMoney, 'actual')
  const categoryName = (id: string | null) => {
    if (!id) return 'Sin categoría'
    return categories.find((category) => category.id === id)?.name ?? 'Categoría'
  }

  return (
    <div className="stack">
      {attentionCount > 0 ? (
        <p className="attention-banner" role="status">
          {attentionCount === 1
            ? '1 ítem necesita atención'
            : `${attentionCount} ítems necesitan atención`}
        </p>
      ) : null}
      <div className="metrics-grid">
        <article className="metric-card">
          <p className="metric-label">Presupuesto disponible</p>
          <p className="metric-value">
            {budget == null ? 'Sin definir' : formatMoney(budget)}
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Presupuesto original</p>
          <p className="metric-value">{formatMoney(totals.originalBudget)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Planeado</p>
          <p className="metric-value">{formatMoney(totals.projectedCost)}</p>
          <p className="metric-hint">Costo proyectado (gastado + pendiente)</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Gastado</p>
          <p className="metric-value">{formatMoney(totals.spent)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Pendiente</p>
          <p className="metric-value">{formatMoney(totals.pending)}</p>
        </article>
        <article className={`metric-card${overBudget ? ' metric-card-over' : ''}`}>
          <p className="metric-label">Saldo proyectado</p>
          <p className="metric-value">
            {projectedBalance == null ? '—' : formatMoney(projectedBalance)}
          </p>
          {overBudget ? (
            <p className="metric-hint metric-hint-over">Supera el presupuesto</p>
          ) : null}
        </article>
        <article className={`metric-card${expectedDisplay.over ? ' metric-card-over' : ''}`}>
          <p className="metric-label">{expectedDisplay.label}</p>
          <p className="metric-value">{expectedDisplay.value}</p>
          <p className="metric-hint">Solo ítems pendientes con presupuesto</p>
        </article>
        <article className={`metric-card${actualDisplay.over ? ' metric-card-over' : ''}`}>
          <p className="metric-label">{actualDisplay.label}</p>
          <p className="metric-value">{actualDisplay.value}</p>
          <p className="metric-hint">Solo ítems comprados con precio real</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Progreso</p>
          <p className="metric-value">{formatPercent(completion)}</p>
          <p className="metric-hint">
            {counts.completed} de {counts.total} completados
          </p>
        </article>
      </div>

      <ul className="plain-list progress-counts" aria-label="Conteo de ítems">
        <li>
          <span>Comprados</span>
          <span>{counts.purchased}</span>
        </li>
        <li>
          <span>Ya lo tengo</span>
          <span>{counts.owned}</span>
        </li>
        <li>
          <span>Pendientes</span>
          <span>{counts.pending}</span>
        </li>
        <li>
          <span>Completados</span>
          <span>{counts.completed}</span>
        </li>
      </ul>

      <div className="breakdown-grid">
        <section>
          <h3>Por prioridad</h3>
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
        <section>
          <h3>Por categoría</h3>
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
