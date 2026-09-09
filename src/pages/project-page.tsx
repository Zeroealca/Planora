import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { DashboardPanel } from '@/features/dashboard/dashboard-panel'
import { CategorySection } from '@/features/categories/category-section'
import {
  countItemsNeedingAttention,
  filterItemsByAttention,
  type AttentionFilter,
} from '@/features/items/item-attention'
import { ItemTable } from '@/features/items/item-table'
import { ItemForm } from '@/features/items/item-form'
import {
  CollapsibleSection,
  type ProjectSectionId,
} from '@/features/projects/collapsible-section'
import { ProjectForm } from '@/features/projects/project-form'
import { ProjectOptionsSection } from '@/features/projects/project-options-section'
import { ProjectSavingsSection } from '@/features/projects/project-savings-section'
import { fetchProjectBundle } from '@/features/projects/project-api'
import { useAuth } from '@/features/auth/auth-context'
import { priorityLabel, statusLabel } from '@/features/projects/project-options'
import type { Category, ItemWithOptions, Project } from '@/types/domain'
import {
  filterItems,
  toBudgetItem,
  type CategoryFilter,
  type PriorityFilter,
  type StatusFilter,
} from '@/utils/budget/calculations'
import { resolveProjectBudget } from '@/utils/budget/savings'
import { useFormatMoney } from '@/utils/format'

const DEFAULT_OPEN: Record<ProjectSectionId, boolean> = {
  ahorros: true,
  configuracion: true,
  resumen: true,
  items: true,
  categorias: true,
}

