import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { IconPencil, IconTrash } from '@/components/icons'
import type {
  Project,
  ItemWithOptions,
  ProjectStatusOption,
  ProjectSavingsMovement,
  SavingsMode,
  SavingsMovementType,
} from '@/types/domain'
import {
  compareSavingsProjections,
  describeMonthsDelta,
  formatYearMonthLabel,
  projectSavingsGoal,
  type SavingsGoalProjection,
} from '@/utils/budget/savings-goal'
import { calculateSavingsBreakdown } from '@/utils/budget/savings'
import { useFormatMoney } from '@/utils/format'
import { costInputValue, parseCost } from '@/utils/form'
import {
  createSavingsMovement,
  deleteSavingsMovement,
  updateProjectBudget,
  updateProjectSavingsGoal,
  updateProjectSavingsMode,
  updateProjectSavingsPlan,
  updateSavingsMovement,
} from './project-api'
import {
  savingsGoalInputFromProject,
  type ProjectSavingsGoalInput,
} from './project-savings'
import { isSavingsGoalProject } from './project-kind'
import { calculateSavingsPlanPurchaseSummary } from './savings-plan-purchases'
import { SavingsPlanFields } from './savings-plan-fields'
import {
  parseSavingsPlanInput,
  savingsPlanFromProject,
  validateSavingsPlan,
} from './savings-plan-utils'
import {
  movementsToProjectionInput,
  parseGoalDraft,
  toSavingsGoalConfig,
  validateMovementInput,
  validateSavingsGoalInput,
} from './savings-goal-utils'

type DraftFields = {
  enabled: boolean
  initialBalance: string
  targetAmount: string
  minimumReserve: string
  monthlyContribution: string
  startDate: string
  accruesInterest: boolean
  interestRateAnnual: string
  interestRateType: ProjectSavingsGoalInput['interestRateType']
  interestCompoundingFrequency: ProjectSavingsGoalInput['interestCompoundingFrequency']
}

const MODE_OPTIONS: readonly {
  id: SavingsMode
  label: string
  hint: string
}[] = [
  {
    id: 'none',
    label: 'Sin plan de ahorro',
    hint: 'Solo usas el presupuesto e ítems de compras.',
  },
  {
    id: 'plan',
    label: 'Plan de ahorro',
    hint: 'Aportes mensuales en un periodo (útil para proyectar cuánto juntas y, si quieres, fijar el presupuesto).',
  },
]

function draftFromGoal(goal: ProjectSavingsGoalInput): DraftFields {
  return {
    enabled: goal.enabled,
    initialBalance: costInputValue(goal.initialBalance),
    targetAmount: costInputValue(goal.targetAmount),
    minimumReserve: costInputValue(goal.minimumReserve),
    monthlyContribution: costInputValue(goal.monthlyContribution),
    startDate: goal.startDate ?? '',
    accruesInterest: goal.accruesInterest,
    interestRateAnnual: costInputValue(goal.interestRateAnnual),
    interestRateType: goal.interestRateType,
    interestCompoundingFrequency: goal.interestCompoundingFrequency,
  }
}

function ProjectionDetails({
  title,
  eyebrow,
  projection,
  targetAmount,
  minimumReserve,
  monthlyContribution,
  formatMoney,
}: {
  title: string
  eyebrow?: string
  projection: SavingsGoalProjection | null
  targetAmount: number
  minimumReserve: number
  monthlyContribution: number
  formatMoney: (value: number) => string
}) {
  return (
    <section className="savings-projection-card" aria-label={title}>
      {eyebrow ? (
        <p className="muted savings-projection-eyebrow">{eyebrow}</p>
      ) : null}
      <h3>{title}</h3>
      {!projection ? (
        <p className="muted">
          Completa saldo inicial, objetivo, reserva, aporte mensual y fecha de
          inicio para ver la proyección.
        </p>
      ) : (
        <ul className="plain-list savings-summary">
          <li>
            <span>Meta</span>
            <strong>{formatMoney(targetAmount)}</strong>
          </li>
          <li>
            <span>Reserva</span>
            <strong>{formatMoney(minimumReserve)}</strong>
          </li>
          <li>
            <span>Necesitas acumular</span>
            <strong>{formatMoney(projection.requiredSavings)}</strong>
          </li>
          <li>
            <span>Aporte mensual</span>
            <span>{formatMoney(monthlyContribution)}</span>
          </li>
          <li>
            <span>Primer mes viable</span>
            <strong>{formatYearMonthLabel(projection.viableYearMonth)}</strong>
          </li>
          <li>
            <span>Saldo proyectado</span>
            <strong>{formatMoney(projection.projectedBalance)}</strong>
          </li>
          <li>
            <span>Después de cumplir la meta</span>
            <strong>{formatMoney(projection.remainingAfterGoal)}</strong>
          </li>
          <li>
            <span>Meses necesarios</span>
            <span>{projection.monthsNeeded}</span>
          </li>
        </ul>
      )}
    </section>
  )
}

