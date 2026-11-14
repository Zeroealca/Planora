import { useState, type FormEvent } from 'react'
import { IconPencil, IconTrash } from '@/components/icons'
import type { ItemSubarticle } from '@/types/domain'
import { costInputValue, parseCost } from '@/utils/form'
import { useFormatMoney } from '@/utils/format'
import {
  createItemSubarticles,
  deleteItemSubarticle,
  updateItemSubarticle,
} from './item-subarticles-api'
import { calculateSavingsPlanPurchaseSummary } from '@/features/projects/savings-plan-purchases'
import { DEFAULT_STATUS_OPTIONS } from '@/features/projects/project-options'

type ArticleDraft = {
  name: string
  estimated: string
  status: 'pending' | 'purchased'
  actual: string
}

const emptyDraft = (): ArticleDraft => ({
  name: '',
  estimated: '',
  status: 'pending',
  actual: '',
})

export function ItemSubarticlesSection({
  itemId,
  subarticles,
  onChanged,
}: {
  itemId: string
  subarticles: readonly ItemSubarticle[]
  onChanged: () => void
}) {
  const formatMoney = useFormatMoney()
  const [editing, setEditing] = useState<ItemSubarticle | null>(null)
  const [entryMode, setEntryMode] = useState<'detailed' | 'quick'>('detailed')
  const [drafts, setDrafts] = useState<ArticleDraft[]>([emptyDraft()])
  const [quickNames, setQuickNames] = useState('')
  const [quickStatus, setQuickStatus] = useState<'pending' | 'purchased'>('pending')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const summary = calculateSavingsPlanPurchaseSummary(
    [{ status: 'Pending', estimated_cost: null, actual_cost: null, subarticles }],
    DEFAULT_STATUS_OPTIONS,
  )

  function reset() {
    setEditing(null)
    setDrafts([emptyDraft()])
    setQuickNames('')
    setQuickStatus('pending')
    setError(null)
  }

  function updateDraft(index: number, field: keyof ArticleDraft, value: string) {
    setDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index
        ? { ...draft, [field]: field === 'status' ? value as ArticleDraft['status'] : value }
        : draft
    )))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const inputs = entryMode === 'quick' && !editing
      ? quickNames.split(',').map((name) => name.trim()).filter(Boolean).map((name) => ({
        name,
        estimated_cost: null,
        status: quickStatus,
        actual_cost: null,
      }))
      : drafts.map((draft) => ({
        name: draft.name,
        estimated_cost: parseCost(draft.estimated),
        status: draft.status,
        actual_cost: parseCost(draft.actual),
      }))
    if (inputs.length === 0) return setError('Escribe al menos un artículo.')
    const missingNameIndex = inputs.findIndex((input) => !input.name.trim())
    if (missingNameIndex !== -1) return setError(`El nombre del artículo ${missingNameIndex + 1} es obligatorio.`)
    const invalidEstimatedIndex = inputs.findIndex((input) => input.estimated_cost != null && input.estimated_cost < 0)
    if (invalidEstimatedIndex !== -1) return setError(`El precio estimado del artículo ${invalidEstimatedIndex + 1} no es válido.`)
    const invalidActualIndex = inputs.findIndex((input) => input.actual_cost != null && input.actual_cost < 0)
    if (invalidActualIndex !== -1) return setError(`El precio pagado del artículo ${invalidActualIndex + 1} no es válido.`)
    setBusy(true)
    setError(null)
    try {
      if (editing) await updateItemSubarticle(editing.id, inputs[0])
      else await createItemSubarticles(itemId, inputs)
      reset()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el artículo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="stack card" aria-labelledby="item-subarticles-heading">
      <h2 id="item-subarticles-heading">Artículos</h2>
      <div className="metrics-grid metrics-grid-secondary" aria-label="Totales de artículos">
        <article className="metric-card metric-card-compact metric-card-spent"><p className="metric-label">Total gastado</p><p className="metric-value">{formatMoney(summary.spent)}</p></article>
        <article className="metric-card metric-card-compact metric-card-pending"><p className="metric-label">Pendiente estimado</p><p className="metric-value">{formatMoney(summary.pendingEstimated)}</p></article>
        <article className="metric-card metric-card-compact metric-card-projected"><p className="metric-label">Total proyectado</p><p className="metric-value">{formatMoney(summary.projected)}</p></article>
      </div>
      {subarticles.length === 0 ? <p className="muted">Aún no hay artículos internos. Agrega el primero para desglosar este ítem.</p> : (
        <ul className="plain-list savings-movements-list">
          {subarticles.map((article) => <li key={article.id}><div><strong>{article.name}</strong><span className="muted"> · {article.status === 'purchased' ? 'Comprado' : 'Pendiente'}</span></div><div className="row"><span>{article.status === 'purchased' ? formatMoney(article.actual_cost ?? 0) : formatMoney(article.estimated_cost ?? 0)}</span><button type="button" className="btn-icon" aria-label={`Editar ${article.name}`} onClick={() => { setEditing(article); setEntryMode('detailed'); setDrafts([{ name: article.name, estimated: costInputValue(article.estimated_cost), status: article.status, actual: costInputValue(article.actual_cost) }]); setError(null) }}><IconPencil /></button><button type="button" className="btn-icon btn-icon-danger" aria-label={`Eliminar ${article.name}`} onClick={() => { if (window.confirm(`¿Eliminar “${article.name}”?`)) void deleteItemSubarticle(article.id).then(onChanged).catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudo eliminar el artículo.')) }}><IconTrash /></button></div></li>)}
        </ul>
      )}
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <h3>{editing ? 'Editar artículo' : 'Agregar artículo'}</h3>
        {!editing ? <div className="row" aria-label="Modo de agregado"><button type="button" className={entryMode === 'detailed' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setEntryMode('detailed')}>Detalle por artículo</button><button type="button" className={entryMode === 'quick' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setEntryMode('quick')}>Lista rápida</button></div> : null}
        {entryMode === 'quick' && !editing ? <><div className="field"><label htmlFor="subarticle-quick-names">Artículos separados por comas</label><textarea id="subarticle-quick-names" value={quickNames} onChange={(event) => setQuickNames(event.target.value)} placeholder="Cuchillos, platos, vasos" required /><p className="field-hint">Se crearán sin precios.</p></div><div className="field"><label htmlFor="subarticle-quick-status">Estado general</label><select id="subarticle-quick-status" value={quickStatus} onChange={(event) => setQuickStatus(event.target.value as 'pending' | 'purchased')}><option value="pending">Pendiente</option><option value="purchased">Comprado</option></select></div></> : drafts.map((draft, index) => (
          <fieldset className="item-subarticle-draft" key={index}>
            <legend>{editing ? 'Artículo' : `Artículo ${index + 1}`}</legend>
            <div className="filters item-filters item-filters-open"><div className="field"><label htmlFor={`subarticle-name-${index}`}>Nombre</label><input id={`subarticle-name-${index}`} value={draft.name} onChange={(event) => updateDraft(index, 'name', event.target.value)} required /></div><div className="field"><label htmlFor={`subarticle-estimated-${index}`}>Precio estimado</label><input id={`subarticle-estimated-${index}`} type="number" min="0" step="0.01" value={draft.estimated} onChange={(event) => updateDraft(index, 'estimated', event.target.value)} /></div><div className="field"><label htmlFor={`subarticle-status-${index}`}>Estado</label><select id={`subarticle-status-${index}`} value={draft.status} onChange={(event) => updateDraft(index, 'status', event.target.value)}><option value="pending">Pendiente</option><option value="purchased">Comprado</option></select></div><div className="field"><label htmlFor={`subarticle-actual-${index}`}>Precio pagado</label><input id={`subarticle-actual-${index}`} type="number" min="0" step="0.01" value={draft.actual} onChange={(event) => updateDraft(index, 'actual', event.target.value)} /></div></div>
            {!editing && drafts.length > 1 ? <button type="button" className="btn btn-ghost" onClick={() => setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))}>Quitar artículo</button> : null}
          </fieldset>
        ))}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="row">{!editing && entryMode === 'detailed' ? <button type="button" className="btn btn-ghost" onClick={() => setDrafts((current) => [...current, emptyDraft()])}>Añadir otro artículo</button> : null}<button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar artículo' : entryMode === 'quick' ? 'Agregar artículos' : drafts.length === 1 ? 'Agregar artículo' : `Agregar ${drafts.length} artículos`}</button>{editing ? <button type="button" className="btn btn-ghost" onClick={reset}>Cancelar</button> : null}</div>
      </form>
    </section>
  )
}
