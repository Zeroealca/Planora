import { useEffect, useState, type FormEvent } from 'react'
import { IconClose, IconPencil, IconRefresh, IconTrash } from '@/components/icons'
import type { ItemOption } from '@/types/domain'
import { costInputValue, emptyToNull, parseCost } from '@/utils/form'
import { useFormatMoney } from '@/utils/format'
import { normalizeProductUrl } from '@/features/price-tracking/url-normalization'
import type {
  PriceTrackingStatus,
  TrackedPriceType,
} from '@/features/price-tracking/types'
import {
  createOption,
  deleteOption,
  reviewOptionPrice,
  selectOption,
  signedImageUrl,
  updateOption,
  updateOptionTracking,
  uploadOptionImage,
  optionImagePath,
  validateOptionImage,
  type OptionInput,
} from './option-api'

const TRACKING_STATUS_LABELS: Record<PriceTrackingStatus, string> = {
  inactive: 'Inactivo',
  active: 'Activo',
  success: 'Actualizado',
  price_not_found: 'Precio no encontrado',
  unavailable: 'No disponible',
  error: 'Error',
  needs_review: 'Requiere revisión',
}

function trackingStatusLabel(status: PriceTrackingStatus): string {
  return TRACKING_STATUS_LABELS[status] ?? status
}

