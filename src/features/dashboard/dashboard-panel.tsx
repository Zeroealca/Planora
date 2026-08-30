import {
  calculateActualSpent,
  calculateBudgetByCategory,
  calculateBudgetByPriority,
  calculateCompletionPercentage,
  calculatePendingBudget,
  calculatePlannedBudget,
  calculateRemainingBudget,
  countCompletedItems,
  type BudgetItem,
} from '@/utils/budget/calculations'
import { formatPercent, useFormatMoney } from '@/utils/format'
import {
  priorityLabel,
  type ProjectPriorityOption,
  type ProjectStatusOption,
} from '@/features/projects/project-options'
import type { Category } from '@/types/domain'

export function DashboardPanel({
  budget,
  items,
  categories,
  statusOptions,
  priorityOptions,
}: {
  budget: number | null
  items: readonly BudgetItem[]
  categories: readonly Category[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
}) {
  const formatMoney = useFormatMoney()
  const pending = calculatePendingBudget(items, statusOptions)
  const spent = calculateActualSpent(items, statusOptions)
  const planned = calculatePlannedBudget(items, statusOptions)
  const remaining = calculateRemainingBudget(budget, items, statusOptions)
  const completion = calculateCompletionPercentage(items, statusOptions)
  const completed = countCompletedItems(items, statusOptions)
  const byPriority = calculateBudgetByPriority(items, statusOptions)
  const byCategory = calculateBudgetByCategory(items, statusOptions)
  const categoryName = (id: string | null) => {
    if (!id) return 'Sin categoría'
    return categories.find((category) => category.id === id)?.name ?? 'Categoría'
  }

  return (
    <section className="stack" aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading">Resumen</h2>
      <div className="metrics-grid">
        <article className="metric-card">
          <p className="metric-label">Presupuesto</p>
          <p className="metric-value">
            {budget == null ? 'Sin definir' : formatMoney(budget)}
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Planeado</p>
          <p className="metric-value">{formatMoney(planned)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Gastado</p>
          <p className="metric-value">{formatMoney(spent)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Pendiente</p>
          <p className="metric-value">{formatMoney(pending)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Restante</p>
          <p className="metric-value">
            {remaining == null ? '—' : formatMoney(remaining)}
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Progreso</p>
          <p className="metric-value">{formatPercent(completion)}</p>
          <p className="metric-hint">
            {completed} de {items.length} ítems
          </p>
        </article>
      </div>

      <div className="breakdown-grid">
        <section>
          <h3>Por prioridad</h3>
          <ul className="plain-list">
            {priorityOptions.map((option) => (
              <li key={option.id}>
                <span>{priorityLabel(option.id, priorityOptions)}</span>
                <span>
                  {formatMoney(byPriority[option.id]?.planned ?? 0)} · gastado{' '}
                  {formatMoney(byPriority[option.id]?.spent ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Por categoría</h3>
          {byCategory.length === 0 ? (
            <p className="muted">Sin datos para desglosar.</p>
          ) : (
            <ul className="plain-list">
              {byCategory.map((slice) => (
                <li key={slice.category_id ?? 'none'}>
                  <span>{categoryName(slice.category_id)}</span>
                  <span>
                    {formatMoney(slice.planned)} · gastado {formatMoney(slice.spent)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}
