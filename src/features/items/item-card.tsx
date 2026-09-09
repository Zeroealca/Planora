import { Link } from 'react-router'
import type { ItemWithOptions, ProjectPriorityOption, ProjectStatusOption } from '@/types/domain'
import { priorityLabel, statusLabel } from '@/features/projects/project-options'
import { useFormatMoney } from '@/utils/format'
import {
  ATTENTION_ISSUE_LABELS,
  collectItemAttentionIssues,
  type AttentionContext,
} from './item-attention'
import {
  formatItemDate,
  getItemCompletionDate,
  getItemCostSummary,
  getItemPurchaseLink,
  getItemStore,
  getSelectedOption,
  selectedOptionLabel,
} from './item-summary'

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

function moneyOrDash(
  value: number | null,
  formatMoney: (value: number) => string,
): string {
  return value == null ? '—' : formatMoney(value)
}

export function ItemCard({
  item,
  projectId,
  categoryName,
  statusOptions,
  priorityOptions,
  attentionContext,
}: {
  item: ItemWithOptions
  projectId: string
  categoryName: string
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
  attentionContext: AttentionContext
}) {
  const formatMoney = useFormatMoney()
  const costs = getItemCostSummary(item)
  const selected = getSelectedOption(item)
  const store = getItemStore(item)
  const purchaseLink = getItemPurchaseLink(item)
  const completion = getItemCompletionDate(item, statusOptions)
  const attentionIssues = collectItemAttentionIssues(item, attentionContext)

  return (
    <article className={`card item-card${attentionIssues.length > 0 ? ' item-card-attention' : ''}`}>
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
      {attentionIssues.length > 0 ? (
        <ul className="attention-list" aria-label="Necesita atención">
          {attentionIssues.map((issue) => (
            <li key={issue}>{ATTENTION_ISSUE_LABELS[issue]}</li>
          ))}
        </ul>
      ) : null}
      {item.description ? <p>{truncate(item.description)}</p> : null}

      <dl className="item-cost-summary">
        <div>
          <dt>Presupuesto</dt>
          <dd>{moneyOrDash(costs.budget, formatMoney)}</dd>
        </div>
        <div>
          <dt>Planeado</dt>
          <dd>{formatMoney(costs.planned)}</dd>
        </div>
        <div>
          <dt>Pagado</dt>
          <dd>{moneyOrDash(costs.paid, formatMoney)}</dd>
        </div>
      </dl>

      {selected ? (
        <p>
          Opción: {selectedOptionLabel(selected)}
          {selected.price != null ? ` · ${formatMoney(selected.price)}` : ''}
        </p>
      ) : (
        <p className="muted">Sin opción seleccionada</p>
      )}
      {store ? <p className="muted">Tienda: {store}</p> : null}
      {purchaseLink ? (
        <p>
          <a href={purchaseLink.href} target="_blank" rel="noopener noreferrer">
            {purchaseLink.source === 'option' ? 'Ver producto' : 'Ver enlace del ítem'}
          </a>
        </p>
      ) : null}
      {completion ? (
        <p className="muted">
          {completion.label}: {formatItemDate(completion.iso)}
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
