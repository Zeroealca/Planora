import { useState } from 'react'
import { Link } from 'react-router'
import { IconRefresh } from '@/components/icons'
import type {
  Category,
  ItemOption,
  ItemWithOptions,
  ProjectPriorityOption,
  ProjectStatusOption,
} from '@/types/domain'
import { updateItem, type ItemInput } from '@/features/items/item-api'
import {
  createOption,
  reviewOptionPrice,
  selectOption,
  updateOption,
  type OptionInput,
} from '@/features/item-options/option-api'
import { normalizeProductUrl } from '@/features/price-tracking/url-normalization'
import { costInputValue, parseCost } from '@/utils/form'
import { useFormatMoney } from '@/utils/format'
import {
  ATTENTION_ISSUE_LABELS,
  collectItemAttentionIssues,
  type AttentionContext,
} from './item-attention'
import { ItemCard } from './item-card'
import type { ItemSortDirection, ItemSortKey } from './item-sort'
import { itemToneStyle } from './item-tone'
import {
  getItemCostSummary,
  getItemPurchaseLink,
  getSelectedOption,
} from './item-summary'

function optionToInput(option: ItemOption): OptionInput {
  return {
    name: option.name,
    brand: option.brand,
    model: option.model,
    price: option.price,
    store: option.store,
    product_url: option.product_url,
    description: option.description,
    specifications: option.specifications,
    notes: option.notes,
  }
}

function itemToInput(item: ItemWithOptions): ItemInput {
  return {
    name: item.name,
    description: item.description,
    category_id: item.category_id,
    status: item.status,
    priority: item.priority,
    quantity: item.quantity,
    estimated_cost: item.estimated_cost,
    actual_cost: item.actual_cost,
    purchase_url: item.purchase_url,
    notes: item.notes,
  }
}

function withUpdatedOption(
  item: ItemWithOptions,
  optionId: string,
  patch: Partial<ItemOption>,
): ItemWithOptions {
  return {
    ...item,
    updated_at: new Date().toISOString(),
    options: item.options.map((option) =>
      option.id === optionId ? { ...option, ...patch } : option,
    ),
  }
}

