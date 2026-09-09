import type {
  ImportIssue,
  IssueSeverity,
  MappedDraft,
  ResolvedCategory,
  ResolvedPriority,
  ResolvedStatus,
} from './import-types'

function worstSeverity(issues: readonly ImportIssue[]): IssueSeverity {
  if (issues.some((i) => i.severity === 'error')) return 'error'
  if (issues.some((i) => i.severity === 'warning')) return 'warning'
  return 'ok'
}

export function collectIssues(input: {
  draft: MappedDraft
  category: ResolvedCategory
  priority: ResolvedPriority
  status: ResolvedStatus
  hasDuplicate: boolean
  matchedName: string | null
}): { issues: ImportIssue[]; severity: IssueSeverity } {
  const issues: ImportIssue[] = []
  const { draft, category, priority, status, hasDuplicate, matchedName } = input

  if (draft.empty) {
    issues.push({
      code: 'empty_row',
      severity: 'error',
      message: 'Fila vacía',
    })
    return { issues, severity: 'error' }
  }

  if (draft.name.trim() === '') {
    issues.push({
      code: 'empty_name',
      severity: 'error',
      message: 'Nombre vacío',
    })
  }

  if (status.kind === 'unknown') {
    issues.push({
      code: 'unknown_status',
      severity: 'error',
      message: `Estado desconocido: ${status.raw}`,
    })
  }

  if (draft.estimatedCostInvalid) {
    issues.push({
      code: 'invalid_estimated_cost',
      severity: 'error',
      message: 'Presupuesto inválido',
    })
  }
  if (draft.plannedPriceInvalid) {
    issues.push({
      code: 'invalid_planned_price',
      severity: 'error',
      message: 'Precio planeado inválido',
    })
  }
  if (draft.actualCostInvalid) {
    issues.push({
      code: 'invalid_actual_cost',
      severity: 'error',
      message: 'Precio pagado inválido',
    })
  }
  if (draft.dateInvalid) {
    issues.push({
      code: 'invalid_date',
      severity: 'error',
      message: 'Fecha inválida',
    })
  }

  const behavior =
    status.kind === 'ok' || status.kind === 'default' ? status.behavior : null
  if (behavior === 'purchased' && draft.actualCost == null && !draft.actualCostInvalid) {
    issues.push({
      code: 'purchased_without_actual',
      severity: 'error',
      message: 'Comprado sin precio pagado',
    })
  }

  if (category.kind === 'create') {
    issues.push({
      code: 'unknown_category',
      severity: 'warning',
      message: `Se creará categoría: ${category.name}`,
    })
  }

  if (priority.kind === 'create') {
    issues.push({
      code: 'unknown_priority',
      severity: 'warning',
      message: `Se añadirá prioridad: ${priority.label}`,
    })
  }

  if (hasDuplicate) {
    issues.push({
      code: 'possible_duplicate',
      severity: 'warning',
      message: `Posible duplicado: ${matchedName ?? draft.name}`,
    })
  }

  // Pending without estimated/planned cost is allowed (null costs).

  return { issues, severity: worstSeverity(issues) }
}

export function problemsLabel(issues: readonly ImportIssue[]): string {
  if (issues.length === 0) return 'OK'
  return issues.map((i) => i.message).join('; ')
}
