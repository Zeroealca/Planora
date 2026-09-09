import type { Category, ItemWithOptions } from '@/types/domain'
import { normalizeItemName } from './normalize-name'
import type {
  FieldDiff,
  MappedDraft,
  ResolvedCategory,
  ResolvedPriority,
} from './import-types'

export type DuplicateMatch = {
  item: ItemWithOptions
  score: 'name_and_category' | 'name_only'
}

function categoryNameOf(
  item: ItemWithOptions,
  categories: readonly Category[],
): string | null {
  if (!item.category_id) return null
  return categories.find((c) => c.id === item.category_id)?.name ?? null
}

export function findPossibleDuplicate(
  draft: MappedDraft,
  items: readonly ItemWithOptions[],
  categories: readonly Category[],
): DuplicateMatch | null {
  const nameKey = normalizeItemName(draft.name)
  if (nameKey === '') return null

  const draftCat = draft.categoryName
    ? normalizeItemName(draft.categoryName)
    : null

  const nameMatches = items.filter(
    (item) => normalizeItemName(item.name) === nameKey,
  )
  if (nameMatches.length === 0) return null

  if (draftCat) {
    const withCat = nameMatches.find((item) => {
      const cat = categoryNameOf(item, categories)
      return cat != null && normalizeItemName(cat) === draftCat
    })
    if (withCat) return { item: withCat, score: 'name_and_category' }
  }

  return { item: nameMatches[0]!, score: 'name_only' }
}

function formatMoney(value: number | null): string {
  if (value == null) return '(vacío)'
  return String(value)
}

function formatText(value: string | null | undefined): string {
  if (value == null || value === '') return '(vacío)'
  return value
}

/**
 * Build field-level diff for "update existing".
 * Protected fields are listed when CSV differs but will never be written.
 */
export function buildUpdateDiff(
  draft: MappedDraft,
  existing: ItemWithOptions,
  category: ResolvedCategory,
  priority: ResolvedPriority,
  categories: readonly Category[],
): FieldDiff[] {
  const diffs: FieldDiff[] = []

  const nextCategoryId =
    category.kind === 'existing'
      ? category.id
      : category.kind === 'create'
        ? null // will resolve at commit; show intended name
        : null
  const existingCatName = categoryNameOf(existing, categories)
  const nextCatName =
    category.kind === 'existing' || category.kind === 'create'
      ? category.name
      : null

  if (
    (nextCatName != null &&
      normalizeItemName(nextCatName) !==
        normalizeItemName(existingCatName ?? '')) ||
    (nextCatName == null && existing.category_id != null && category.kind === 'none')
  ) {
    if (category.kind !== 'none' || existing.category_id != null) {
      diffs.push({
        field: 'category_id',
        label: 'Categoría',
        kind: 'change',
        from: formatText(existingCatName),
        to: formatText(nextCatName),
      })
    }
  } else if (
    category.kind === 'existing' &&
    nextCategoryId !== existing.category_id
  ) {
    diffs.push({
      field: 'category_id',
      label: 'Categoría',
      kind: 'change',
      from: formatText(existingCatName),
      to: formatText(nextCatName),
    })
  }

  if (priority.id !== existing.priority) {
    diffs.push({
      field: 'priority',
      label: 'Prioridad',
      kind: 'change',
      from: existing.priority,
      to: priority.label,
    })
  }

  if (draft.estimatedCost !== existing.estimated_cost) {
    if (draft.estimatedCost != null || existing.estimated_cost != null) {
      diffs.push({
        field: 'estimated_cost',
        label: 'Presupuesto',
        kind: 'change',
        from: formatMoney(existing.estimated_cost),
        to: formatMoney(draft.estimatedCost),
      })
    }
  }

  const selected = existing.options.find((o) => o.selected) ?? null
  if (draft.option && (draft.option.price != null || draft.option.store)) {
    if (!selected) {
      diffs.push({
        field: 'option',
        label: 'Opción',
        kind: 'add_option',
        from: '(ninguna seleccionada)',
        to: `${draft.option.name}${
          draft.option.price != null ? ` · ${draft.option.price}` : ''
        }${draft.option.store ? ` · ${draft.option.store}` : ''}`,
      })
    } else {
      const csvPrice = draft.option.price
      const csvStore = draft.option.store
      if (
        (csvPrice != null && csvPrice !== selected.price) ||
        (csvStore != null && csvStore !== selected.store)
      ) {
        diffs.push({
          field: 'option',
          label: 'Opción',
          kind: 'protected',
          from: `${selected.name}${
            selected.price != null ? ` · ${selected.price}` : ''
          }`,
          to: 'no se aplicará (opción existente conservada)',
        })
      }
    }
  }

  if (draft.statusRaw && draft.statusRaw.trim() !== '') {
    const rawNorm = normalizeItemName(draft.statusRaw)
    const existingNorm = normalizeItemName(existing.status)
    if (rawNorm !== existingNorm) {
      diffs.push({
        field: 'status',
        label: 'Estado',
        kind: 'protected',
        from: existing.status,
        to: 'no se aplicará (protegido)',
      })
    }
  }

  if (
    draft.actualCost != null &&
    draft.actualCost !== existing.actual_cost
  ) {
    diffs.push({
      field: 'actual_cost',
      label: 'Precio pagado',
      kind: 'protected',
      from: formatMoney(existing.actual_cost),
      to: 'no se aplicará (protegido)',
    })
  }

  if (draft.notes != null && draft.notes !== existing.notes) {
    diffs.push({
      field: 'notes',
      label: 'Notas',
      kind: 'protected',
      from: formatText(existing.notes),
      to: 'no se aplicará (protegido)',
    })
  }

  if (
    draft.completedAt != null &&
    draft.completedAt !== existing.completed_at
  ) {
    diffs.push({
      field: 'completed_at',
      label: 'Fecha de compra',
      kind: 'protected',
      from: formatText(existing.completed_at),
      to: 'no se aplicará (protegido)',
    })
  }

  return diffs
}

/** Resolve category id for update after categories may have been created. */
export function nextCategoryIdForUpdate(
  category: ResolvedCategory,
  categoryIdByName: Map<string, string>,
  existingCategoryId: string | null,
): string | null {
  if (category.kind === 'existing') return category.id
  if (category.kind === 'create') {
    return categoryIdByName.get(normalizeItemName(category.name)) ?? existingCategoryId
  }
  return existingCategoryId
}