export function ProjectPage() {
  const { projectId } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const formatMoney = useFormatMoney()
  const [project, setProject] = useState<Project | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<ItemWithOptions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [creatingItem, setCreatingItem] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter | null>(
    null,
  )
  const [openSections, setOpenSections] =
    useState<Record<ProjectSectionId, boolean>>(DEFAULT_OPEN)

  const attentionFromUrl =
    searchParams.get('attention') === 'needs_attention'
      ? 'needs_attention'
      : 'All'
  const activeAttentionFilter: AttentionFilter =
    attentionFilter ?? attentionFromUrl

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

  function setSectionOpen(id: ProjectSectionId, open: boolean) {
    setOpenSections((prev) => ({ ...prev, [id]: open }))
  }

  function goToSection(id: ProjectSectionId) {
    setSectionOpen(id, true)
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

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

  const attentionContext = {
    categories,
    statusOptions: project.status_options,
    priorityOptions: project.priority_options,
  }
  const attentionCount = countItemsNeedingAttention(items, attentionContext)
  const attentionFiltered = filterItemsByAttention(
    items,
    activeAttentionFilter,
    attentionContext,
  )
  const budgetItems = attentionFiltered.map(toBudgetItem)
  const dashboardItems = filterItems(budgetItems, {
    priority: priorityFilter,
    categoryId: categoryFilter,
    status: statusFilter,
  })
  const visibleItems = attentionFiltered.filter((item) => {
    const matchesPriority = priorityFilter === 'All' || item.priority === priorityFilter
    const matchesCategory =
      categoryFilter === 'All' || item.category_id === categoryFilter
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter
    return matchesPriority && matchesCategory && matchesStatus
  })

  const budgetLabel =
    project.budget == null ? 'sin definir' : formatMoney(project.budget)

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
          {editing ? 'Cerrar' : 'Editar proyecto'}
        </button>
      </div>
      {project.description ? <p>{project.description}</p> : null}

      <nav className="project-subnav" aria-label="Secciones del proyecto">
        <button type="button" onClick={() => goToSection('ahorros')}>
          Ahorros
        </button>
        <button type="button" onClick={() => goToSection('configuracion')}>
          Estados y prioridades
        </button>
        <button type="button" onClick={() => goToSection('resumen')}>
          Resumen
        </button>
        <button type="button" onClick={() => goToSection('items')}>
          Ítems
        </button>
        <button type="button" onClick={() => goToSection('categorias')}>
          Categorías
        </button>
      </nav>

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

      <CollapsibleSection
        id="ahorros"
        title="Ahorros"
        description={`Plan de ahorro opcional (informativo). No modifica el presupuesto/tope del proyecto (${budgetLabel}).`}
        open={openSections.ahorros}
        onOpenChange={(open) => setSectionOpen('ahorros', open)}
      >
        <ProjectSavingsSection project={project} onChanged={() => void load()} />
      </CollapsibleSection>

      <CollapsibleSection
        id="configuracion"
        title="Estados y prioridades"
        description="Personaliza las listas que verás al crear ítems. El tipo de estado define cómo afecta al presupuesto."
        open={openSections.configuracion}
        onOpenChange={(open) => setSectionOpen('configuracion', open)}
      >
        <ProjectOptionsSection
          projectId={project.id}
          statusOptions={project.status_options}
          priorityOptions={project.priority_options}
          onChanged={() => void load()}
        />
      </CollapsibleSection>

      <div className="filters" role="group" aria-label="Filtros">
        <div className="field">
          <label htmlFor="filter-priority">Prioridad</label>
          <select
            id="filter-priority"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="All">Todas</option>
            {project.priority_options.map((option) => (
              <option key={option.id} value={option.id}>
                {priorityLabel(option.id, project.priority_options)}
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
          <label htmlFor="filter-status">Estado</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="All">Todos</option>
            {project.status_options.map((option) => (
              <option key={option.id} value={option.id}>
                {statusLabel(option.id, project.status_options)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-attention">Atención</label>
          <select
            id="filter-attention"
            value={activeAttentionFilter}
            onChange={(event) =>
              setAttentionFilter(event.target.value as AttentionFilter)
            }
          >
            <option value="All">Todos</option>
            <option value="needs_attention">Necesita atención</option>
            <option value="missing_category">Sin categoría</option>
            <option value="missing_budget">Sin presupuesto</option>
            <option value="purchased_without_actual">Comprado sin precio</option>
            <option value="missing_planned_price">Sin precio planeado</option>
          </select>
        </div>
      </div>

      <CollapsibleSection
        id="resumen"
        title="Resumen"
        open={openSections.resumen}
        onOpenChange={(open) => setSectionOpen('resumen', open)}
      >
        <DashboardPanel
          budget={resolveProjectBudget(project)}
          items={dashboardItems}
          categories={categories}
          statusOptions={project.status_options}
          priorityOptions={project.priority_options}
          attentionCount={attentionCount}
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="items"
        title="Ítems"
        open={openSections.items}
        onOpenChange={(open) => setSectionOpen('items', open)}
        headerActions={
          <div className="row collapsible-actions">
            <Link
              to={`/import?projectId=${project.id}`}
              className="btn btn-ghost"
            >
              Subida masiva
            </Link>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSectionOpen('items', true)
                setCreatingItem(!creatingItem)
              }}
            >
              {creatingItem ? 'Cerrar' : 'Nuevo ítem'}
            </button>
          </div>
        }
      >
        {creatingItem ? (
          <ItemForm
            projectId={project.id}
            categories={categories}
            statusOptions={project.status_options}
            priorityOptions={project.priority_options}
            onSaved={() => {
              setCreatingItem(false)
              void load()
            }}
          />
        ) : null}
        {items.length === 0 ? (
          <div className="stack">
            <p className="muted">Este proyecto no tiene ítems. Crea el primero.</p>
            <Link to={`/import?projectId=${project.id}`} className="btn btn-ghost">
              O importa varios desde CSV
            </Link>
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="muted">Ningún ítem coincide con los filtros.</p>
        ) : (
          <ItemTable
            items={visibleItems}
            projectId={project.id}
            categories={categories}
            statusOptions={project.status_options}
            priorityOptions={project.priority_options}
            attentionContext={attentionContext}
            onItemUpdated={(updated) => {
              setItems((prev) =>
                prev.map((item) => (item.id === updated.id ? updated : item)),
              )
            }}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="categorias"
        title="Categorías"
        description="Al eliminar una categoría, sus ítems quedan sin categoría (no se borran)."
        open={openSections.categorias}
        onOpenChange={(open) => setSectionOpen('categorias', open)}
      >
        <CategorySection
          projectId={project.id}
          categories={categories}
          onChanged={() => void load()}
        />
      </CollapsibleSection>
    </div>
  )
}
