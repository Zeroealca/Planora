import type { Category, ItemWithOptions } from '@/types/domain'
import type {
  ProjectPriorityOption,
  ProjectStatusOption,
} from '@/features/projects/project-options'
import {
  resolveCategory,
  resolvePriority,
  resolveStatus,
} from './conflict-analysis'
import { buildUpdateDiff, findPossibleDuplicate } from './duplicate-match'
import { normalizeItemName } from './normalize-name'
import type { MappedDraft, PreviewRow } from './import-types'
import { parseOptionalNumber } from './map-row'
import { collectIssues } from './validate-preview'

export type PreviewContext = {
  categories: readonly Category[]
  items: readonly ItemWithOptions[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
}

export type DraftEditField =
  | 'name'
  | 'categoryName'
  | 'priorityRaw'
  | 'statusRaw'
  | 'estimatedCost'
  | 'plannedPrice'
  | 'actualCost'
  | 'store'

function syncOption(draft: MappedDraft): MappedDraft {
  const hasOptionSignal =
    draft.plannedPrice != null ||
    (draft.store != null && draft.store !== '') ||
    (draft.purchaseUrl != null && draft.purchaseUrl !== '')

  if (!hasOptionSignal) {
    return { ...draft, option: null }
  }

  return {
    ...draft,
    option: {
      name: draft.option?.name || draft.name.trim() || 'Opción',
      price: draft.plannedPrice,
      store: draft.store,
      product_url: draft.purchaseUrl,
    },
  }
}

export function applyDraftField(
  draft: MappedDraft,
  field: DraftEditField,
  rawValue: string,
): MappedDraft {
  let next: MappedDraft = { ...draft, empty: false }

  switch (field) {
    case 'name':
      next = { ...next, name: rawValue }
      break
    case 'categoryName':
      next = { ...next, categoryName: rawValue.trim() === '' ? null : rawValue }
      break
    case 'priorityRaw':
      next = { ...next, priorityRaw: rawValue.trim() === '' ? null : rawValue }
      break
    case 'statusRaw':
      next = { ...next, statusRaw: rawValue.trim() === '' ? null : rawValue }
      break
    case 'estimatedCost': {
      const parsed = parseOptionalNumber(rawValue)
      next = {
        ...next,
        estimatedCost: parsed.value,
        estimatedCostInvalid: parsed.invalid,
      }
      break
    }
    case 'plannedPrice': {
      const parsed = parseOptionalNumber(rawValue)
      next = {
        ...next,
        plannedPrice: parsed.value,
        plannedPriceInvalid: parsed.invalid,
      }
      break
    }
    case 'actualCost': {
      const parsed = parseOptionalNumber(rawValue)
      next = {
        ...next,
        actualCost: parsed.value,
        actualCostInvalid: parsed.invalid,
      }
      break
    }
    case 'store':
      next = { ...next, store: rawValue.trim() === '' ? null : rawValue }
      break
  }

  return syncOption(next)
}

export function buildPreviewRows(input: {
  drafts: MappedDraft[]
  categories: readonly Category[]
  items: readonly ItemWithOptions[]
  statusOptions: readonly ProjectStatusOption[]
  priorityOptions: readonly ProjectPriorityOption[]
}): PreviewRow[] {
  const { drafts, categories, items, statusOptions, priorityOptions } = input

  const virtualItems: ItemWithOptions[] = []

  return drafts.map((draft, index) => {
    const category = resolveCategory(draft.categoryName, categories)
    const priority = resolvePriority(draft.priorityRaw, priorityOptions)
    const status = resolveStatus(draft.statusRaw, statusOptions)

    const pool = [...items, ...virtualItems]
    const match = findPossibleDuplicate(draft, pool, categories)
    const { issues, severity } = collectIssues({
      draft,
      category,
      priority,
      status,
      hasDuplicate: match != null,
      matchedName: match?.item.name ?? null,
    })

    const isDuplicate = match != null
    const duplicateAction = isDuplicate ? 'omit' : null
    const selected = !isDuplicate && severity !== 'error'

    const updateDiff =
      match != null
        ? buildUpdateDiff(draft, match.item, category, priority, categories)
        : []

    if (!draft.empty && draft.name.trim() !== '' && severity !== 'error') {
      virtualItems.push({
        id: `csv-${index}`,
        project_id: '',
        category_id: category.kind === 'existing' ? category.id : null,
        name: draft.name.trim(),
        description: null,
        status:
          status.kind === 'ok' || status.kind === 'default' ? status.id : 'Pending',
        priority: priority.id,
        quantity: 1,
        estimated_cost: draft.estimatedCost,
        actual_cost: draft.actualCost,
        purchase_url: draft.purchaseUrl,
        notes: draft.notes,
        completed_at: draft.completedAt,
        created_at: '',
        updated_at: '',
        options: [],
      })
    }

    return {
      id: `row-${index}`,
      draft,
      category,
      priority,
      status,
      issues,
      severity,
      selected,
      duplicateAction,
      matchedItemId: match?.item.id.startsWith('csv-')
        ? null
        : match?.item.id ?? null,
      matchedItemName: match?.item.name ?? null,
      updateDiff,
    } satisfies PreviewRow
  })
}

/** Keep user checkbox / duplicate choices after re-validating edited drafts. */
export function mergePreviewPreferences(
  rebuilt: readonly PreviewRow[],
  previous: readonly PreviewRow[],
): PreviewRow[] {
  return rebuilt.map((row) => {
    const prev = previous.find((p) => p.id === row.id)
    if (!prev) return row

    if (row.severity === 'error') {
      return { ...row, selected: false }
    }

    if (row.duplicateAction != null) {
      let action = prev.duplicateAction ?? 'omit'
      if (action === 'update_existing' && row.matchedItemId == null) {
        action = 'create_new'
      }
      if (prev.duplicateAction == null) {
        action = 'omit'
      }
      return {
        ...row,
        duplicateAction: action,
        selected: action !== 'omit',
      }
    }

    return {
      ...row,
      duplicateAction: null,
      selected: prev.selected,
    }
  })
}

export function rebuildPreviewAfterDraftEdit(input: {
  rows: readonly PreviewRow[]
  rowId: string
  field: DraftEditField
  value: string
  context: PreviewContext
}): PreviewRow[] {
  const drafts = input.rows.map((row) =>
    row.id === input.rowId
      ? applyDraftField(row.draft, input.field, input.value)
      : row.draft,
  )
  const rebuilt = buildPreviewRows({
    drafts,
    ...input.context,
  })
  return mergePreviewPreferences(rebuilt, input.rows)
}

export function applyDuplicateAction(
  row: PreviewRow,
  action: 'omit' | 'create_new' | 'update_existing',
): PreviewRow {
  if (row.severity === 'error') {
    return { ...row, duplicateAction: action, selected: false }
  }
  if (action === 'omit') {
    return { ...row, duplicateAction: action, selected: false }
  }
  if (action === 'update_existing' && row.matchedItemId == null) {
    return { ...row, duplicateAction: 'create_new', selected: true }
  }
  return { ...row, duplicateAction: action, selected: true }
}

export function applyRowSelected(row: PreviewRow, selected: boolean): PreviewRow {
  if (row.severity === 'error') {
    return { ...row, selected: false }
  }
  if (!selected) {
    if (row.duplicateAction != null) {
      return { ...row, selected: false, duplicateAction: 'omit' }
    }
    return { ...row, selected: false }
  }
  if (row.duplicateAction === 'omit') {
    return { ...row, selected: true, duplicateAction: 'create_new' }
  }
  return { ...row, selected: true }
}

export function categoryWillCreateKey(name: string): string {
  return normalizeItemName(name)
}
