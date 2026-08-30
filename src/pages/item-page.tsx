import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ItemForm } from '@/features/items/item-form'
import { deleteItem } from '@/features/items/item-api'
import { OptionList } from '@/features/item-options/option-list'
import { fetchProjectBundle } from '@/features/projects/project-api'
import { useAuth } from '@/features/auth/auth-context'
import { priorityLabel, statusLabel } from '@/features/projects/project-options'
import type { Category, ItemWithOptions, Project } from '@/types/domain'

export function ItemPage() {
  const { projectId, itemId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
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
        <Link to={projectId ? `/projects/${projectId}` : '/projects'}>Volver</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <p>
        <Link to={`/projects/${project.id}`}>← {project.name}</Link>
      </p>
      <h1>{item.name}</h1>
      <p className="muted">
        {statusLabel(item.status, project.status_options)} ·{' '}
        {priorityLabel(item.priority, project.priority_options)}
      </p>
      {item.description ? <p>{item.description}</p> : null}
      {item.purchase_url ? (
        <p>
          <a href={item.purchase_url} target="_blank" rel="noopener noreferrer">
            Abrir enlace de compra
          </a>
        </p>
      ) : null}
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
