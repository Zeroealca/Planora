import { useId, useState } from 'react'
import { useFormatMoney } from '@/utils/format'

export type DashboardChartSlice = {
  id: string
  name: string
  /** Amount shown as slice share — typically projectedCost from budget utils. */
  value: number
}

type ColoredSlice = DashboardChartSlice & { color: string }

type SlicePath = ColoredSlice & {
  percent: number
  d: string
  startAngle: number
  endAngle: number
}

type Props = {
  title: string
  titleId: string
  /** Every group to show — including zeros (0% / empty). */
  slices: readonly DashboardChartSlice[]
  /** Hint under an empty pie when every slice value is zero. */
  emptyHint?: string
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

/** Only positive values get arcs; zero slices stay in the legend at 0%. */
function buildPaths(
  slices: readonly ColoredSlice[],
  total: number,
  cx: number,
  cy: number,
  radius: number,
): SlicePath[] {
  return slices.reduce<SlicePath[]>((acc, slice) => {
    if (slice.value <= 0 || total <= 0) return acc
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

function slicePercent(value: number, total: number): number {
  if (total <= 0) return 0
  return (value / total) * 100
}

/**
 * Interactive pie for dashboard breakdowns (priority / category).
 * Same SVG + hover/focus/tap UX as the monthly budget category chart.
 * Legend always lists every slice, including 0%.
 */
export function DashboardBreakdownChart({
  title,
  titleId,
  slices,
  emptyHint = 'Sin montos proyectados aún; las etiquetas muestran 0%.',
}: Props) {
  const money = useFormatMoney()
  const tipId = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)

  // Keep caller order (priority options / project categories); do not drop zeros.
  const colored: ColoredSlice[] = slices.map((slice, index) => ({
    ...slice,
    color: SLICE_COLORS[index % SLICE_COLORS.length]!,
  }))

  const total = colored.reduce((sum, slice) => sum + Math.max(0, slice.value), 0)

  if (colored.length === 0) {
    return (
      <section className="breakdown-panel stack budget-category-chart" aria-labelledby={titleId}>
        <h3 id={titleId}>{title}</h3>
        <p className="muted">Sin datos para desglosar.</p>
      </section>
    )
  }

  const size = 180
  const cx = size / 2
  const cy = size / 2
  const radius = 78
  const paths = buildPaths(colored, total, cx, cy, radius)
  const highlightedId = activeId ?? pinnedId
  const highlighted =
    colored.find((slice) => slice.id === highlightedId) ?? null
  const highlightedPath = paths.find((slice) => slice.id === highlightedId) ?? null

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
    <section className="breakdown-panel stack budget-category-chart" aria-labelledby={titleId}>
      <h3 id={titleId}>{title}</h3>

      <div className="budget-category-chart__layout">
        <div className="budget-category-chart__visual">
          <svg
            className="budget-category-chart__pie"
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={
              total > 0
                ? `${title}. Total ${money(total)}.`
                : `${title}. Sin montos proyectados.`
            }
            aria-describedby={tipId}
          >
            {total <= 0 ? (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="var(--border)"
                strokeWidth={14}
                opacity={0.55}
                aria-hidden="true"
              />
            ) : (
              paths.map((slice) => {
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
              })
            )}
          </svg>

          <p id={tipId} className="budget-category-chart__focus" aria-live="polite">
            {highlighted ? (
              <>
                <strong style={{ color: highlighted.color }}>{highlighted.name}</strong>
                <span>
                  {money(highlighted.value)} ·{' '}
                  {(highlightedPath?.percent ?? slicePercent(highlighted.value, total)).toFixed(0)}%
                </span>
              </>
            ) : total <= 0 ? (
              <span className="muted">{emptyHint}</span>
            ) : (
              <span className="muted">Toca una porción o etiqueta.</span>
            )}
          </p>
        </div>

        <ul className="budget-category-chart__legend-list">
          {colored.map((slice) => {
            const isActive = highlightedId === slice.id
            const percent = slicePercent(slice.value, total)
            return (
              <li key={slice.id}>
                <button
                  type="button"
                  className={`budget-category-chart__legend-item${isActive ? ' is-active' : ''}`}
                  aria-pressed={pinnedId === slice.id}
                  aria-label={`${slice.name}: ${money(slice.value)}, ${percent.toFixed(0)} por ciento`}
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
                      {money(slice.value)} · {percent.toFixed(0)}%
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
