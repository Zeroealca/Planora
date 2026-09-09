import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { IconBack } from '@/components/icons'
import { DashboardPanel } from '@/features/dashboard/dashboard-panel'
import { SavingsGoalDashboardPanel } from '@/features/dashboard/savings-goal-dashboard-panel'
import { CategorySection } from '@/features/categories/category-section'
import {
  countItemsNeedingAttention,
  filterItemsByAttention,
  type AttentionFilter,
} from '@/features/items/item-attention'
import { ItemTable } from '@/features/items/item-table'
import { ItemForm } from '@/features/items/item-form'
import {
  ITEM_SORT_OPTIONS,
  sortProjectItems,
  type ItemSortKey,
} from '@/features/items/item-sort'
import {
  ProjectTabList,
  ProjectTabPanel,
} from '@/features/projects/project-tabs'
import {
  parseProjectTab,
  type ProjectTabId,
} from '@/features/projects/project-tab-ids'
import {
  isSavingsGoalProject,
  isTabAllowedForMode,
} from '@/features/projects/project-kind'
import { ProjectForm } from '@/features/projects/project-form'
import { ProjectDuplicatePanel } from '@/features/projects/project-duplicate-panel'
import { ProjectOptionsSection } from '@/features/projects/project-options-section'
import { ProjectSavingsSection } from '@/features/projects/project-savings-section'
import { fetchProjectBundle } from '@/features/projects/project-api'
import { useAuth } from '@/features/auth/auth-context'
import { priorityLabel, statusLabel } from '@/features/projects/project-options'
import {
  savingsGoalConfigFromProject,
} from '@/features/projects/project-savings'
import { movementsToProjectionInput } from '@/features/projects/savings-goal-utils'
import type { Category, ItemWithOptions, Project, ProjectSavingsMovement } from '@/types/domain'
import {
  toBudgetItem,
  type CategoryFilter,
  type PriorityFilter,
  type StatusFilter,
} from '@/utils/budget/calculations'
import { fuzzyMatch } from '@/utils/fuzzy'
import { resolveProjectBudget } from '@/utils/budget/savings'
import { useFormatMoney } from '@/utils/format'

function resolveInitialTab(
  tabParam: string | null,
  attentionParam: string | null,
): ProjectTabId {
  const fromTab = parseProjectTab(tabParam)
  if (fromTab) return fromTab
  if (attentionParam === 'needs_attention') return 'items'
  return 'resumen'
}

