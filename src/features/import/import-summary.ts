import type {
  ImportCommitSummary,
  PreviewRow,
} from './import-types'
import { normalizeItemName } from './normalize-name'

export function computeImportSummary(rows: readonly PreviewRow[]): ImportCommitSummary {
  let itemsCreated = 0
  let itemsUpdated = 0
  let itemsOmitted = 0
  let optionsCreated = 0
  let warningRows = 0
  let errorRows = 0

  const categoriesToCreate = new Set<string>()
  const prioritiesToCreate = new Set<string>()

  for (const row of rows) {
    if (row.severity === 'error') {
      errorRows += 1
      continue
    }
    if (row.severity === 'warning') warningRows += 1

    const effectiveOmit =
      !row.selected || row.duplicateAction === 'omit'

    if (effectiveOmit) {
      // Count omit only for rows that had a product name (real candidates)
      if (!row.draft.empty && row.draft.name.trim() !== '') {
        itemsOmitted += 1
      }
      continue
    }

    if (row.duplicateAction === 'update_existing') {
      itemsUpdated += 1
      const willAddOption = row.updateDiff.some((d) => d.kind === 'add_option')
      if (willAddOption) optionsCreated += 1
    } else {
      itemsCreated += 1
      if (row.draft.option) optionsCreated += 1
    }

    if (row.category.kind === 'create') {
      categoriesToCreate.add(normalizeItemName(row.category.name))
    }
    if (row.priority.kind === 'create') {
      prioritiesToCreate.add(row.priority.id)
    }
  }

  return {
    itemsImported: itemsCreated + itemsUpdated,
    itemsCreated,
    itemsUpdated,
    itemsOmitted,
    categoriesCreated: categoriesToCreate.size,
    prioritiesCreated: prioritiesToCreate.size,
    optionsCreated,
    warningRows,
    errorRows,
  }
}

export function canConfirmImport(summary: ImportCommitSummary): boolean {
  return summary.itemsImported > 0
}
