import type { ItemInput } from '@/features/items/item-api'
import type { OptionInput } from '@/features/item-options/option-api'
import type { ProjectPriorityOption } from '@/features/projects/project-options'
import type { Category, ItemWithOptions } from '@/types/domain'
import { nextCategoryIdForUpdate } from './duplicate-match'
import { normalizeItemName } from './normalize-name'
import { canConfirmImport, computeImportSummary } from './import-summary'
import type {
  DraftOption,
  ImportCommitSummary,
  ImportDestination,
  PreviewRow,
} from './import-types'

export type PlannedCategoryCreate = {
  key: string
  name: string
  displayOrder: number
}

export type PlannedOptionCreate = OptionInput & { selectAfterCreate: true }

export type PlannedItemCreate = {
  rowId: string
  name: string
  categoryRef: { type: 'id'; id: string } | { type: 'key'; key: string } | { type: 'none' }
  status: string
  priority: string
  quantity: number
  estimated_cost: number | null
  actual_cost: number | null
  purchase_url: string | null
  notes: string | null
  option: PlannedOptionCreate | null
}

export type PlannedItemUpdate = {
  rowId: string
  itemId: string
  previous: ItemInput
  previousCompletedAt: string | null
  next: ItemInput
  /** When set, resolve category_id from created categories after insert. */
  categoryCreateKey: string | null
  option: PlannedOptionCreate | null
}

/** Fully validated model of writes — built before any mutation. */
export type ImportCommitPlan = {
  destination: ImportDestination
  priorityOptionsBefore: ProjectPriorityOption[]
  priorityOptionsAfter: ProjectPriorityOption[]
  categoriesToCreate: PlannedCategoryCreate[]
  itemCreates: PlannedItemCreate[]
  itemUpdates: PlannedItemUpdate[]
  summary: ImportCommitSummary
}

export class ImportPlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportPlanError'
  }
}

function isRowActive(row: PreviewRow): boolean {
  if (!row.selected || row.severity === 'error') return false
  if (row.duplicateAction === 'omit') return false
  return true
}

function statusIdOf(row: PreviewRow): string {
  if (row.status.kind === 'ok' || row.status.kind === 'default') return row.status.id
  throw new ImportPlanError(
    `Fila ${row.draft.rowIndex}: estado no resuelto antes de importar.`,
  )
}

function toOptionPlan(option: DraftOption): PlannedOptionCreate {
  return {
    name: option.name,
    brand: null,
    model: null,
    price: option.price,
    store: option.store,
    product_url: option.product_url,
    description: null,
    specifications: null,
    notes: null,
    selectAfterCreate: true,
  }
}

function existingToInput(item: ItemWithOptions): ItemInput {
  return {
    name: item.name,
    description: item.description,
    category_id: item.category_id,
    status: item.status,
    priority: item.priority,
    quantity: item.quantity,
    estimated_cost: item.estimated_cost,
    actual_cost: item.actual_cost,
    purchase_url: item.purchase_url,
    notes: item.notes,
  }
}

/**
 * Builds a validated commit plan. Throws ImportPlanError if the selection
 * cannot be imported safely. Does not write to the database.
 */