export function ProjectPage() {
  const { projectId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const formatMoney = useFormatMoney()
  const [project, setProject] = useState<Project | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<ItemWithOptions[]>([])
  const [savingsMovements, setSavingsMovements] = useState<ProjectSavingsMovement[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [creatingItem, setCreatingItem] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [productQuery, setProductQuery] = useState('')
  const [itemSort, setItemSort] = useState<ItemSortKey>('name')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter | null>(
    null,
  )

  const attentionFromUrl =
    searchParams.get('attention') === 'needs_attention'
      ? 'needs_attention'
      : 'All'
  const activeAttentionFilter: AttentionFilter =
    attentionFilter ?? attentionFromUrl
  const requestedTab = resolveInitialTab(
    searchParams.get('tab'),
    searchParams.get('attention'),
  )
  const activeTab =
    project && !isTabAllowedForMode(requestedTab, project.savings_mode)
      ? 'resumen'
      : requestedTab
  const isGoalProject = project ? isSavingsGoalProject(project.savings_mode) : false

  function setActiveTab(tab: ProjectTabId) {
    if (project && !isTabAllowedForMode(tab, project.savings_mode)) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', tab)
        return next
      },
      { replace: true },
    )
  }

  const load = useCallback(async () => {
    if (!projectId) return
    setError(null)
    setLoading(true)
    try {
      const bundle = await fetchProjectBundle(projectId)
      setProject(bundle.project)
      setCategories(bundle.categories)
      setItems(bundle.items)
      setSavingsMovements(bundle.savingsMovements)
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
        setSavingsMovements(bundle.savingsMovements)
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
  const visibleItems = sortProjectItems(
    attentionFiltered.filter((item) => {
      const matchesPriority = priorityFilter === 'All' || item.priority === priorityFilter
      const matchesCategory =
        categoryFilter === 'All' || item.category_id === categoryFilter
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter
      const matchesSearch = fuzzyMatch(productQuery, item.name)
      return matchesPriority && matchesCategory && matchesStatus && matchesSearch
    }),
    itemSort,
    project.priority_options,
    project.status_options,
    attentionContext,
  )
  const dashboardItems = items.map(toBudgetItem)
  const hasListFilters =
    priorityFilter !== 'All' ||
    categoryFilter !== 'All' ||
    statusFilter !== 'All' ||
    productQuery.trim() !== '' ||
    activeAttentionFilter !== 'All'

  const budgetLabel =
    project.budget == null ? 'sin definir' : formatMoney(project.budget)

  return (
    <div className="page">
      <p>
        <Link to="/projects" className="back-link">
          <IconBack />
          Proyectos
        </Link>
      </p>
      <div className="row-between">
        <h1>
          {project.icon ? `${project.icon} ` : ''}
          {project.name}
        </h1>
        <div className="row project-page-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setDuplicating(!duplicating)
              if (!duplicating) setEditing(false)
            }}
          >
            {duplicating ? 'Cerrar' : 'Duplicar'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setEditing(!editing)
              if (!editing) setDuplicating(false)
            }}
          >
            {editing ? 'Cerrar' : 'Editar'}
          </button>
        </div>
      </div>
      {project.description ? <p>{project.description}</p> : null}

      {duplicating ? (
        <ProjectDuplicatePanel
          projectId={project.id}
          projectName={project.name}
          userId={user.id}
          isGoalProject={isGoalProject}
          onDuplicated={(newId) => {
            setDuplicating(false)
            void navigate(`/projects/${newId}`)
          }}
          onCancel={() => setDuplicating(false)}
        />
      ) : null}

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

      <ProjectTabList
        activeTab={activeTab}
        onChange={setActiveTab}
        savingsMode={project.savings_mode}
      />

      <ProjectTabPanel id="resumen" activeTab={activeTab}>
        {isGoalProject ? (
          <SavingsGoalDashboardPanel
            config={savingsGoalConfigFromProject(project)}
            movements={movementsToProjectionInput(savingsMovements)}
          />
        ) : (
          <DashboardPanel
            budget={resolveProjectBudget(project)}
            items={dashboardItems}
            categories={categories}
            statusOptions={project.status_options}
            priorityOptions={project.priority_options}
            attentionCount={attentionCount}
          />
        )}
      </ProjectTabPanel>

      {!isGoalProject ? (
        <>
      <ProjectTabPanel
        id="items"
        activeTab={activeTab}
        toolbar={
          <div className="row project-tab-actions">
            <Link to={`/import?projectId=${project.id}`} className="btn btn-ghost">
              Subida masiva
            </Link>
            <button
              type="button"
              className="btn"
              onClick={() => setCreatingItem(!creatingItem)}
            >
              {creatingItem ? 'Cerrar' : 'Nuevo ítem'}
            </button>
          </div>
        }
      >
        <div className="item-filters-bar" role="search" aria-label="Buscar y filtrar ítems">
          <div className="field filter-search">
            <label htmlFor="filter-product">Buscar producto</label>
            <input
              id="filter-product"
              type="search"
              value={productQuery}
              placeholder="Nombre del producto…"
              autoComplete="off"
              onChange={(event) => setProductQuery(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost filters-toggle"
            aria-expanded={filtersOpen}
            aria-controls="item-filters-panel"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            {hasListFilters ? <span className="filters-collapse-badge">Activos</span> : null}
          </button>
          <div
            id="item-filters-panel"
            className={`filters item-filters${filtersOpen ? ' item-filters-open' : ''}`}
          >
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
                <option value="missing_planned_price">Sin presupuesto</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="filter-sort">Ordenar por</label>
              <select
                id="filter-sort"
                value={itemSort}
                onChange={(event) => setItemSort(event.target.value as ItemSortKey)}
              >
                {ITEM_SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

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
          <div className="stack empty-state">
            <p>Este proyecto aún no tiene ítems.</p>
            <p className="muted">Crea el primero o importa varios desde un CSV.</p>
            <div className="row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreatingItem(true)}
              >
                Nuevo ítem
              </button>
              <Link to={`/import?projectId=${project.id}`} className="btn btn-ghost">
                Importar CSV
              </Link>
            </div>
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="muted">
            {hasListFilters
              ? 'Ningún ítem coincide con la búsqueda o los filtros.'
              : 'Ningún ítem para mostrar.'}
          </p>
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
      </ProjectTabPanel>

      <ProjectTabPanel
        id="categorias"
        activeTab={activeTab}
        description="Al eliminar una categoría, sus ítems quedan sin categoría (no se borran)."
      >
        <CategorySection
          projectId={project.id}
          categories={categories}
          onChanged={() => void load()}
        />
      </ProjectTabPanel>

      <ProjectTabPanel
        id="configuracion"
        activeTab={activeTab}
        description="Personaliza las listas que verás al crear ítems. El tipo de estado define cómo afecta al presupuesto."
      >
        <ProjectOptionsSection
          projectId={project.id}
          statusOptions={project.status_options}
          priorityOptions={project.priority_options}
          onChanged={() => void load()}
        />
      </ProjectTabPanel>
        </>
      ) : null}

      <ProjectTabPanel
        id="ahorros"
        activeTab={activeTab}
        description={
          isGoalProject
            ? 'Configura saldo, objetivo, reserva, aportes y movimientos. El tipo meta es fijo.'
            : `Plan de ahorro opcional (aportes en un periodo). Independiente del presupuesto/tope (${budgetLabel}).`
        }
      >
        <ProjectSavingsSection
          project={project}
          movements={savingsMovements}
          onChanged={() => void load()}
        />
      </ProjectTabPanel>
    </div>
  )
}
