import { Link } from 'react-router'
import { ITEM_STATUS_LABELS, type ItemWithOptions, type LabelPreset } from '@/types/domain'
import { priorityLabel } from '@/features/projects/priority-labels'
import { formatMoney } from '@/utils/format'

export function ItemCard({
  item,
  projectId,
  categoryName,
  preset,
}: {
  item: ItemWithOptions
  projectId: string
  categoryName: string
  preset: LabelPreset
}) {
  return (
    <article className="card item-card">
      <div className="item-card-head">
        <h3>
          <Link to={`/projects/${projectId}/items/${item.id}`}>{item.name}</Link>
        </h3>
        <p className="muted">
          {ITEM_STATUS_LABELS[item.status]} · {priorityLabel(item.priority, preset)}
        </p>
      </div>
      <p className="muted">{categoryName}</p>
      <p>
        Estimado: {item.estimated_cost == null ? '—' : formatMoney(item.estimated_cost)}
        {item.status === 'Purchased' ? (
          <>
            {' '}
            · Real: {item.actual_cost == null ? '—' : formatMoney(item.actual_cost)}
          </>
        ) : null}
      </p>
      <p className="muted">
        {item.options.length === 1
          ? '1 opción'
          : `${item.options.length} opciones`}
      </p>
    </article>
  )
}
