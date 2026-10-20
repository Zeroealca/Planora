import { Link } from 'react-router'
import { ATTENTION_ISSUE_LABELS } from '@/features/items/item-attention'
import { priorityLabel, type ProjectPriorityOption } from './project-options'
import {
  countDecisionsByState,
  getNextDecisions,
  type DecisionState,
} from './next-decisions'
import type { AttentionContext } from '@/features/items/item-attention'
import type { ItemWithOptions } from '@/types/domain'
import { useFormatMoney } from '@/utils/format'

const STATE_COPY: Record<DecisionState, { label: string; action: string }> = {
  ready: { label: 'Listo para revisar', action: 'Revisar ítem' },
  needs_information: { label: 'Requiere información', action: 'Completar información' },
  needs_resolution: { label: 'Requiere resolver una incidencia', action: 'Resolver incidencia' },
}

export function NextDecisionsPanel({
  projectId,
  items,
  attentionContext,
  priorityOptions,
}: {
  projectId: string
  items: readonly ItemWithOptions[]
  attentionContext: AttentionContext
  priorityOptions: readonly ProjectPriorityOption[]
}) {
  const formatMoney = useFormatMoney()
  const decisions = getNextDecisions(items, attentionContext, priorityOptions)
  const counts = countDecisionsByState(decisions)

  return (
    <section className="next-decisions dashboard-section" aria-labelledby="next-decisions-title">
      <div className="next-decisions-heading">
        <div>
          <h2 id="next-decisions-title">Próximas decisiones</h2>
          <p className="muted">Ordenadas por prioridad; no indican disponibilidad de dinero.</p>
        </div>
        {decisions.length > 0 ? (
          <Link to={`/projects/${projectId}?tab=items&sort=priority`}>
            Ver ítems pendientes
          </Link>
        ) : null}
      </div>

      {decisions.length === 0 ? (
        <div className="next-decisions-empty">
          <p>No hay compras pendientes por revisar.</p>
          <p className="muted">Los ítems comprados o que ya tienes no aparecen aquí.</p>
          <Link to={`/projects/${projectId}?tab=items&create=1`} className="btn btn-primary">
            Crear primer ítem
          </Link>
        </div>
      ) : (
        <>
          <p className="next-decisions-summary" aria-label="Resumen de próximas decisiones">
            {counts.ready} listas · {counts.needs_information} por completar ·{' '}
            {counts.needs_resolution} con incidencia
          </p>
          <ul className="next-decisions-list">
            {decisions.map((decision) => {
              const copy = STATE_COPY[decision.state]
              const detailPath = `/projects/${projectId}/items/${decision.item.id}?tab=items&sort=priority`
              return (
                <li key={decision.item.id} className="next-decision">
                  <div className="next-decision-main">
                    <div>
                      <h3>{decision.item.name}</h3>
                      <p className="muted">
                        {priorityLabel(decision.item.priority, priorityOptions)} ·{' '}
                        {decision.plannedCost == null
                          ? 'Coste planeado pendiente'
                          : `Planeado: ${formatMoney(decision.plannedCost)}`}
                      </p>
                    </div>
                    <span className={`next-decision-state next-decision-state-${decision.state}`}>
                      {copy.label}
                    </span>
                  </div>
                  {decision.issues.length > 0 ? (
                    <p className="next-decision-issues">
                      {decision.issues.map((issue) => ATTENTION_ISSUE_LABELS[issue]).join(' · ')}
                    </p>
                  ) : null}
                  <Link to={detailPath} className="next-decision-action">
                    {copy.action}
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