export function ItemTable({
  items,
  projectId,
  categories,
  statusOptions,
  priorityOptions,
  attentionContext,
  activeSort,
  activeSortDirection,
  onSortChange,
  onItemUpdated,
}: {
  items: readonly ItemWithOptions[]
  projectId: string
  categories: readonly Category[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
  attentionContext: AttentionContext
  activeSort: ItemSortKey
  activeSortDirection: ItemSortDirection
  onSortChange: (sort: ItemSortKey) => void
  onItemUpdated: (item: ItemWithOptions) => void
}) {
  const [savingId, setSavingId] = useState<string | null>(null)
  const formatMoney = useFormatMoney()
  const [reviewingOptionId, setReviewingOptionId] = useState<string | null>(null)
  const [reviewMessage, setReviewMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function saveItemFields(
    item: ItemWithOptions,
    patch: Partial<ItemInput>,
  ): Promise<ItemWithOptions | null> {
    const nextInput = { ...itemToInput(item), ...patch }
    if (nextInput.name.trim() === '') {
      setError('El nombre no puede quedar vacío.')
      return null
    }
    setSavingId(item.id)
    setError(null)
    try {
      await updateItem(item.id, nextInput, statusOptions, item.completed_at)
      const next: ItemWithOptions = {
        ...item,
        ...nextInput,
        name: nextInput.name.trim(),
        updated_at: new Date().toISOString(),
      }
      onItemUpdated(next)
      return next
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo guardar el ítem.')
      return null
    } finally {
      setSavingId(null)
    }
  }

  async function ensureSelectedOption(item: ItemWithOptions): Promise<{
    item: ItemWithOptions
    option: ItemOption
  } | null> {
    const selected = getSelectedOption(item)
    if (selected) return { item, option: selected }

    setSavingId(item.id)
    setError(null)
    try {
      const created = await createOption(item.id, {
        name: item.name.trim() || 'Opción',
        brand: null,
        model: null,
        price: null,
        store: null,
        product_url: null,
        description: null,
        specifications: null,
        notes: null,
      })
      await selectOption(created.id)
      const next: ItemWithOptions = {
        ...item,
        updated_at: new Date().toISOString(),
        options: [
          ...item.options.map((option) => ({ ...option, selected: false })),
          { ...created, selected: true },
        ],
      }
      onItemUpdated(next)
      return { item: next, option: { ...created, selected: true } }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo crear la opción.')
      return null
    } finally {
      setSavingId(null)
    }
  }

  async function saveOptionFields(
    item: ItemWithOptions,
    patch: Partial<Pick<ItemOption, 'price' | 'store' | 'product_url'>>,
  ) {
    const ensured = await ensureSelectedOption(item)
    if (!ensured) return
    const { item: current, option } = ensured
    const input = { ...optionToInput(option), ...patch }
    setSavingId(current.id)
    setError(null)
    try {
      await updateOption(option.id, input)
      onItemUpdated(withUpdatedOption(current, option.id, patch))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo guardar la opción.')
    } finally {
      setSavingId(null)
    }
  }

  async function reviewSelectedOption(item: ItemWithOptions) {
    const selected = getSelectedOption(item)
    if (!selected) {
      setError('Selecciona o crea una opción antes de revisar el precio.')
      return
    }
    if (!selected.product_url) {
      setError('La opción seleccionada no tiene enlace de producto.')
      return
    }

    setReviewingOptionId(selected.id)
    setError(null)
    setReviewMessage(null)
    try {
      const result = await reviewOptionPrice(selected.id)
      const patch: Partial<ItemOption> = {
        last_checked_at: result.checkedAt,
        tracking_status: result.status,
      }
      if (result.updatedPrice != null) {
        patch.price = result.updatedPrice
      }
      onItemUpdated(withUpdatedOption(item, selected.id, patch))
      setReviewMessage(
        result.updatedPrice != null
          ? `Precio actualizado para ${item.name}.`
          : `Precio revisado para ${item.name}; requiere atención.`,
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo revisar el precio.')
    } finally {
      setReviewingOptionId(null)
    }
  }

  return (
    <div className="stack">
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {reviewMessage ? (
        <p className="alert alert-success" role="status">
          {reviewMessage}
        </p>
      ) : null}

      <ul className="item-card-list" aria-label="Ítems">
        {items.map((item) => (
          <li key={`card-${item.id}`}>
            <ItemCard
              item={item}
              projectId={projectId}
              categoryName={
                categories.find((category) => category.id === item.category_id)?.name ??
                'Sin categoría'
              }
              statusOptions={statusOptions}
              priorityOptions={priorityOptions}
              attentionContext={attentionContext}
              reviewing={getSelectedOption(item)?.id === reviewingOptionId}
              onReviewPrice={() => void reviewSelectedOption(item)}
            />
          </li>
        ))}
      </ul>

      <div className="item-table-wrap">
        <table className="item-table">
          <thead>
            <tr>
              <th scope="col" className="item-table-sticky-col">
                <SortHeader
                  label="Producto"
                  sortKey="name"
                  activeSort={activeSort}
                  activeSortDirection={activeSortDirection}
                  onSortChange={onSortChange}
                />
              </th>
              <th scope="col">
                <SortHeader
                  label="Estado"
                  sortKey="status"
                  activeSort={activeSort}
                  activeSortDirection={activeSortDirection}
                  onSortChange={onSortChange}
                />
              </th>
              <th scope="col">
                <SortHeader
                  label="Prioridad"
                  sortKey="priority"
                  activeSort={activeSort}
                  activeSortDirection={activeSortDirection}
                  onSortChange={onSortChange}
                />
              </th>
              <th scope="col">
                <SortHeader
                  label="Categoría"
                  sortKey="category"
                  activeSort={activeSort}
                  activeSortDirection={activeSortDirection}
                  onSortChange={onSortChange}
                />
              </th>
              <th scope="col">Cantidad</th>
              <th scope="col">Tope total</th>
              <th scope="col">Precio unit.</th>
              <th scope="col">Total proyect.</th>
              <th scope="col">Total pagado</th>
              <th scope="col">Tienda</th>
              <th scope="col">Enlace</th>
              <th scope="col">Atención</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const selected = getSelectedOption(item)
              return (
                <EditableItemRow
                  key={`${item.id}-${item.updated_at}-${selected?.id ?? ''}-${selected?.price}-${selected?.store}-${selected?.product_url}-${item.status}`}
                  item={item}
                  projectId={projectId}
                  categories={categories}
                  statusOptions={statusOptions}
                  priorityOptions={priorityOptions}
                  attentionContext={attentionContext}
                  busy={savingId === item.id}
                  reviewingOptionId={reviewingOptionId}
                  formatMoney={formatMoney}
                  onSaveItem={(patch) => void saveItemFields(item, patch)}
                  onSaveOption={(patch) => void saveOptionFields(item, patch)}
                  onReviewPrice={() => void reviewSelectedOption(item)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="field-hint item-table-hint">
        En pantalla grande puedes editar las celdas directo. Tope total es lo
        máximo que planeas gastar en ese ítem; precio unitario sale de la opción
        seleccionada o del seguimiento y se multiplica por cantidad.
      </p>
    </div>
  )
}

function SortHeader({
  label,
  sortKey,
  activeSort,
  activeSortDirection,
  onSortChange,
}: {
  label: string
  sortKey: ItemSortKey
  activeSort: ItemSortKey
  activeSortDirection: ItemSortDirection
  onSortChange: (sort: ItemSortKey) => void
}) {
  const active = activeSort === sortKey
  const directionLabel = activeSortDirection === 'asc' ? 'ascendente' : 'descendente'
  return (
    <button
      type="button"
      className={`item-table-sort${active ? ' item-table-sort-active' : ''}`}
      aria-pressed={active}
      aria-label={
        active
          ? `Ordenando por ${label} en orden ${directionLabel}. Cambiar dirección.`
          : `Ordenar por ${label}`
      }
      onClick={() => onSortChange(sortKey)}
    >
      {label}
      <span aria-hidden="true">{active ? (activeSortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
    </button>
  )
}

function EditableItemRow({
  item,
  projectId,
  categories,
  statusOptions,
  priorityOptions,
  attentionContext,
  busy,
  reviewingOptionId,
  formatMoney,
  onSaveItem,
  onSaveOption,
  onReviewPrice,
}: {
  item: ItemWithOptions
  projectId: string
  categories: readonly Category[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
  attentionContext: AttentionContext
  busy: boolean
  reviewingOptionId: string | null
  formatMoney: (value: number) => string
  onSaveItem: (patch: Partial<ItemInput>) => void
  onSaveOption: (
    patch: Partial<Pick<ItemOption, 'price' | 'store' | 'product_url'>>,
  ) => void
  onReviewPrice: () => void
}) {
  const costs = getItemCostSummary(item, statusOptions)
  const selected = getSelectedOption(item)
  const purchaseLink = getItemPurchaseLink(item)
  const reviewing = selected != null && reviewingOptionId === selected.id
  const attentionIssues = collectItemAttentionIssues(item, attentionContext)
  const needsAttention = attentionIssues.length > 0

  const [name, setName] = useState(item.name)
  const [estimated, setEstimated] = useState(costInputValue(item.estimated_cost))
  const [quantity, setQuantity] = useState(costInputValue(item.quantity))
  const [paid, setPaid] = useState(costInputValue(item.actual_cost))
  const [unitPrice, setUnitPrice] = useState(costInputValue(selected?.price ?? null))
  const [store, setStore] = useState(selected?.store ?? '')
  const [link, setLink] = useState(selected?.product_url ?? item.purchase_url ?? '')

  return (
    <tr
      className={[
        'item-tone-row',
        needsAttention ? 'item-table-row-attention' : null,
        !costs.contributesToBudget ? 'item-table-row-owned' : null,
      ]
        .filter(Boolean)
        .join(' ') || undefined}
      style={itemToneStyle({
        statusId: item.status,
        priorityId: item.priority,
        statusOptions,
        priorityOptions,
      })}
      data-busy={busy ? 'true' : undefined}
      title={
        !costs.contributesToBudget
          ? 'Ya lo tienes: este ítem no afecta al presupuesto del proyecto'
          : undefined
      }
    >
      <th scope="row" className="item-table-sticky-col item-table-name">
        <div className="item-table-name-edit">
          <input
            className="item-table-input"
            aria-label={`Nombre ${item.name}`}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() === item.name) return
              onSaveItem({ name })
            }}
          />
          <Link
            to={`/projects/${projectId}/items/${item.id}`}
            className="item-table-detail-link"
            title="Abrir detalle"
            aria-label={`Abrir detalle de ${item.name}`}
          >
            ↗
          </Link>
        </div>
      </th>
      <td>
        <select
          className="item-table-input"
          aria-label={`Estado ${item.name}`}
          value={item.status}
          disabled={busy}
          onChange={(e) => onSaveItem({ status: e.target.value })}
        >
          {statusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          className="item-table-input"
          aria-label={`Prioridad ${item.name}`}
          value={item.priority}
          disabled={busy}
          onChange={(e) => onSaveItem({ priority: e.target.value })}
        >
          {priorityOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          className="item-table-input"
          aria-label={`Categoría ${item.name}`}
          value={item.category_id ?? ''}
          disabled={busy}
          onChange={(e) =>
            onSaveItem({ category_id: e.target.value === '' ? null : e.target.value })
          }
        >
          <option value="">Sin categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          className="item-table-input item-table-input-num"
          type="number"
          step="0.01"
          aria-label={`Cantidad ${item.name}`}
          title="Cantidad"
          value={quantity}
          disabled={busy}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={() => {
            const value = parseCost(quantity)
            if (Number.isNaN(value) || value == null || value <= 0) {
              setQuantity(costInputValue(item.quantity))
              return
            }
            if (value === item.quantity) return
            onSaveItem({ quantity: value })
          }}
        />
      </td>
      <td>
        <input
          className="item-table-input item-table-input-num"
          type="number"
          step="0.01"
          aria-label={`Tope total ${item.name}`}
          title={
            !costs.contributesToBudget
              ? 'Informativo: no suma al presupuesto del proyecto'
              : 'Tope total presupuestado'
          }
          value={estimated}
          disabled={busy}
          onChange={(e) => setEstimated(e.target.value)}
          onBlur={() => {
            const value = parseCost(estimated)
            if (Number.isNaN(value) || (value != null && value < 0)) {
              setEstimated(costInputValue(item.estimated_cost))
              return
            }
            if (value === item.estimated_cost) return
            onSaveItem({ estimated_cost: value })
          }}
        />
      </td>
      <td>
        <div className="item-table-price-review">
          <input
            className="item-table-input item-table-input-num"
            type="number"
            step="0.01"
            aria-label={`Precio unitario ${item.name}`}
            value={unitPrice}
            disabled={busy || !selected}
            placeholder="—"
            onChange={(e) => setUnitPrice(e.target.value)}
            onBlur={() => {
              const value = parseCost(unitPrice)
              if (Number.isNaN(value) || (value != null && value < 0)) {
                setUnitPrice(costInputValue(selected?.price ?? null))
                return
              }
              if (value === (selected?.price ?? null)) return
              onSaveOption({ price: value })
            }}
          />
          {selected ? (
            <button
              type="button"
              className="btn-icon item-table-review-btn"
              disabled={busy || reviewing || !selected.product_url}
              onClick={onReviewPrice}
              title={reviewing ? 'Revisando precio' : 'Revisar precio'}
              aria-label={
                reviewing
                  ? `Revisando precio de ${item.name}`
                  : `Revisar precio de ${item.name}`
              }
            >
              <IconRefresh className={reviewing ? 'spin-icon' : undefined} />
            </button>
          ) : null}
        </div>
      </td>
      <td>{costs.contributesToBudget ? formatMoney(costs.planned) : 'No suma'}</td>
      <td>
        {costs.contributesToBudget ? (
          <input
            className="item-table-input item-table-input-num"
            type="number"
            step="0.01"
            aria-label={`Total pagado ${item.name}`}
            value={paid}
            disabled={busy}
            onChange={(e) => setPaid(e.target.value)}
            onBlur={() => {
              const value = parseCost(paid)
              if (Number.isNaN(value) || (value != null && value < 0)) {
                setPaid(costInputValue(item.actual_cost))
                return
              }
              if (value === item.actual_cost) return
              onSaveItem({ actual_cost: value })
            }}
          />
        ) : (
          <span className="item-table-owned-badge" aria-label={`Total pagado ${item.name}`}>
            No suma
          </span>
        )}
      </td>
      <td>
        <input
          className="item-table-input"
          aria-label={`Tienda ${item.name}`}
          value={store}
          disabled={busy}
          onChange={(e) => setStore(e.target.value)}
          onBlur={() => {
            const next = store.trim() === '' ? null : store.trim()
            if (next === (selected?.store ?? null)) return
            onSaveOption({ store: next })
          }}
        />
      </td>
      <td>
        <div className="item-table-link-edit">
          <input
            className="item-table-input"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            aria-label={`Enlace ${item.name}`}
            value={link}
            disabled={busy}
            placeholder="https://…"
            onChange={(e) => setLink(e.target.value)}
            onBlur={() => {
              const trimmed = link.trim()
              if (trimmed === '') {
                if (!(selected?.product_url ?? item.purchase_url)) return
                onSaveOption({ product_url: null })
                return
              }
              const normalized = normalizeProductUrl(trimmed)
              if (normalized == null) {
                setLink(selected?.product_url ?? item.purchase_url ?? '')
                return
              }
              if (normalized === (selected?.product_url ?? item.purchase_url)) return
              onSaveOption({ product_url: normalized })
            }}
          />
          {purchaseLink ? (
            <a
              href={purchaseLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="item-table-detail-link"
              title="Abrir enlace"
            >
              ↗
            </a>
          ) : null}
        </div>
      </td>
      <td className="item-table-attention">
        {needsAttention ? (
          <span title={attentionIssues.map((i) => ATTENTION_ISSUE_LABELS[i]).join(' · ')}>
            {attentionIssues.map((i) => ATTENTION_ISSUE_LABELS[i]).join(' · ')}
          </span>
        ) : (
          '—'
        )}
      </td>
    </tr>
  )
}
