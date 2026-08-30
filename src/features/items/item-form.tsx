import { useState, type FormEvent } from 'react'
import type { Category, Item, ProjectPriorityOption, ProjectStatusOption } from '@/types/domain'
import {
  defaultPriorityId,
  defaultStatusId,
  priorityLabel,
  statusLabel,
} from '@/features/projects/project-options'
import { costInputValue, emptyToNull, normalizeUrl, parseCost } from '@/utils/form'
import { createItem, updateItem, type ItemInput } from './item-api'

export function ItemForm({
  projectId,
  categories,
  statusOptions,
  priorityOptions,
  item,
  onSaved,
}: {
  projectId: string
  categories: readonly Category[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
  item?: Item
  onSaved: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [purchaseUrl, setPurchaseUrl] = useState(item?.purchase_url ?? '')
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '')
  const [status, setStatus] = useState(item?.status ?? defaultStatusId(statusOptions))
  const [priority, setPriority] = useState(item?.priority ?? defaultPriorityId(priorityOptions))
  const [estimated, setEstimated] = useState(costInputValue(item?.estimated_cost ?? null))
  const [actual, setActual] = useState(costInputValue(item?.actual_cost ?? null))
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (name.trim() === '') {
      setError('El nombre es obligatorio.')
      return
    }

    const estimated_cost = parseCost(estimated)
    const actual_cost = parseCost(actual)
    if (Number.isNaN(estimated_cost) || (estimated_cost != null && estimated_cost < 0)) {
      setError('El presupuesto esperado no es válido.')
      return
    }
    if (Number.isNaN(actual_cost) || (actual_cost != null && actual_cost < 0)) {
      setError('El precio real no es válido.')
      return
    }

    const purchase_url =
      purchaseUrl.trim() === '' ? null : normalizeUrl(purchaseUrl)
    if (purchaseUrl.trim() !== '' && purchase_url == null) {
      setError('El enlace de compra no es válido.')
      return
    }

    const input: ItemInput = {
      name,
      description: emptyToNull(description),
      category_id: categoryId === '' ? null : categoryId,
      status,
      priority,
      estimated_cost,
      actual_cost,
      purchase_url,
      notes: emptyToNull(notes),
    }

    setSubmitting(true)
    try {
      if (item) {
        await updateItem(item.id, input, statusOptions, item.completed_at)
      } else {
        await createItem(projectId, input, statusOptions)
      }
      onSaved()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo guardar el ítem.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="item-name">Nombre</label>
        <input
          id="item-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="item-description">Descripción</label>
        <textarea
          id="item-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Detalles del producto o qué buscas"
        />
      </div>
      <div className="field">
        <label htmlFor="item-purchase-url">Enlace de compra</label>
        <input
          id="item-purchase-url"
          type="url"
          inputMode="url"
          value={purchaseUrl}
          onChange={(event) => setPurchaseUrl(event.target.value)}
          placeholder="https://tienda.com/producto"
        />
      </div>
      <div className="field">
        <label htmlFor="item-category">Categoría (opcional)</label>
        <select
          id="item-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Sin categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="item-status">Estado</label>
        <select
          id="item-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {statusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {statusLabel(option.id, statusOptions)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="item-priority">Prioridad</label>
        <select
          id="item-priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          {priorityOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {priorityLabel(option.id, priorityOptions)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="item-estimated">Presupuesto esperado</label>
        <input
          id="item-estimated"
          inputMode="decimal"
          value={estimated}
          onChange={(event) => setEstimated(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="item-actual">Precio real pagado</label>
        <input
          id="item-actual"
          inputMode="decimal"
          value={actual}
          onChange={(event) => setActual(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="item-notes">Notas</label>
        <textarea
          id="item-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Observaciones, talla, color, alternativas…"
        />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : item ? 'Guardar cambios' : 'Crear ítem'}
      </button>
    </form>
  )
}
