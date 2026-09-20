import { Link } from 'react-router'
import { IconRefresh } from '@/components/icons'
import type { ItemWithOptions, ProjectPriorityOption, ProjectStatusOption } from '@/types/domain'
import { priorityLabel, statusLabel } from '@/features/projects/project-options'
import { useFormatMoney } from '@/utils/format'
import {
  ATTENTION_ISSUE_LABELS,
  collectItemAttentionIssues,
  type AttentionContext,
} from './item-attention'
import { itemToneStyle } from './item-tone'
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
  itemDetailSearch,
  reviewing,
  onReviewPrice,
}: {
  item: ItemWithOptions
  projectId: string
  categoryName: string
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
  attentionContext: AttentionContext
  itemDetailSearch: string
  reviewing?: boolean
  onReviewPrice?: () => void
}) {
  const formatMoney = useFormatMoney()
  const costs = getItemCostSummary(item, statusOptions)
  const selected = getSelectedOption(item)
  const store = getItemStore(item)
  const purchaseLink = getItemPurchaseLink(item)
  const completion = getItemCompletionDate(item, statusOptions)
  const attentionIssues = collectItemAttentionIssues(item, attentionContext)
  const canReviewPrice = selected != null && selected.product_url != null

  return (
    <article
      className={`card item-card${attentionIssues.length > 0 ? ' item-card-attention' : ''}${
        !costs.contributesToBudget ? ' item-card-owned' : ''
      }`}
      style={itemToneStyle({
        statusId: item.status,
        priorityId: item.priority,
        statusOptions,
        priorityOptions,
      })}
    >
      <div className="item-card-head">
        <div className="item-card-title">
          <h3>
            <Link to={`/projects/${projectId}/items/${item.id}${itemDetailSearch}`}>
              {item.name}
            </Link>
          </h3>
          <p className="muted">{categoryName}</p>
        </div>
        <div className="item-card-badges" aria-label="Estado y prioridad">
          <span className="item-chip">{statusLabel(item.status, statusOptions)}</span>
          <span className="item-chip item-chip-soft">
            {priorityLabel(item.priority, priorityOptions)}
          </span>
        </div>
      </div>
      {!costs.contributesToBudget ? (
        <p className="muted">Ya lo tienes: no afecta al presupuesto del proyecto.</p>
      ) : null}
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
          <dt>Tope total</dt>
          <dd>{moneyOrDash(costs.budget, formatMoney)}</dd>
        </div>
        <div>
          <dt>Cantidad</dt>
          <dd>{costs.quantity}</dd>
        </div>
        <div>
          <dt>Total proyectado</dt>
          <dd>{costs.contributesToBudget ? formatMoney(costs.planned) : 'No suma'}</dd>
        </div>
        <div>
          <dt>Total pagado</dt>
          <dd>
            {costs.contributesToBudget
              ? moneyOrDash(costs.paid, formatMoney)
              : 'No suma'}
          </dd>
        </div>
      </dl>

      {selected ? (
        <div className="item-card-selected-option">
          <span className="muted">Opción</span>
          <strong>{selectedOptionLabel(selected)}</strong>
          {selected.price != null ? <span>{formatMoney(selected.price)}</span> : null}
        </div>
      ) : (
        <p className="muted">Sin opción seleccionada</p>
      )}
      {store ? <p className="muted">Tienda: {store}</p> : null}
      <div className="item-card-actions">
        {purchaseLink ? (
          <a href={purchaseLink.href} target="_blank" rel="noopener noreferrer">
            {purchaseLink.source === 'option' ? 'Ver producto' : 'Ver enlace del ítem'}
          </a>
        ) : null}
        {onReviewPrice ? (
          <button
            type="button"
            className="btn btn-ghost item-card-review-btn"
            disabled={!canReviewPrice || reviewing}
            onClick={onReviewPrice}
          >
            <IconRefresh className={reviewing ? 'spin-icon' : undefined} />
            {reviewing ? 'Revisando' : 'Revisar precio'}
          </button>
        ) : null}
      </div>
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
