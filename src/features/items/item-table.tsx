import { useState } from 'react'
import { Link } from 'react-router'
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
  selectOption,
  updateOption,
  type OptionInput,
} from '@/features/item-options/option-api'
import { costInputValue, normalizeUrl, parseCost } from '@/utils/form'
import {
  ATTENTION_ISSUE_LABELS,
  collectItemAttentionIssues,
  type AttentionContext,
} from './item-attention'
import { ItemCard } from './item-card'
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
  onItemUpdated,
}: {
  items: readonly ItemWithOptions[]
  projectId: string
  categories: readonly Category[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
  attentionContext: AttentionContext
  onItemUpdated: (item: ItemWithOptions) => void
}) {
  const [savingId, setSavingId] = useState<string | null>(null)
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

  return (
    <div className="stack">
      {error ? (
        <p className="field-error" role="alert">
          {error}
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
            />
          </li>
        ))}
      </ul>

      <div className="item-table-wrap">
        <table className="item-table">
          <thead>
            <tr>
              <th scope="col" className="item-table-sticky-col">
                Producto
              </th>
              <th scope="col">Estado</th>
              <th scope="col">Prioridad</th>
              <th scope="col">Categoría</th>
              <th scope="col">Presupuesto</th>
              <th scope="col">Precio pagado</th>
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
                  onSaveItem={(patch) => void saveItemFields(item, patch)}
                  onSaveOption={(patch) => void saveOptionFields(item, patch)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="field-hint item-table-hint">
        En pantalla grande puedes editar las celdas directo. Presupuesto es lo que
        planeas gastar; precio pagado es lo que realmente pagaste. En el móvil abre el
        detalle del ítem para editar.
      </p>
    </div>
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
  onSaveItem,
  onSaveOption,
}: {
  item: ItemWithOptions
  projectId: string
  categories: readonly Category[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
  attentionContext: AttentionContext
  busy: boolean
  onSaveItem: (patch: Partial<ItemInput>) => void
  onSaveOption: (
    patch: Partial<Pick<ItemOption, 'price' | 'store' | 'product_url'>>,
  ) => void
}) {
  const costs = getItemCostSummary(item, statusOptions)
  const selected = getSelectedOption(item)
  const purchaseLink = getItemPurchaseLink(item)
  const attentionIssues = collectItemAttentionIssues(item, attentionContext)
  const needsAttention = attentionIssues.length > 0

  const [name, setName] = useState(item.name)
  const [estimated, setEstimated] = useState(costInputValue(item.estimated_cost))
  const [paid, setPaid] = useState(costInputValue(item.actual_cost))
  const [store, setStore] = useState(selected?.store ?? '')
  const [link, setLink] = useState(selected?.product_url ?? item.purchase_url ?? '')

  return (
    <tr
      className={[
        needsAttention ? 'item-table-row-attention' : null,
        !costs.contributesToBudget ? 'item-table-row-owned' : null,
      ]
        .filter(Boolean)
        .join(' ') || undefined}
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
          inputMode="decimal"
          aria-label={`Presupuesto ${item.name}`}
          title={
            !costs.contributesToBudget
              ? 'Informativo: no suma al presupuesto del proyecto'
              : 'Presupuesto del ítem'
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
        {costs.contributesToBudget ? (
          <input
            className="item-table-input item-table-input-num"
            inputMode="decimal"
            aria-label={`Precio pagado ${item.name}`}
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
          <span className="item-table-owned-badge" aria-label={`Precio pagado ${item.name}`}>
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
              const normalized = normalizeUrl(trimmed)
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