function trackingSummary(option: ItemOption): string {
  const enabled = option.tracking_enabled ? 'Activo' : 'Inactivo'
  if (!option.tracking_enabled && option.tracking_status === 'inactive') {
    return enabled
  }
  return `${enabled} · ${trackingStatusLabel(option.tracking_status)}`
}

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
  const [trackingEnabled, setTrackingEnabled] = useState(
    option?.tracking_enabled ?? false,
  )
  const [trackedPriceType, setTrackedPriceType] = useState<TrackedPriceType>(
    option?.tracked_price_type ?? 'primary',
  )
  const [targetPrice, setTargetPrice] = useState(
    costInputValue(option?.target_price ?? null),
  )
  const [alertOnDrop, setAlertOnDrop] = useState(option?.alert_on_drop ?? false)
  const [alertOnIncrease, setAlertOnIncrease] = useState(
    option?.alert_on_increase ?? false,
  )
  const [alertDropPercentage, setAlertDropPercentage] = useState(
    costInputValue(option?.alert_drop_percentage ?? null),
  )
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
    const normalizedProductUrl =
      productUrl.trim() === '' ? null : normalizeProductUrl(productUrl)
    if (productUrl.trim() !== '' && normalizedProductUrl == null) {
      setError('La URL del producto no es válida.')
      return
    }
    const parsedTargetPrice = parseCost(targetPrice)
    if (
      Number.isNaN(parsedTargetPrice) ||
      (parsedTargetPrice != null && parsedTargetPrice <= 0)
    ) {
      setError('El precio objetivo debe ser mayor a 0.')
      return
    }
    const parsedDropPercentage = parseCost(alertDropPercentage)
    if (
      Number.isNaN(parsedDropPercentage) ||
      (parsedDropPercentage != null &&
        (parsedDropPercentage <= 0 || parsedDropPercentage > 100))
    ) {
      setError('El porcentaje de bajada debe estar entre 0 y 100.')
      return
    }

    const input: OptionInput = {
      name,
      brand: emptyToNull(brand),
      model: emptyToNull(model),
      price: parsedPrice,
      store: emptyToNull(store),
      product_url: normalizedProductUrl,
      description: emptyToNull(description),
      specifications: emptyToNull(specifications),
      notes: emptyToNull(notes),
    }

    setSubmitting(true)
    try {
      let optionId = option?.id
      if (option) {
        await updateOption(option.id, input)
      } else {
        const created = await createOption(itemId, input)
        optionId = created.id
      }
      if (optionId) {
        await updateOptionTracking(optionId, {
          tracking_enabled: trackingEnabled,
          tracked_price_type: trackedPriceType,
          target_price: parsedTargetPrice,
          alert_on_drop: alertOnDrop,
          alert_on_increase: alertOnIncrease,
          alert_drop_percentage: parsedDropPercentage,
          tracking_status: trackingEnabled
            ? option?.tracking_status === 'inactive' || !option
              ? 'active'
              : option.tracking_status
            : 'inactive',
        })
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
          type="number"
          step="0.01"
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
      <fieldset className="field">
        <legend>Seguimiento de precio</legend>
        <label className="check-row">
          <input
            type="checkbox"
            checked={trackingEnabled}
            onChange={(event) => setTrackingEnabled(event.target.checked)}
          />
          Seguimiento activo
        </label>
      </fieldset>
      <div className="field">
        <label htmlFor={`opt-tracked-type-${option?.id ?? 'new'}`}>
          Precio a seguir
        </label>
        <select
          id={`opt-tracked-type-${option?.id ?? 'new'}`}
          value={trackedPriceType}
          onChange={(event) =>
            setTrackedPriceType(event.target.value as TrackedPriceType)
          }
        >
          <option value="primary">Principal</option>
          <option value="promotional">Promocional</option>
          <option value="regular">Regular</option>
          <option value="cash">Efectivo</option>
          <option value="card">Tarjeta</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`opt-target-${option?.id ?? 'new'}`}>Precio objetivo</label>
        <input
          id={`opt-target-${option?.id ?? 'new'}`}
          type="number"
          step="0.01"
          value={targetPrice}
          onChange={(event) => setTargetPrice(event.target.value)}
        />
      </div>
      <fieldset className="field">
        <legend>Alertas futuras</legend>
        <label className="check-row">
          <input
            type="checkbox"
            checked={alertOnDrop}
            onChange={(event) => setAlertOnDrop(event.target.checked)}
          />
          Avisar bajadas
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={alertOnIncrease}
            onChange={(event) => setAlertOnIncrease(event.target.checked)}
          />
          Avisar subidas
        </label>
      </fieldset>
      <div className="field">
        <label htmlFor={`opt-drop-${option?.id ?? 'new'}`}>Bajada mínima (%)</label>
        <input
          id={`opt-drop-${option?.id ?? 'new'}`}
          type="number"
          step="0.01"
          value={alertDropPercentage}
          onChange={(event) => setAlertDropPercentage(event.target.value)}
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
  const formatMoney = useFormatMoney()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewMessage, setReviewMessage] = useState<string | null>(null)

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

  async function onReview(option: ItemOption) {
    setReviewingId(option.id)
    setError(null)
    setReviewMessage(null)
    try {
      const result = await reviewOptionPrice(option.id)
      if (result.updatedPrice != null) {
        setReviewMessage(
          `Precio actualizado: ${formatMoney(result.updatedPrice)}.`,
        )
      } else if (result.detectedPrice != null) {
        setReviewMessage(
          `Precio detectado: ${formatMoney(result.detectedPrice)}. Requiere revisión.`,
        )
      } else {
        setReviewMessage('No se encontró un precio para actualizar.')
      }
      onChanged()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo revisar el precio.')
    } finally {
      setReviewingId(null)
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
      {reviewMessage ? (
        <p className="alert alert-success" role="status">
          {reviewMessage}
        </p>
      ) : null}
      {options.length === 0 ? (
        <p className="muted">Este ítem no tiene opciones todavía.</p>
      ) : (
        <ul className="card-list">
          {options.map((option) => {
            const brandModel =
              [option.brand, option.model].filter(Boolean).join(' · ') || 'Sin marca'
            const isEditing = editingId === option.id
            const isReviewing = reviewingId === option.id

            return (
              <li
                key={option.id}
                className={`card option-card${option.selected ? ' option-card-selected' : ''}`}
              >
                <div className="option-card-head">
                  <div className="option-card-title">
                    <h3>{option.name}</h3>
                    {option.selected ? (
                      <span className="badge">Preferida</span>
                    ) : null}
                  </div>
                  <div className="option-card-toolbar">
                    {!option.selected ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void onSelect(option.id)}
                      >
                        Seleccionar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setEditingId(isEditing ? null : option.id)}
                      aria-label={
                        isEditing
                          ? `Cerrar edición de ${option.name}`
                          : `Editar ${option.name}`
                      }
                      title={isEditing ? 'Cerrar' : 'Editar'}
                      aria-pressed={isEditing}
                    >
                      {isEditing ? <IconClose size={16} /> : <IconPencil />}
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-icon-danger"
                      onClick={() => void onDelete(option)}
                      aria-label={`Eliminar ${option.name}`}
                      title="Eliminar"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>

                <OptionImage path={option.image_url} alt={option.name} />

                <dl className="option-card-meta">
                  <div>
                    <dt>Marca</dt>
                    <dd>{brandModel}</dd>
                  </div>
                  <div>
                    <dt>Precio</dt>
                    <dd>{option.price == null ? '—' : formatMoney(option.price)}</dd>
                  </div>
                  <div>
                    <dt>Tienda</dt>
                    <dd>{option.store || '—'}</dd>
                  </div>
                  <div>
                    <dt>Seguimiento</dt>
                    <dd>{trackingSummary(option)}</dd>
                  </div>
                  {option.last_checked_at ? (
                    <div className="option-card-meta-wide">
                      <dt>Última revisión</dt>
                      <dd>{new Date(option.last_checked_at).toLocaleString()}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="option-card-actions">
                  {option.product_url ? (
                    <a
                      href={option.product_url}
                      rel="noreferrer"
                      target="_blank"
                      className="btn btn-ghost"
                    >
                      Ver producto
                    </a>
                  ) : (
                    <span className="muted">Sin enlace de producto</span>
                  )}
                  <button
                    type="button"
                    className="btn option-review-btn"
                    disabled={isReviewing || !option.product_url}
                    onClick={() => void onReview(option)}
                  >
                    <IconRefresh className={isReviewing ? 'spin-icon' : undefined} />
                    {isReviewing ? 'Revisando precio' : 'Revisar precio'}
                  </button>
                </div>

                {option.description ? <p>{option.description}</p> : null}
                {option.specifications ? <p>{option.specifications}</p> : null}
                {option.notes ? <p className="muted">{option.notes}</p> : null}

                <div className="file-picker">
                  <span className="file-picker-label" id={`img-label-${option.id}`}>
                    Imagen
                  </span>
                  <p className="muted file-picker-hint">
                    JPG, PNG o WebP · máx. 5 MB
                  </p>
                  <div className="file-picker-row">
                    <input
                      id={`img-${option.id}`}
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-labelledby={`img-label-${option.id}`}
                      onChange={(event) => {
                        void onImage(option, event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                    <label htmlFor={`img-${option.id}`} className="btn">
                      {option.image_url ? 'Cambiar imagen' : 'Subir imagen'}
                    </label>
                    <span className="muted file-picker-name">
                      {option.image_url
                        ? 'Imagen cargada'
                        : 'Ningún archivo seleccionado'}
                    </span>
                  </div>
                </div>

                {isEditing ? (
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
            )
          })}
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