function PlanSavingsEditor({
  project,
  movements,
  items,
  statusOptions,
  onChanged,
  onError,
  onInfo,
}: {
  project: Project
  movements: readonly ProjectSavingsMovement[]
  items: readonly ItemWithOptions[]
  statusOptions: readonly ProjectStatusOption[]
  onChanged: () => void
  onError: (message: string | null) => void
  onInfo: (message: string | null) => void
}) {
  const formatMoney = useFormatMoney()
  const plan = savingsPlanFromProject(project)
  const purchases = calculateSavingsPlanPurchaseSummary(items, statusOptions)
  const [planAmount, setPlanAmount] = useState(
    costInputValue(plan.savings_amount),
  )
  const [planAccrues, setPlanAccrues] = useState(plan.savings_accrues_interest)
  const [planRate, setPlanRate] = useState(
    costInputValue(plan.savings_interest_rate_annual),
  )
  const [planRateType, setPlanRateType] = useState(
    plan.savings_interest_rate_type,
  )
  const [planCompoundingFrequency, setPlanCompoundingFrequency] = useState(
    plan.savings_interest_compounding_frequency,
  )
  const [planStart, setPlanStart] = useState(plan.savings_start_date ?? '')
  const [planEnd, setPlanEnd] = useState(plan.savings_end_date ?? '')
  const [submitting, setSubmitting] = useState(false)

  const planMovements = movementsToProjectionInput(movements).map(
    (movement) => ({
      date: movement.date,
      amount: movement.amount,
      type: movement.type,
    }),
  )

  const planPreview = calculateSavingsBreakdown(
    parseSavingsPlanInput({
      amount: planAmount,
      accruesInterest: planAccrues,
      interestRate: planRate,
      interestRateType: planRateType,
      interestCompoundingFrequency: planCompoundingFrequency,
      startDate: planStart,
      endDate: planEnd,
    }),
    planMovements,
  )

  async function onSavePlan(event: FormEvent) {
    event.preventDefault()
    const nextPlan = parseSavingsPlanInput({
      amount: planAmount,
      accruesInterest: planAccrues,
      interestRate: planRate,
      interestRateType: planRateType,
      interestCompoundingFrequency: planCompoundingFrequency,
      startDate: planStart,
      endDate: planEnd,
    })
    const validation = validateSavingsPlan(nextPlan)
    if (validation) {
      onError(validation)
      return
    }
    setSubmitting(true)
    onError(null)
    try {
      await updateProjectSavingsPlan(project.id, nextPlan, project.savings_mode)
      onInfo('Plan de ahorro guardado.')
      onChanged()
    } catch (err) {
      console.error(err)
      onError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el plan de ahorro.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function onApplyPlanToBudget() {
    if (!planPreview) {
      onError('Completa el plan para calcular el total proyectado.')
      return
    }
    if (
      !window.confirm(
        `¿Usar ${formatMoney(planPreview.total)} como presupuesto del proyecto? Esto solo actualiza el tope de gasto; no borra el plan.`,
      )
    ) {
      return
    }
    setSubmitting(true)
    onError(null)
    try {
      await updateProjectBudget(project.id, planPreview.total)
      onInfo('Presupuesto del proyecto actualizado con el total del plan.')
      onChanged()
    } catch (err) {
      console.error(err)
      onError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el presupuesto.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="stack card" aria-labelledby="plan-purchases-heading">
        <div className="row-between">
          <div>
            <h2 id="plan-purchases-heading">Artículos planificados</h2>
            <p className="muted">
              Referencia de compras: no modifica el ahorro acumulado ni crea
              transacciones.
            </p>
          </div>
          <Link
            className="btn btn-ghost"
            to={`/projects/${project.id}?tab=items${purchases.totalCount === 0 ? '&create=1' : ''}`}
          >
            {purchases.totalCount === 0
              ? 'Añadir primer artículo'
              : 'Ver artículos'}
          </Link>
        </div>
        {purchases.totalCount === 0 ? (
          <p className="muted">Aún no has añadido artículos al plan.</p>
        ) : (
          <>
            <div
              className="metrics-grid metrics-grid-secondary"
              aria-label="Resumen de artículos"
            >
              <article className="metric-card metric-card-compact metric-card-pending">
                <p className="metric-label">Pendiente estimado</p>
                <p className="metric-value">
                  {formatMoney(purchases.pendingEstimated)}
                </p>
              </article>
              <article className="metric-card metric-card-compact metric-card-spent">
                <p className="metric-label">Total gastado</p>
                <p className="metric-value">{formatMoney(purchases.spent)}</p>
              </article>
              <article className="metric-card metric-card-compact metric-card-projected">
                <p className="metric-label">Total proyectado</p>
                <p className="metric-value">
                  {formatMoney(purchases.projected)}
                </p>
              </article>
            </div>
            <p className="muted">
              {purchases.purchasedCount} de {purchases.totalCount} artículos
              comprados.
            </p>
          </>
        )}
      </section>
      <form className="stack card" onSubmit={(event) => void onSavePlan(event)}>
        <SavingsPlanFields
          amount={planAmount}
          accruesInterest={planAccrues}
          interestRate={planRate}
          interestRateType={planRateType}
          interestCompoundingFrequency={planCompoundingFrequency}
          startDate={planStart}
          endDate={planEnd}
          movements={planMovements}
          onAmountChange={setPlanAmount}
          onAccruesInterestChange={setPlanAccrues}
          onInterestRateChange={setPlanRate}
          onInterestRateTypeChange={setPlanRateType}
          onInterestCompoundingFrequencyChange={setPlanCompoundingFrequency}
          onStartDateChange={setPlanStart}
          onEndDateChange={setPlanEnd}
        />
        <div className="row project-page-actions">
          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar plan'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={submitting || !planPreview}
            onClick={() => void onApplyPlanToBudget()}
          >
            Usar total como presupuesto
          </button>
        </div>
      </form>
    </>
  )
}

export function ProjectSavingsSection({
  project,
  movements,
  items,
  onChanged,
}: {
  project: Project
  movements: ProjectSavingsMovement[]
  items: readonly ItemWithOptions[]
  onChanged: () => void
}) {
  const formatMoney = useFormatMoney()
  const mode = project.savings_mode
  const savedGoal = savingsGoalInputFromProject(project)
  const savedDraft = draftFromGoal(savedGoal)
  const [localDraft, setLocalDraft] = useState<DraftFields | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [scenarioBaseline, setScenarioBaseline] =
    useState<ProjectSavingsGoalInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [modeBusy, setModeBusy] = useState(false)

  const [movementName, setMovementName] = useState('')
  const [movementDate, setMovementDate] = useState('')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementType, setMovementType] =
    useState<SavingsMovementType>('inflow')
  const [movementKind, setMovementKind] =
    useState<ProjectSavingsMovement['movement_kind']>('contribution')
  const [movementDescription, setMovementDescription] = useState('')
  const [editingMovementId, setEditingMovementId] = useState<string | null>(
    null,
  )
  const [movementBusy, setMovementBusy] = useState(false)

  const draft = localDraft ?? savedDraft
  const parsedDraft = parseGoalDraft({ ...draft, enabled: true })
  const movementInputs = movementsToProjectionInput(movements)

  const actualConfig = toSavingsGoalConfig({ ...savedGoal, enabled: true })
  const simulationConfig = toSavingsGoalConfig(parsedDraft)
  const baselineConfig = scenarioBaseline
    ? toSavingsGoalConfig(scenarioBaseline)
    : null

  const actualProjection =
    mode === 'goal' && actualConfig.startDate
      ? projectSavingsGoal(actualConfig, movementInputs)
      : null
  const simulationProjection =
    mode === 'goal' && parsedDraft.enabled && simulationConfig.startDate
      ? projectSavingsGoal(simulationConfig, movementInputs)
      : null
  const baselineProjection =
    baselineConfig && baselineConfig.startDate
      ? projectSavingsGoal(baselineConfig, movementInputs)
      : null

  const comparison = compareSavingsProjections(
    scenarioBaseline ? baselineProjection : actualProjection,
    simulationProjection,
  )

  function patchDraft(patch: Partial<DraftFields>) {
    setLocalDraft((current) => ({
      ...(current ?? savedDraft),
      ...patch,
      enabled: true,
    }))
    setError(null)
    setInfo(null)
    if (
      !simulating &&
      (patch.initialBalance != null ||
        patch.targetAmount != null ||
        patch.minimumReserve != null ||
        patch.monthlyContribution != null ||
        patch.startDate != null)
    ) {
      setSimulating(true)
    }
  }

  async function onSelectMode(next: SavingsMode) {
    if (next === mode) return
    if (isSavingsGoalProject(mode) || next === 'goal') {
      setError(
        'La meta de ahorro solo se elige al crear el proyecto y no se puede cambiar.',
      )
      return
    }
    if (
      mode !== 'none' &&
      next !== 'none' &&
      !window.confirm('¿Cambiar el plan de ahorro de este proyecto?')
    ) {
      return
    }
    setModeBusy(true)
    setError(null)
    setInfo(null)
    setSimulating(false)
    setLocalDraft(null)
    setScenarioBaseline(null)
    try {
      await updateProjectSavingsMode(project.id, next, mode)
      setInfo(
        next === 'none'
          ? 'Plan de ahorro desactivado.'
          : 'Modo: plan de ahorro.',
      )
      onChanged()
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar el modo de ahorro.',
      )
    } finally {
      setModeBusy(false)
    }
  }

  async function persistGoal(goal: ProjectSavingsGoalInput) {
    const validation = validateSavingsGoalInput({ ...goal, enabled: true })
    if (validation) {
      setError(validation)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await updateProjectSavingsGoal(project.id, { ...goal, enabled: true })
      setInfo('Meta de ahorro guardada.')
      setSimulating(false)
      setScenarioBaseline(null)
      setLocalDraft(null)
      onChanged()
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la meta de ahorro.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function onSaveConfig(event: FormEvent) {
    event.preventDefault()
    await persistGoal(parsedDraft)
  }

  function onStartSimulation() {
    setLocalDraft(savedDraft)
    setSimulating(true)
    setScenarioBaseline(null)
    setInfo(
      'Modo simulación: los cambios no se guardan hasta que apliques a la meta.',
    )
  }

  function onDiscardSimulation() {
    setSimulating(false)
    setScenarioBaseline(null)
    setLocalDraft(null)
    setError(null)
    setInfo('Simulación descartada.')
  }

  function onSaveScenario() {
    const validation = validateSavingsGoalInput(parsedDraft)
    if (validation) {
      setError(validation)
      return
    }
    setScenarioBaseline(parsedDraft)
    setInfo(
      'Escenario guardado en esta sesión como base de comparación. No se escribió en la base de datos.',
    )
  }

  async function onApplyToGoal() {
    await persistGoal(parsedDraft)
  }

  async function onSubmitMovement(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const validation = validateMovementInput({
      name: movementName,
      date: movementDate,
      amount: movementAmount,
      type: movementKind === 'interest' ? 'inflow' : movementType,
    })
    if (validation) {
      setError(validation)
      return
    }
    const amount = parseCost(movementAmount)
    if (amount == null) return

    setMovementBusy(true)
    try {
      if (editingMovementId) {
        await updateSavingsMovement(editingMovementId, {
          name: movementName,
          movement_date: movementDate,
          amount,
          movement_type: movementKind === 'interest' ? 'inflow' : movementType,
          movement_kind: movementKind,
          description: movementDescription.trim() || null,
        })
      } else {
        await createSavingsMovement(project.id, {
          name: movementName,
          movement_date: movementDate,
          amount,
          movement_type: movementKind === 'interest' ? 'inflow' : movementType,
          movement_kind: movementKind,
          description: movementDescription.trim() || null,
        })
      }
      setMovementName('')
      setMovementDate('')
      setMovementAmount('')
      setMovementType('inflow')
      setMovementKind('contribution')
      setMovementDescription('')
      setEditingMovementId(null)
      onChanged()
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el movimiento.',
      )
    } finally {
      setMovementBusy(false)
    }
  }

  function onEditMovement(movement: ProjectSavingsMovement) {
    setEditingMovementId(movement.id)
    setMovementName(movement.name)
    setMovementDate(movement.movement_date)
    setMovementAmount(costInputValue(movement.amount))
    setMovementType(movement.movement_type)
    setMovementKind(movement.movement_kind)
    setMovementDescription(movement.description ?? '')
  }

  async function onDeleteMovement(movementId: string) {
    if (!window.confirm('¿Eliminar este movimiento?')) return
    setMovementBusy(true)
    setError(null)
    try {
      await deleteSavingsMovement(movementId)
      if (editingMovementId === movementId) {
        setEditingMovementId(null)
        setMovementName('')
        setMovementDate('')
        setMovementAmount('')
        setMovementKind('contribution')
        setMovementDescription('')
      }
      onChanged()
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el movimiento.',
      )
    } finally {
      setMovementBusy(false)
    }
  }

  return (
    <div className="stack">
      {isSavingsGoalProject(mode) ? (
        <section className="stack card" aria-labelledby="savings-mode-heading">
          <h2 id="savings-mode-heading">Meta de ahorro</h2>
          <p className="muted">
            Este proyecto es solo de meta. El tipo se eligió al crearlo y{' '}
            <strong>no se puede cambiar</strong>.
          </p>
        </section>
      ) : (
        <section className="stack card" aria-labelledby="savings-mode-heading">
          <h2 id="savings-mode-heading">Plan de ahorro</h2>
          <p className="muted">
            Opcional y aparte del presupuesto/tope (
            {project.budget == null
              ? 'sin definir'
              : formatMoney(project.budget)}
            ). Para una meta de ahorro (objetivo + reserva), crea un proyecto de
            ese tipo.
          </p>
          <div
            className="savings-mode-options"
            role="radiogroup"
            aria-label="Plan de ahorro"
          >
            {MODE_OPTIONS.map((option) => (
              <label key={option.id} className="savings-mode-option">
                <input
                  type="radio"
                  name="savings-mode"
                  value={option.id}
                  checked={mode === option.id}
                  disabled={modeBusy}
                  onChange={() => void onSelectMode(option.id)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <span className="muted">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="alert alert-success" role="status">
          {info}
        </p>
      ) : null}

      {mode === 'plan' ? (
        <PlanSavingsEditor
          key={`${project.id}-${project.updated_at}`}
          project={project}
          movements={movements}
          items={items}
          statusOptions={project.status_options}
          onChanged={onChanged}
          onError={setError}
          onInfo={setInfo}
        />
      ) : null}

      {mode === 'goal' ? (
        <>
          <form className="stack card" onSubmit={onSaveConfig}>
            <h2>Meta de ahorro</h2>
            <p className="muted">
              Cómo y cuándo reunir dinero (objetivo + reserva). No sustituye el
              presupuesto del proyecto.
            </p>

            <div className="filters item-filters item-filters-open">
              <div className="field">
                <label htmlFor="savings-initial">Saldo inicial</label>
                <input
                  id="savings-initial"
                  type="number"
                  step="0.01"
                  value={draft.initialBalance}
                  onChange={(event) =>
                    patchDraft({ initialBalance: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="savings-target">Cantidad objetivo</label>
                <input
                  id="savings-target"
                  type="number"
                  step="0.01"
                  value={draft.targetAmount}
                  onChange={(event) =>
                    patchDraft({ targetAmount: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="savings-reserve">Reserva mínima</label>
                <input
                  id="savings-reserve"
                  type="number"
                  step="0.01"
                  value={draft.minimumReserve}
                  onChange={(event) =>
                    patchDraft({ minimumReserve: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="savings-monthly">Aporte mensual</label>
                <input
                  id="savings-monthly"
                  type="number"
                  step="0.01"
                  value={draft.monthlyContribution}
                  onChange={(event) =>
                    patchDraft({ monthlyContribution: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="savings-goal-start">Fecha de inicio</label>
                <input
                  id="savings-goal-start"
                  type="date"
                  value={draft.startDate}
                  onChange={(event) =>
                    patchDraft({ startDate: event.target.value })
                  }
                />
              </div>
              <div className="field checkbox-field">
                <input
                  id="goal-interest"
                  type="checkbox"
                  checked={draft.accruesInterest}
                  onChange={(event) =>
                    patchDraft({ accruesInterest: event.target.checked })
                  }
                />
                <label htmlFor="goal-interest">
                  Estimar rendimiento de la cuenta
                </label>
              </div>
              {draft.accruesInterest ? (
                <>
                  <div className="field">
                    <label htmlFor="goal-rate">Tasa anual (%)</label>
                    <input
                      id="goal-rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={draft.interestRateAnnual}
                      onChange={(event) =>
                        patchDraft({ interestRateAnnual: event.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="goal-rate-type">Tipo de tasa</label>
                    <select
                      id="goal-rate-type"
                      value={draft.interestRateType}
                      onChange={(event) =>
                        patchDraft({
                          interestRateType: event.target
                            .value as ProjectSavingsGoalInput['interestRateType'],
                        })
                      }
                    >
                      <option value="tea">TEA (tasa efectiva anual)</option>
                      <option value="tna">TNA (tasa nominal anual)</option>
                    </select>
                    <span className="field-hint">
                      TEA es la opción predeterminada. Para TNA selecciona la
                      capitalización.
                    </span>
                  </div>
                  {draft.interestRateType === 'tna' ? (
                    <div className="field">
                      <label htmlFor="goal-compounding">Capitalización</label>
                      <select
                        id="goal-compounding"
                        value={draft.interestCompoundingFrequency}
                        onChange={(event) =>
                          patchDraft({
                            interestCompoundingFrequency: event.target
                              .value as ProjectSavingsGoalInput['interestCompoundingFrequency'],
                          })
                        }
                      >
                        <option value="monthly">Mensual</option>
                        <option value="quarterly">Trimestral</option>
                        <option value="semiannual">Semestral</option>
                        <option value="annual">Anual</option>
                      </select>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="row project-page-actions">
              {!simulating ? (
                <>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? 'Guardando…' : 'Guardar meta'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onStartSimulation}
                  >
                    Simular
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={submitting}
                    onClick={() => void onApplyToGoal()}
                  >
                    Aplicar a la meta
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={onSaveScenario}
                  >
                    Guardar escenario
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onDiscardSimulation}
                  >
                    Descartar
                  </button>
                </>
              )}
            </div>
            {simulating ? (
              <p className="field-hint">
                <strong>Aplicar a la meta</strong> escribe en la base de datos.{' '}
                <strong>Guardar escenario</strong> solo fija la base de
                comparación en esta sesión. <strong>Descartar</strong> vuelve a
                la meta guardada.
              </p>
            ) : null}
          </form>

          <div className="savings-projection-grid">
            {simulating ? (
              <>
                <ProjectionDetails
                  title={
                    scenarioBaseline ? 'Escenario base' : 'Actual (guardado)'
                  }
                  eyebrow={scenarioBaseline ? 'Sesión' : 'Base de datos'}
                  projection={
                    scenarioBaseline ? baselineProjection : actualProjection
                  }
                  targetAmount={
                    (scenarioBaseline ?? savedGoal).targetAmount ?? 0
                  }
                  minimumReserve={
                    (scenarioBaseline ?? savedGoal).minimumReserve ?? 0
                  }
                  monthlyContribution={
                    (scenarioBaseline ?? savedGoal).monthlyContribution ?? 0
                  }
                  formatMoney={formatMoney}
                />
                <ProjectionDetails
                  title="Simulación"
                  eyebrow="Sin guardar"
                  projection={simulationProjection}
                  targetAmount={parsedDraft.targetAmount ?? 0}
                  minimumReserve={parsedDraft.minimumReserve ?? 0}
                  monthlyContribution={parsedDraft.monthlyContribution ?? 0}
                  formatMoney={formatMoney}
                />
              </>
            ) : (
              <ProjectionDetails
                title="Proyección"
                projection={actualProjection}
                targetAmount={savedGoal.targetAmount ?? 0}
                minimumReserve={savedGoal.minimumReserve ?? 0}
                monthlyContribution={savedGoal.monthlyContribution ?? 0}
                formatMoney={formatMoney}
              />
            )}
          </div>

          {simulating && comparison.monthsDelta != null ? (
            <p className="alert" role="status">
              Diferencia: {describeMonthsDelta(comparison.monthsDelta)}.
            </p>
          ) : null}
        </>
      ) : null}

      {mode === 'plan' || mode === 'goal' ? (
        <section
          className="stack card"
          aria-labelledby="savings-movements-heading"
        >
          <h2 id="savings-movements-heading">Movimientos extraordinarios</h2>
          <p className="muted">
            {mode === 'plan'
              ? 'Ingresos o retiros puntuales dentro del periodo del plan. Entran en el total proyectado.'
              : 'Aportes o retiros puntuales futuros. Se incluyen en la proyección mes a mes.'}
          </p>

          <form
            className="stack"
            onSubmit={(event) => void onSubmitMovement(event)}
          >
            <div className="filters item-filters item-filters-open">
              <div className="field">
                <label htmlFor="movement-name">Nombre</label>
                <input
                  id="movement-name"
                  value={movementName}
                  onChange={(event) => setMovementName(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="movement-date">Fecha</label>
                <input
                  id="movement-date"
                  type="date"
                  value={movementDate}
                  onChange={(event) => setMovementDate(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="movement-amount">Monto</label>
                <input
                  id="movement-amount"
                  type="number"
                  step="0.01"
                  value={movementAmount}
                  onChange={(event) => setMovementAmount(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="movement-type">Tipo</label>
                <select
                  id="movement-type"
                  value={movementType}
                  onChange={(event) =>
                    setMovementType(event.target.value as SavingsMovementType)
                  }
                >
                  <option value="inflow">Aporte extraordinario</option>
                  <option value="outflow">Retiro / gasto</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="movement-kind">Registro</label>
                <select
                  id="movement-kind"
                  value={movementKind}
                  onChange={(event) => {
                    const kind = event.target
                      .value as ProjectSavingsMovement['movement_kind']
                    setMovementKind(kind)
                    if (kind === 'interest') setMovementType('inflow')
                  }}
                >
                  <option value="contribution">Aporte o retiro</option>
                  <option value="interest">
                    Interés acreditado por el banco
                  </option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="movement-description">
                  Descripción (opcional)
                </label>
                <input
                  id="movement-description"
                  value={movementDescription}
                  onChange={(event) =>
                    setMovementDescription(event.target.value)
                  }
                />
              </div>
            </div>
            <div className="row">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={movementBusy}
              >
                {editingMovementId
                  ? movementBusy
                    ? 'Guardando…'
                    : 'Actualizar movimiento'
                  : movementBusy
                    ? 'Añadiendo…'
                    : 'Añadir movimiento'}
              </button>
              {editingMovementId ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingMovementId(null)
                    setMovementName('')
                    setMovementDate('')
                    setMovementAmount('')
                    setMovementType('inflow')
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          {movements.length === 0 ? (
            <p className="muted">Sin movimientos todavía.</p>
          ) : (
            <ul className="plain-list savings-movements-list">
              {movements.map((movement) => (
                <li key={movement.id}>
                  <div>
                    <strong>{movement.name}</strong>
                    <span className="muted">
                      {' '}
                      · {movement.movement_date} ·{' '}
                      {movement.movement_kind === 'interest'
                        ? 'Interés acreditado'
                        : movement.movement_type === 'inflow'
                          ? 'Aporte'
                          : 'Retiro'}
                    </span>
                  </div>
                  <div className="row">
                    <strong>
                      {movement.movement_type === 'outflow' ? '−' : '+'}
                      {formatMoney(movement.amount)}
                    </strong>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => onEditMovement(movement)}
                      aria-label={`Editar ${movement.name}`}
                      title="Editar"
                    >
                      <IconPencil />
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-icon-danger"
                      onClick={() => void onDeleteMovement(movement.id)}
                      aria-label={`Eliminar ${movement.name}`}
                      title="Eliminar"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
