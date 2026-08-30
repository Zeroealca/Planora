import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DashboardPanel } from '@/features/dashboard/dashboard-panel'
import { CategorySection } from '@/features/categories/category-section'
import { ItemCard } from '@/features/items/item-card'
import { ItemForm } from '@/features/items/item-form'
import { ProjectForm } from '@/features/projects/project-form'
import { fetchProjectBundle } from '@/features/projects/project-api'
import { useAuth } from '@/features/auth/auth-context'
import { priorityLabel } from '@/features/projects/priority-labels'
import {
  ITEM_PRIORITIES,
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  type Category,
  type ItemStatus,
  type ItemWithOptions,
  type Project,
} from '@/types/domain'
import {
  filterItems,
  type CategoryFilter,
  type PriorityFilter,
} from '@/utils/budget/calculations'

export function ProjectPage() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<ItemWithOptions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [creatingItem, setCreatingItem] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'All'>('All')

  const load = useCallback(async () => {
    if (!projectId) return
    setError(null)
    setLoading(true)
    try {
      const bundle = await fetchProjectBundle(projectId)
      setProject(bundle.project)
      setCategories(bundle.categories)
      setItems(bundle.items)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo cargar el proyecto.')
      setProject(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    void fetchProjectBundle(projectId).then(
      (bundle) => {
        if (cancelled) return
        setProject(bundle.project)
        setCategories(bundle.categories)
        setItems(bundle.items)
        setLoading(false)
      },
      (err: unknown) => {
        if (cancelled) return
        console.error(err)
        setError(err instanceof Error ? err.message : 'No se pudo cargar el proyecto.')
        setProject(null)
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (!user || !projectId) return null
  if (loading) return <p className="page-status">Cargando proyecto…</p>
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
  if (!project) return <p className="page-status">Proyecto no encontrado.</p>

  const dashboardItems = filterItems(items, {
    priority: priorityFilter,
    categoryId: categoryFilter,
  })
  const visibleItems = items.filter((item) => {
    const matchesPriority = priorityFilter === 'All' || item.priority === priorityFilter
    const matchesCategory =
      categoryFilter === 'All' || item.category_id === categoryFilter
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter
    return matchesPriority && matchesCategory && matchesStatus
  })

  return (
    <div className="page">
      <p>
        <Link to="/projects">← Proyectos</Link>
      </p>
      <div className="row-between">
        <h1>
          {project.icon ? `${project.icon} ` : ''}
          {project.name}
        </h1>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(!editing)}>
          {editing ? 'Cerrar' : 'Editar'}
        </button>
      </div>
      {project.description ? <p>{project.description}</p> : null}

      {editing ? (
        <ProjectForm
          userId={user.id}
          project={project}
          onSaved={() => {
            setEditing(false)
            void load()
          }}
          onDeleted={() => {
            void navigate('/projects')
          }}
        />
      ) : null}

      <div className="filters" role="group" aria-label="Filtros">
        <div className="field">
          <label htmlFor="filter-priority">Prioridad</label>
          <select
            id="filter-priority"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
          >
            <option value="All">Todas</option>
            {ITEM_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabel(priority, project.label_preset)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-category">Categoría</label>
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="All">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-status">Estado (lista)</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ItemStatus | 'All')}
          >
            <option value="All">Todos</option>
            {ITEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ITEM_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DashboardPanel
        budget={project.budget}
        items={dashboardItems}
        categories={categories}
        preset={project.label_preset}
      />

      <section className="stack" aria-labelledby="items-heading">
        <div className="row-between">
          <h2 id="items-heading">Ítems</h2>
          <button type="button" className="btn" onClick={() => setCreatingItem(!creatingItem)}>
            {creatingItem ? 'Cerrar' : 'Nuevo ítem'}
          </button>
        </div>
        {creatingItem ? (
          <ItemForm
            projectId={project.id}
            categories={categories}
            preset={project.label_preset}
            onSaved={() => {
              setCreatingItem(false)
              void load()
            }}
          />
        ) : null}
        {items.length === 0 ? (
          <p className="muted">Este proyecto no tiene ítems. Crea el primero.</p>
        ) : visibleItems.length === 0 ? (
          <p className="muted">Ningún ítem coincide con los filtros.</p>
        ) : (
          <ul className="card-list">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <ItemCard
                  item={item}
                  projectId={project.id}
                  categoryName={
                    categories.find((category) => category.id === item.category_id)?.name ??
                    'Sin categoría'
                  }
                  preset={project.label_preset}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <CategorySection
        projectId={project.id}
        categories={categories}
        onChanged={() => void load()}
      />
    </div>
  )
}
