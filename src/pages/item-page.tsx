import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { IconBack } from '@/components/icons'
import { ItemForm } from '@/features/items/item-form'
import { deleteItem } from '@/features/items/item-api'
import {
  ATTENTION_ISSUE_LABELS,
  collectItemAttentionIssues,
} from '@/features/items/item-attention'
import {
  formatItemDate,
  getItemCompletionDate,
  getItemCostSummary,
  getItemPurchaseLink,
  getItemStore,
  getSelectedOption,
  selectedOptionLabel,
} from '@/features/items/item-summary'
import { OptionList } from '@/features/item-options/option-list'
import { fetchProjectBundle } from '@/features/projects/project-api'
import { useAuth } from '@/features/auth/auth-context'
import { priorityLabel, statusLabel } from '@/features/projects/project-options'
import type { Category, ItemWithOptions, Project } from '@/types/domain'
import { useFormatMoney } from '@/utils/format'

function moneyOrDash(
  value: number | null,
  formatMoney: (value: number) => string,
): string {
  return value == null ? '—' : formatMoney(value)
}

export function ItemPage() {
  const { projectId, itemId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const formatMoney = useFormatMoney()
  const [project, setProject] = useState<Project | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [item, setItem] = useState<ItemWithOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId || !itemId) return
    setError(null)
    setLoading(true)
    try {
      const bundle = await fetchProjectBundle(projectId)
      setProject(bundle.project)
      setCategories(bundle.categories)
      setItem(bundle.items.find((entry) => entry.id === itemId) ?? null)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo cargar el ítem.')
    } finally {
      setLoading(false)
    }
  }, [projectId, itemId])

  useEffect(() => {
    if (!projectId || !itemId) return
    let cancelled = false
    void fetchProjectBundle(projectId).then(
      (bundle) => {
        if (cancelled) return
        setProject(bundle.project)
        setCategories(bundle.categories)
        setItem(bundle.items.find((entry) => entry.id === itemId) ?? null)
        setLoading(false)
      },
      (err: unknown) => {
        if (cancelled) return
        console.error(err)
        setError(err instanceof Error ? err.message : 'No se pudo cargar el ítem.')
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [projectId, itemId])

  async function onDelete() {
    if (!item || !projectId) return
    if (!window.confirm(`¿Eliminar “${item.name}” y sus opciones?`)) return
    try {
      await deleteItem(item.id)
      void navigate(`/projects/${projectId}`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  if (!user || !projectId || !itemId) return null
  if (loading) return <p className="page-status">Cargando ítem…</p>
  if (error) {
    return (
      <div className="page">
        <p className="field-error" role="alert">
          {error}
        </p>
        <button type="button" className="btn" onClick={() => void load()}>
          Reintentar
        </button>
      </div>
    )
  }
  if (!project || !item) {
    return (
      <div className="page">
        <p>Ítem no encontrado.</p>
        <Link
          to={projectId ? `/projects/${projectId}` : '/projects'}
          className="back-link"
        >
          <IconBack />
          Volver
        </Link>
      </div>
    )
  }

  const categoryName =
    categories.find((category) => category.id === item.category_id)?.name ?? 'Sin categoría'
  const costs = getItemCostSummary(item, project.status_options)
  const selected = getSelectedOption(item)
  const store = getItemStore(item)
  const purchaseLink = getItemPurchaseLink(item)
  const completion = getItemCompletionDate(item, project.status_options)
  const attentionIssues = collectItemAttentionIssues(item, {
    categories,
    statusOptions: project.status_options,
    priorityOptions: project.priority_options,
  })
  const itemOnlyLink =
    item.purchase_url &&
    purchaseLink?.source === 'option' &&
    item.purchase_url.trim() !== '' &&
    item.purchase_url !== purchaseLink.href
      ? item.purchase_url
      : null

  return (
    <div className="page">
      <p>
        <Link to={`/projects/${project.id}`} className="back-link">
          <IconBack />
          {project.name}
        </Link>
      </p>
      <h1>{item.name}</h1>

      {attentionIssues.length > 0 ? (
        <div className="attention-banner" role="status">
          <p>Este ítem necesita atención (no bloquea el guardado):</p>
          <ul className="attention-list">
            {attentionIssues.map((issue) => (
              <li key={issue}>{ATTENTION_ISSUE_LABELS[issue]}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="item-detail-facts">
        <div>
          <dt>Estado</dt>
          <dd>{statusLabel(item.status, project.status_options)}</dd>
        </div>
        <div>
          <dt>Prioridad</dt>
          <dd>{priorityLabel(item.priority, project.priority_options)}</dd>
        </div>
        <div>
          <dt>Categoría</dt>
          <dd>{categoryName}</dd>
        </div>
        <div>
          <dt>Cantidad</dt>
          <dd>{costs.quantity}</dd>
        </div>
        <div>
          <dt>Tope total presupuestado</dt>
          <dd>{moneyOrDash(costs.budget, formatMoney)}</dd>
        </div>
        <div>
          <dt>Total proyectado</dt>
          <dd>{formatMoney(costs.planned)}</dd>
        </div>
        <div>
          <dt>Total pagado</dt>
          <dd>
            {costs.contributesToBudget
              ? moneyOrDash(costs.paid, formatMoney)
              : 'No afecta al presupuesto'}
          </dd>
        </div>
        <div>
          <dt>Opción seleccionada</dt>
          <dd>{selected ? selectedOptionLabel(selected) : 'Ninguna'}</dd>
        </div>
        {store ? (
          <div>
            <dt>Tienda</dt>
            <dd>{store}</dd>
          </div>
        ) : null}
        {purchaseLink ? (
          <div>
            <dt>{purchaseLink.source === 'option' ? 'Enlace de compra' : 'Enlace del ítem'}</dt>
            <dd>
              <a href={purchaseLink.href} target="_blank" rel="noopener noreferrer">
                Abrir enlace
              </a>
            </dd>
          </div>
        ) : null}
        {itemOnlyLink ? (
          <div>
            <dt>Enlace de referencia</dt>
            <dd>
              <a href={itemOnlyLink} target="_blank" rel="noopener noreferrer">
                Abrir enlace del ítem
              </a>
            </dd>
          </div>
        ) : null}
        {completion ? (
          <div>
            <dt>{completion.label}</dt>
            <dd>{formatItemDate(completion.iso)}</dd>
          </div>
        ) : null}
      </dl>

      {item.description ? <p>{item.description}</p> : null}
      {item.notes ? (
        <p className="muted">
          <strong>Notas:</strong> {item.notes}
        </p>
      ) : null}

      <ItemForm
        projectId={project.id}
        categories={categories}
        statusOptions={project.status_options}
        priorityOptions={project.priority_options}
        item={item}
        onSaved={() => void load()}
      />
      <button type="button" className="btn btn-danger" onClick={() => void onDelete()}>
        Eliminar ítem
      </button>
      <OptionList
        options={item.options}
        itemId={item.id}
        projectId={project.id}
        userId={user.id}
        onChanged={() => void load()}
      />
    </div>
  )
}
