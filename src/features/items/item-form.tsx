import { useState, type FormEvent } from 'react'
import {
  ITEM_PRIORITIES,
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  type Category,
  type Item,
  type ItemPriority,
  type ItemStatus,
  type LabelPreset,
} from '@/types/domain'
import { priorityLabel } from '@/features/projects/priority-labels'
import { costInputValue, emptyToNull, parseCost } from '@/utils/form'
import { createItem, updateItem, type ItemInput } from './item-api'

export function ItemForm({
  projectId,
  categories,
  preset,
  item,
  onSaved,
}: {
  projectId: string
  categories: readonly Category[]
  preset: LabelPreset
  item?: Item
  onSaved: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '')
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? 'Pending')
  const [priority, setPriority] = useState<ItemPriority>(item?.priority ?? 'Medium')
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
      setError('El costo estimado no es válido.')
      return
    }
    if (Number.isNaN(actual_cost) || (actual_cost != null && actual_cost < 0)) {
      setError('El costo real no es válido.')
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
      notes: emptyToNull(notes),
    }

    setSubmitting(true)
    try {
      if (item) {
        await updateItem(item.id, input, item.completed_at)
      } else {
        await createItem(projectId, input)
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
        <label htmlFor="item-description">Descripción (opcional)</label>
        <textarea
          id="item-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
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
          onChange={(event) => setStatus(event.target.value as ItemStatus)}
        >
          {ITEM_STATUSES.map((value) => (
            <option key={value} value={value}>
              {ITEM_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="item-priority">Prioridad</label>
        <select
          id="item-priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value as ItemPriority)}
        >
          {ITEM_PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {priorityLabel(value, preset)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="item-estimated">Costo estimado</label>
        <input
          id="item-estimated"
          inputMode="decimal"
          value={estimated}
          onChange={(event) => setEstimated(event.target.value)}
        />
      </div>
      {status === 'Purchased' ? (
        <div className="field">
          <label htmlFor="item-actual">Costo real</label>
          <input
            id="item-actual"
            inputMode="decimal"
            value={actual}
            onChange={(event) => setActual(event.target.value)}
          />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="item-notes">Notas</label>
        <textarea
          id="item-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
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