export function buildCommitPlan(input: {
  destination: ImportDestination
  rows: readonly PreviewRow[]
  priorityOptions: readonly ProjectPriorityOption[]
  categories: readonly Category[]
  items: readonly ItemWithOptions[]
  displayOrderStart: number
}): ImportCommitPlan {
  const { destination, rows, priorityOptions, categories, items, displayOrderStart } =
    input

  if (destination.mode === 'new' && destination.name.trim() === '') {
    throw new ImportPlanError('El proyecto nuevo necesita un nombre.')
  }
  if (destination.mode === 'existing' && !destination.projectId) {
    throw new ImportPlanError('Falta el proyecto destino.')
  }

  const summary = computeImportSummary(rows)
  if (!canConfirmImport(summary)) {
    throw new ImportPlanError('No hay ítems válidos seleccionados para importar.')
  }

  for (const row of rows) {
    if (row.selected && row.severity === 'error') {
      throw new ImportPlanError(
        `La fila ${row.draft.rowIndex} tiene errores y no puede importarse.`,
      )
    }
    if (
      isRowActive(row) &&
      row.duplicateAction === 'update_existing' &&
      !row.matchedItemId
    ) {
      throw new ImportPlanError(
        `Fila ${row.draft.rowIndex}: no se puede actualizar un duplicado solo del CSV.`,
      )
    }
    if (isRowActive(row) && row.status.kind === 'unknown') {
      throw new ImportPlanError(`Fila ${row.draft.rowIndex}: estado desconocido.`)
    }
  }

  const categoryIdByName = new Map(
    categories.map((c) => [normalizeItemName(c.name), c.id] as const),
  )

  const categoriesToCreate: PlannedCategoryCreate[] = []
  const seenCategoryKeys = new Set<string>()
  let order = displayOrderStart

  for (const row of rows) {
    if (!isRowActive(row)) continue
    if (row.category.kind !== 'create') continue
    const key = normalizeItemName(row.category.name)
    if (seenCategoryKeys.has(key) || categoryIdByName.has(key)) continue
    seenCategoryKeys.add(key)
    categoriesToCreate.push({
      key,
      name: row.category.name,
      displayOrder: order,
    })
    order += 1
  }

  const prioritiesToAppend: ProjectPriorityOption[] = []
  for (const row of rows) {
    if (!isRowActive(row)) continue
    if (row.priority.kind !== 'create') continue
    if (priorityOptions.some((p) => p.id === row.priority.id)) continue
    if (prioritiesToAppend.some((p) => p.id === row.priority.id)) continue
    prioritiesToAppend.push({
      id: row.priority.id,
      label: row.priority.label,
      display_order: priorityOptions.length + prioritiesToAppend.length,
    })
  }

  const itemCreates: PlannedItemCreate[] = []
  const itemUpdates: PlannedItemUpdate[] = []
  const itemsById = new Map(items.map((i) => [i.id, i] as const))

  for (const row of rows) {
    if (!isRowActive(row)) continue

    if (row.duplicateAction === 'update_existing' && row.matchedItemId) {
      const existing = itemsById.get(row.matchedItemId)
      if (!existing) {
        throw new ImportPlanError(
          `Fila ${row.draft.rowIndex}: el ítem a actualizar ya no existe.`,
        )
      }

      const previous = existingToInput(existing)
      const next: ItemInput = { ...previous }
      let categoryCreateKey: string | null = null

      if (row.updateDiff.some((d) => d.field === 'category_id' && d.kind === 'change')) {
        if (row.category.kind === 'create') {
          categoryCreateKey = normalizeItemName(row.category.name)
          next.category_id = null
        } else {
          next.category_id = nextCategoryIdForUpdate(
            row.category,
            categoryIdByName,
            existing.category_id,
          )
        }
      }
      if (row.updateDiff.some((d) => d.field === 'priority' && d.kind === 'change')) {
        next.priority = row.priority.id
      }
      if (row.updateDiff.some((d) => d.field === 'estimated_cost' && d.kind === 'change')) {
        next.estimated_cost = row.draft.estimatedCost
      }

      const addOption = row.updateDiff.some((d) => d.kind === 'add_option')
      itemUpdates.push({
        rowId: row.id,
        itemId: existing.id,
        previous,
        previousCompletedAt: existing.completed_at,
        next,
        categoryCreateKey,
        option: addOption && row.draft.option ? toOptionPlan(row.draft.option) : null,
      })
      continue
    }

    let categoryRef: PlannedItemCreate['categoryRef'] = { type: 'none' }
    if (row.category.kind === 'existing') {
      categoryRef = { type: 'id', id: row.category.id }
    } else if (row.category.kind === 'create') {
      categoryRef = { type: 'key', key: normalizeItemName(row.category.name) }
    }

    itemCreates.push({
      rowId: row.id,
      name: row.draft.name.trim(),
      categoryRef,
      status: statusIdOf(row),
      priority: row.priority.id,
      estimated_cost: row.draft.estimatedCost,
      quantity: 1,
      actual_cost: row.draft.actualCost,
      purchase_url: row.draft.purchaseUrl,
      notes: row.draft.notes,
      option: row.draft.option ? toOptionPlan(row.draft.option) : null,
    })
  }

  if (itemCreates.length !== summary.itemsCreated) {
    throw new ImportPlanError(
      'El plan de creación no coincide con el resumen de la vista previa.',
    )
  }
  if (itemUpdates.length !== summary.itemsUpdated) {
    throw new ImportPlanError(
      'El plan de actualización no coincide con el resumen de la vista previa.',
    )
  }
  if (categoriesToCreate.length !== summary.categoriesCreated) {
    throw new ImportPlanError(
      'El plan de categorías no coincide con el resumen de la vista previa.',
    )
  }
  if (prioritiesToAppend.length !== summary.prioritiesCreated) {
    throw new ImportPlanError(
      'El plan de prioridades no coincide con el resumen de la vista previa.',
    )
  }

  return {
    destination,
    priorityOptionsBefore: [...priorityOptions],
    priorityOptionsAfter: [...priorityOptions, ...prioritiesToAppend],
    categoriesToCreate,
    itemCreates,
    itemUpdates,
    summary: {
      ...summary,
      itemsImported: summary.itemsCreated + summary.itemsUpdated,
    },
  }
}
