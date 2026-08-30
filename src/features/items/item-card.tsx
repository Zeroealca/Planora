import { Link } from 'react-router'
import type { ItemWithOptions, ProjectPriorityOption, ProjectStatusOption } from '@/types/domain'
import { priorityLabel, statusLabel } from '@/features/projects/project-options'
import { useFormatMoney } from '@/utils/format'

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

export function ItemCard({
  item,
  projectId,
  categoryName,
  statusOptions,
  priorityOptions,
}: {
  item: ItemWithOptions
  projectId: string
  categoryName: string
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
}) {
  const formatMoney = useFormatMoney()
  return (
    <article className="card item-card">
      <div className="item-card-head">
        <h3>
          <Link to={`/projects/${projectId}/items/${item.id}`}>{item.name}</Link>
        </h3>
        <p className="muted">
          {statusLabel(item.status, statusOptions)} ·{' '}
          {priorityLabel(item.priority, priorityOptions)}
        </p>
      </div>
      <p className="muted">{categoryName}</p>
      {item.description ? <p>{truncate(item.description)}</p> : null}
      <p>
        Esperado: {item.estimated_cost == null ? '—' : formatMoney(item.estimated_cost)}
        {' · '}
        Real: {item.actual_cost == null ? '—' : formatMoney(item.actual_cost)}
      </p>
      {item.purchase_url ? (
        <p>
          <a href={item.purchase_url} target="_blank" rel="noopener noreferrer">
            Ver enlace de compra
          </a>
        </p>
      ) : null}
      {item.notes ? <p className="muted">{truncate(item.notes)}</p> : null}
      <p className="muted">
        {item.options.length === 1
          ? '1 opción'
          : `${item.options.length} opciones`}
      </p>
    </article>
  )
}
