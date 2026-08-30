import { useEffect, useState, type FormEvent } from 'react'
import type { ItemOption } from '@/types/domain'
import { costInputValue, emptyToNull, parseCost } from '@/utils/form'
import { formatMoney } from '@/utils/format'
import {
  createOption,
  deleteOption,
  selectOption,
  signedImageUrl,
  updateOption,
  uploadOptionImage,
  optionImagePath,
  validateOptionImage,
  type OptionInput,
} from './option-api'

function OptionImage({ path, alt }: { path: string | null; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void signedImageUrl(path).then((next) => {
      if (!cancelled) setUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  if (!url) return null
  return <img className="option-thumb" src={url} alt={alt} />
}

function OptionForm({
  option,
  itemId,
  onSaved,
}: {
  option?: ItemOption
  itemId: string
  onSaved: () => void
}) {
  const [name, setName] = useState(option?.name ?? '')
  const [brand, setBrand] = useState(option?.brand ?? '')
  const [model, setModel] = useState(option?.model ?? '')
  const [price, setPrice] = useState(costInputValue(option?.price ?? null))
  const [store, setStore] = useState(option?.store ?? '')
  const [productUrl, setProductUrl] = useState(option?.product_url ?? '')
  const [description, setDescription] = useState(option?.description ?? '')
  const [specifications, setSpecifications] = useState(option?.specifications ?? '')
  const [notes, setNotes] = useState(option?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (name.trim() === '') {
      setError('El nombre es obligatorio.')
      return
    }
    const parsedPrice = parseCost(price)
    if (Number.isNaN(parsedPrice) || (parsedPrice != null && parsedPrice < 0)) {
      setError('El precio no es válido.')
      return
    }

    const input: OptionInput = {
      name,
      brand: emptyToNull(brand),
      model: emptyToNull(model),
      price: parsedPrice,
      store: emptyToNull(store),
      product_url: emptyToNull(productUrl),
      description: emptyToNull(description),
      specifications: emptyToNull(specifications),
      notes: emptyToNull(notes),
    }

    setSubmitting(true)
    try {
      if (option) {
        await updateOption(option.id, input)
      } else {
        await createOption(itemId, input)
      }
      onSaved()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo guardar la opción.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor={`opt-name-${option?.id ?? 'new'}`}>Nombre</label>
        <input
          id={`opt-name-${option?.id ?? 'new'}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`opt-brand-${option?.id ?? 'new'}`}>Marca</label>
        <input
          id={`opt-brand-${option?.id ?? 'new'}`}
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`opt-model-${option?.id ?? 'new'}`}>Modelo</label>
        <input
          id={`opt-model-${option?.id ?? 'new'}`}
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`opt-price-${option?.id ?? 'new'}`}>Precio</label>
        <input
          id={`opt-price-${option?.id ?? 'new'}`}
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`opt-store-${option?.id ?? 'new'}`}>Tienda</label>
        <input
          id={`opt-store-${option?.id ?? 'new'}`}
          value={store}
          onChange={(event) => setStore(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`opt-url-${option?.id ?? 'new'}`}>URL del producto</label>
        <input
          id={`opt-url-${option?.id ?? 'new'}`}
          type="url"
          value={productUrl}
          onChange={(event) => setProductUrl(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`opt-desc-${option?.id ?? 'new'}`}>Descripción</label>
        <textarea
          id={`opt-desc-${option?.id ?? 'new'}`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </div>
      <div className="field">
        <label htmlFor={`opt-spec-${option?.id ?? 'new'}`}>Características</label>
        <textarea
          id={`opt-spec-${option?.id ?? 'new'}`}
          value={specifications}
          onChange={(event) => setSpecifications(event.target.value)}
          rows={2}
        />
      </div>
      <div className="field">
        <label htmlFor={`opt-notes-${option?.id ?? 'new'}`}>Notas</label>
        <textarea
          id={`opt-notes-${option?.id ?? 'new'}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
        />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : option ? 'Guardar opción' : 'Añadir opción'}
      </button>
    </form>
  )
}

export function OptionList({
  options,
  itemId,
  projectId,
  userId,
  onChanged,
}: {
  options: readonly ItemOption[]
  itemId: string
  projectId: string
  userId: string
  onChanged: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSelect(optionId: string) {
    try {
      await selectOption(optionId)
      onChanged()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo seleccionar.')
    }
  }

  async function onDelete(option: ItemOption) {
    if (!window.confirm(`¿Eliminar la opción “${option.name}”?`)) return
    try {
      await deleteOption(option)
      onChanged()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  async function onImage(option: ItemOption, file: File | undefined) {
    if (!file) return
    const invalid = validateOptionImage(file)
    if (invalid) {
      setError(invalid)
      return
    }
    try {
      const path = optionImagePath(userId, projectId, itemId, option.id)
      await uploadOptionImage(path, file, option.image_url)
      onChanged()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen.')
    }
  }

  return (
    <section className="stack" aria-labelledby="options-heading">
      <h2 id="options-heading">Opciones de compra</h2>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {options.length === 0 ? (
        <p className="muted">Este ítem no tiene opciones todavía.</p>
      ) : (
        <ul className="card-list">
          {options.map((option) => (
            <li key={option.id} className="card">
              <div className="row-between">
                <h3>
                  {option.name}
                  {option.selected ? ' · seleccionada' : ''}
                </h3>
                {option.selected ? (
                  <span className="badge">Preferida</span>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void onSelect(option.id)}
                  >
                    Seleccionar
                  </button>
                )}
              </div>
              <OptionImage path={option.image_url} alt={option.name} />
              <p className="muted">
                {[option.brand, option.model].filter(Boolean).join(' · ') || 'Sin marca'}
              </p>
              <p>Precio: {option.price == null ? '—' : formatMoney(option.price)}</p>
              {option.store ? <p>Tienda: {option.store}</p> : null}
              {option.product_url ? (
                <p>
                  <a href={option.product_url} rel="noreferrer" target="_blank">
                    Ver producto
                  </a>
                </p>
              ) : null}
              {option.description ? <p>{option.description}</p> : null}
              {option.specifications ? <p>{option.specifications}</p> : null}
              {option.notes ? <p className="muted">{option.notes}</p> : null}
              <div className="field">
                <label htmlFor={`img-${option.id}`}>Imagen (JPG, PNG o WebP, máx. 5 MB)</label>
                <input
                  id={`img-${option.id}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => void onImage(option, event.target.files?.[0])}
                />
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setEditingId(editingId === option.id ? null : option.id)
                  }
                >
                  {editingId === option.id ? 'Cerrar' : 'Editar'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void onDelete(option)}
                >
                  Eliminar
                </button>
              </div>
              {editingId === option.id ? (
                <OptionForm
                  option={option}
                  itemId={itemId}
                  onSaved={() => {
                    setEditingId(null)
                    onChanged()
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {creating ? (
        <OptionForm
          itemId={itemId}
          onSaved={() => {
            setCreating(false)
            onChanged()
          }}
        />
      ) : (
        <button type="button" className="btn" onClick={() => setCreating(true)}>
          Añadir opción
        </button>
      )}
    </section>
  )
}
