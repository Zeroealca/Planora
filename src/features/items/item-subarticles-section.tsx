import { useState, type FormEvent } from 'react'
import { IconPencil, IconTrash } from '@/components/icons'
import type { ItemSubarticle } from '@/types/domain'
import { costInputValue, parseCost } from '@/utils/form'
import { useFormatMoney } from '@/utils/format'
import {
  createItemSubarticle,
  deleteItemSubarticle,
  updateItemSubarticle,
} from './item-subarticles-api'
import { calculateSavingsPlanPurchaseSummary } from '@/features/projects/savings-plan-purchases'
import { DEFAULT_STATUS_OPTIONS } from '@/features/projects/project-options'

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
  const [name, setName] = useState('')
  const [estimated, setEstimated] = useState('')
  const [status, setStatus] = useState<'pending' | 'purchased'>('pending')
  const [actual, setActual] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const summary = calculateSavingsPlanPurchaseSummary(
    [{ status: 'Pending', estimated_cost: null, actual_cost: null, subarticles }],
    DEFAULT_STATUS_OPTIONS,
  )

  function reset() {
    setEditing(null)
    setName('')
    setEstimated('')
    setStatus('pending')
    setActual('')
    setError(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const estimatedCost = parseCost(estimated)
    const actualCost = parseCost(actual)
    if (!name.trim()) return setError('El nombre es obligatorio.')
    if (estimatedCost != null && estimatedCost < 0) return setError('El precio estimado no es válido.')
    if (actualCost != null && actualCost < 0) return setError('El precio pagado no es válido.')
    setBusy(true)
    setError(null)
    const input = { name, estimated_cost: estimatedCost, status, actual_cost: actualCost }
    try {
      if (editing) await updateItemSubarticle(editing.id, input)
      else await createItemSubarticle(itemId, input)
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
          {subarticles.map((article) => <li key={article.id}><div><strong>{article.name}</strong><span className="muted"> · {article.status === 'purchased' ? 'Comprado' : 'Pendiente'}</span></div><div className="row"><span>{article.status === 'purchased' ? formatMoney(article.actual_cost ?? 0) : formatMoney(article.estimated_cost ?? 0)}</span><button type="button" className="btn-icon" aria-label={`Editar ${article.name}`} onClick={() => { setEditing(article); setName(article.name); setEstimated(costInputValue(article.estimated_cost)); setStatus(article.status); setActual(costInputValue(article.actual_cost)) }}><IconPencil /></button><button type="button" className="btn-icon btn-icon-danger" aria-label={`Eliminar ${article.name}`} onClick={() => { if (window.confirm(`¿Eliminar “${article.name}”?`)) void deleteItemSubarticle(article.id).then(onChanged).catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudo eliminar el artículo.')) }}><IconTrash /></button></div></li>)}
        </ul>
      )}
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <h3>{editing ? 'Editar artículo' : 'Agregar artículo'}</h3>
        <div className="filters item-filters item-filters-open"><div className="field"><label htmlFor="subarticle-name">Nombre</label><input id="subarticle-name" value={name} onChange={(event) => setName(event.target.value)} required /></div><div className="field"><label htmlFor="subarticle-estimated">Precio estimado</label><input id="subarticle-estimated" type="number" min="0" step="0.01" value={estimated} onChange={(event) => setEstimated(event.target.value)} /></div><div className="field"><label htmlFor="subarticle-status">Estado</label><select id="subarticle-status" value={status} onChange={(event) => setStatus(event.target.value as 'pending' | 'purchased')}><option value="pending">Pendiente</option><option value="purchased">Comprado</option></select></div><div className="field"><label htmlFor="subarticle-actual">Precio pagado</label><input id="subarticle-actual" type="number" min="0" step="0.01" value={actual} onChange={(event) => setActual(event.target.value)} /></div></div>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="row"><button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar artículo' : 'Agregar artículo'}</button>{editing ? <button type="button" className="btn btn-ghost" onClick={reset}>Cancelar</button> : null}</div>
      </form>
    </section>
  )
}
