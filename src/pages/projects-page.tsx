import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { IconClose } from '@/components/icons'
import { fetchProjects, type ProjectListEntry } from '@/features/projects/project-api'
import { ProjectForm } from '@/features/projects/project-form'
import { isSavingsGoalProject } from '@/features/projects/project-kind'
import { savingsGoalConfigFromProject } from '@/features/projects/project-savings'
import { useAuth } from '@/features/auth/auth-context'
import {
  calculateCompletionPercentage,
  calculatePlannedBudget,
} from '@/utils/budget/calculations'
import { resolveProjectBudget } from '@/utils/budget/savings'
import {
  formatYearMonthLabel,
  projectSavingsGoal,
} from '@/utils/budget/savings-goal'
import { formatPercent, useFormatMoney } from '@/utils/format'
import { useModalAccessibility } from '@/hooks/use-modal-accessibility'

export function ProjectsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const formatMoney = useFormatMoney()
  const [projects, setProjects] = useState<ProjectListEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const createOpen = creating || params.get('create') === '1'
  const createDialogRef = useRef<HTMLElement>(null)

  function closeCreation() {
    setCreating(false)
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('create')
      return next
    }, { replace: true })
  }

  useModalAccessibility(createOpen, createDialogRef, closeCreation)

  async function load() {
    setError(null)
    try {
      setProjects(await fetchProjects())
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los proyectos.')
      setProjects([])
    }
  }

  useEffect(() => {
    let cancelled = false
    void fetchProjects().then(
      (data) => {
        if (cancelled) return
        setProjects(data)
        setError(null)
      },
      (err: unknown) => {
        if (cancelled) return
        console.error(err)
        setError(
          err instanceof Error ? err.message : 'No se pudieron cargar los proyectos.',
        )
        setProjects([])
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (!user) return null

  if (projects === null && !error) {
    return <p className="page-status">Cargando proyectos…</p>
  }

  return (
    <div className="page">
      <header className="page-header row-between">
        <div className="stack">
          <h1>Proyectos</h1>
          <p className="muted">Compras con presupuesto o metas de ahorro.</p>
        </div>
      </header>
      {error ? (
        <div className="stack">
          <p className="field-error" role="alert">
            {error}
          </p>
          <button type="button" className="btn" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {projects && projects.length === 0 && !createOpen ? (
        <p className="muted">Todavía no tienes proyectos. Crea el primero para empezar.</p>
      ) : null}

      {projects && projects.length > 0 ? (
        <ul className="card-list">
          {projects.map((project) => {
            const isGoal = isSavingsGoalProject(project.savings_mode)
            if (isGoal) {
              const config = savingsGoalConfigFromProject(project)
              const projection =
                config.startDate ? projectSavingsGoal(config, []) : null
              return (
                <li key={project.id}>
                  <Link to={`/projects/${project.id}`} className="card card-link">
                    <h2>
                      {project.icon ? `${project.icon} ` : ''}
                      {project.name}
                    </h2>
                    <p className="muted">
                      Meta de ahorro
                      {' · '}
                      Objetivo:{' '}
                      {config.targetAmount > 0
                        ? formatMoney(config.targetAmount)
                        : 'Sin definir'}
                      {' · '}
                      Viable:{' '}
                      {projection
                        ? formatYearMonthLabel(projection.viableYearMonth)
                        : '—'}
                    </p>
                  </Link>
                </li>
              )
            }

            const budget = resolveProjectBudget(project)
            return (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`} className="card card-link">
                  <h2>
                    {project.icon ? `${project.icon} ` : ''}
                    {project.name}
                  </h2>
                  <p className="muted">
                    Presupuesto:{' '}
                    {budget == null ? 'Sin definir' : formatMoney(budget)}
                    {' · '}
                    Progreso:{' '}
                    {formatPercent(
                      calculateCompletionPercentage(
                        project.items,
                        project.status_options,
                      ),
                    )}
                    {' · '}
                    Proyectado:{' '}
                    {formatMoney(
                      calculatePlannedBudget(project.items, project.status_options),
                    )}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}

      {createOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreation()
          }}
        >
          <section
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            ref={createDialogRef}
            tabIndex={-1}
          >
            <div className="modal-head">
              <h2 id="new-project-title">Nuevo proyecto</h2>
              <button type="button" className="btn-icon" onClick={closeCreation} aria-label="Cerrar">
                <IconClose />
              </button>
            </div>
            <ProjectForm
              userId={user.id}
              onSaved={(id) => {
                closeCreation()
                void navigate(`/projects/${id}`)
              }}
            />
          </section>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => { setCreating(true); setParams({ create: '1' }) }}>
          Crear proyecto
        </button>
      )}
    </div>
  )
}
