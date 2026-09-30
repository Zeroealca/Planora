import { useId, useState } from 'react'
import type { MonthlyBudgetCategorySummary } from './transaction-summary'
import { useFormatMoney } from '@/utils/format'

type ChartSlice = {
  id: string
  name: string
  value: number
  color: string
}

type SlicePath = ChartSlice & {
  percent: number
  d: string
  startAngle: number
  endAngle: number
}

type Props = {
  categories: readonly MonthlyBudgetCategorySummary[]
  categoryName: (id: string) => string
}

const SLICE_COLORS = [
  '#0f766e',
  '#0369a1',
  '#7c3aed',
  '#b45309',
  '#be123c',
  '#047857',
  '#4338ca',
  '#a16207',
  '#0e7490',
  '#9f1239',
]

function buildSlices(
  categories: readonly MonthlyBudgetCategorySummary[],
  categoryName: (id: string) => string,
  metric: 'budget' | 'spent',
): ChartSlice[] {
  return categories
    .map((category, index) => ({
      id: category.financialCategoryId,
      name: categoryName(category.financialCategoryId),
      value: metric === 'budget' ? category.budget : category.spent,
      color: SLICE_COLORS[index % SLICE_COLORS.length]!,
    }))
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function describeSlice(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  if (endAngle - startAngle >= 359.999) {
    return [
      `M ${cx} ${cy - radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`,
      'Z',
    ].join(' ')
  }

  const start = polar(cx, cy, radius, endAngle)
  const end = polar(cx, cy, radius, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${cx} ${cy}`,
    `L ${end.x} ${end.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${start.x} ${start.y}`,
    'Z',
  ].join(' ')
}

function buildPaths(slices: readonly ChartSlice[], total: number, cx: number, cy: number, radius: number) {
  return slices.reduce<SlicePath[]>((acc, slice) => {
    const startAngle = acc.length === 0 ? 0 : acc[acc.length - 1]!.endAngle
    const endAngle = startAngle + (slice.value / total) * 360
    acc.push({
      ...slice,
      startAngle,
      endAngle,
      percent: (slice.value / total) * 100,
      d: describeSlice(cx, cy, radius, startAngle, endAngle),
    })
    return acc
  }, [])
}

export function BudgetCategoryChart({ categories, categoryName }: Props) {
  const money = useFormatMoney()
  const tipId = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)

  const budgetTotal = categories.reduce((sum, category) => sum + category.budget, 0)
  const metric: 'budget' | 'spent' = budgetTotal > 0 ? 'budget' : 'spent'
  const slices = buildSlices(categories, categoryName, metric)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const title = metric === 'budget' ? 'Presupuesto por categoría' : 'Gasto por categoría'

  if (categories.length === 0) {
    return (
      <section className="card stack budget-category-chart" aria-labelledby="budget-category-chart-title">
        <h2 id="budget-category-chart-title">Distribución por categoría</h2>
        <p className="muted">Añade categorías para ver el gráfico.</p>
      </section>
    )
  }

  if (total <= 0) {
    return (
      <section className="card stack budget-category-chart" aria-labelledby="budget-category-chart-title">
        <h2 id="budget-category-chart-title">Distribución por categoría</h2>
        <p className="muted">
          Cuando asignes montos o registres gastos, verás aquí el reparto por categoría.
        </p>
      </section>
    )
  }

  const size = 180
  const cx = size / 2
  const cy = size / 2
  const radius = 78
  const paths = buildPaths(slices, total, cx, cy, radius)
  const highlightedId = activeId ?? pinnedId
  const highlighted = paths.find((slice) => slice.id === highlightedId) ?? null

  function activate(id: string) {
    setActiveId(id)
  }

  function deactivate(id: string) {
    setActiveId((current) => (current === id ? null : current))
  }

  function togglePin(id: string) {
    setPinnedId((current) => (current === id ? null : id))
    setActiveId(id)
  }

  return (
    <section className="card stack budget-category-chart" aria-labelledby="budget-category-chart-title">
      <h2 id="budget-category-chart-title">{title}</h2>

      <div className="budget-category-chart__layout">
        <div className="budget-category-chart__visual">
          <svg
            className="budget-category-chart__pie"
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={`${title}. Total ${money(total)}.`}
            aria-describedby={tipId}
          >
            {paths.map((slice) => {
              const isActive = highlightedId === slice.id
              const isDimmed = highlightedId != null && !isActive
              const mid = (slice.startAngle + slice.endAngle) / 2
              const pull = isActive ? polar(0, 0, 7, mid) : { x: 0, y: 0 }
              return (
                <path
                  key={slice.id}
                  d={slice.d}
                  fill={slice.color}
                  stroke="var(--card)"
                  strokeWidth={isActive ? 3 : 2}
                  opacity={isDimmed ? 0.38 : 1}
                  transform={`translate(${pull.x} ${pull.y})`}
                  className="budget-category-chart__slice"
                  tabIndex={0}
                  role="button"
                  aria-label={`${slice.name}: ${money(slice.value)}, ${slice.percent.toFixed(0)} por ciento`}
                  aria-pressed={pinnedId === slice.id}
                  onPointerEnter={() => activate(slice.id)}
                  onPointerLeave={() => deactivate(slice.id)}
                  onFocus={() => activate(slice.id)}
                  onBlur={() => deactivate(slice.id)}
                  onClick={() => togglePin(slice.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      togglePin(slice.id)
                    }
                  }}
                />
              )
            })}
          </svg>

          <p id={tipId} className="budget-category-chart__focus" aria-live="polite">
            {highlighted ? (
              <>
                <strong style={{ color: highlighted.color }}>{highlighted.name}</strong>
                <span>
                  {money(highlighted.value)} · {highlighted.percent.toFixed(0)}%
                </span>
              </>
            ) : (
              <span className="muted">Toca una porción o categoría.</span>
            )}
          </p>
        </div>

        <ul className="budget-category-chart__legend-list">
          {paths.map((slice) => {
            const isActive = highlightedId === slice.id
            return (
              <li key={slice.id}>
                <button
                  type="button"
                  className={`budget-category-chart__legend-item${isActive ? ' is-active' : ''}`}
                  aria-pressed={pinnedId === slice.id}
                  onPointerEnter={() => activate(slice.id)}
                  onPointerLeave={() => deactivate(slice.id)}
                  onFocus={() => activate(slice.id)}
                  onBlur={() => deactivate(slice.id)}
                  onClick={() => togglePin(slice.id)}
                >
                  <span
                    className="budget-category-chart__swatch"
                    style={{ background: slice.color }}
                    aria-hidden="true"
                  />
                  <span className="budget-category-chart__legend-copy">
                    <strong>{slice.name}</strong>
                    <span className="muted">
                      {money(slice.value)} · {slice.percent.toFixed(0)}%
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
