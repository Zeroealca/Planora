import { createCategory, deleteCategory } from '@/features/categories/category-api'
import {
  createItem,
  deleteItem,
  updateItem,
  type ItemInput,
} from '@/features/items/item-api'
import {
  createOption,
  deleteOption,
  selectOption,
} from '@/features/item-options/option-api'
import {
  createProject,
  deleteProject,
  fetchProjectBundle,
} from '@/features/projects/project-api'
import { updateProjectPriorityOptions } from '@/features/projects/project-options-api'
import {
  DEFAULT_PRIORITY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
  type ProjectStatusOption,
} from '@/features/projects/project-options'
import type { Category, ItemOption, ItemWithOptions } from '@/types/domain'
import {
  buildCommitPlan,
  type ImportCommitPlan,
  type PlannedOptionCreate,
} from './build-commit-plan'
import type {
  ImportCommitResult,
  ImportDestination,
  PreviewRow,
} from './import-types'

type RollbackJournal = {
  createdProjectId: string | null
  previousPriorityOptions: ImportCommitPlan['priorityOptionsBefore'] | null
  createdCategoryIds: string[]
  createdItemIds: string[]
  createdOptions: ItemOption[]
  updatedItems: Array<{
    itemId: string
    previous: ItemInput
    completedAt: string | null
  }>
}

async function createAndSelectOption(
  itemId: string,
  option: PlannedOptionCreate,
): Promise<ItemOption> {
  const created = await createOption(itemId, option)
  if (option.selectAfterCreate) {
    await selectOption(created.id)
  }
  return created
}

async function rollbackImport(
  journal: RollbackJournal,
  statusOptions: readonly ProjectStatusOption[],
  projectId: string,
): Promise<void> {
  if (journal.createdProjectId) {
    try {
      await deleteProject(journal.createdProjectId)
    } catch (err) {
      console.error('Rollback: no se pudo eliminar el proyecto creado', err)
    }
    return
  }

  for (const option of [...journal.createdOptions].reverse()) {
    try {
      await deleteOption(option)
    } catch (err) {
      console.error('Rollback: no se pudo eliminar opción', option.id, err)
    }
  }

  for (const entry of [...journal.updatedItems].reverse()) {
    try {
      await updateItem(
        entry.itemId,
        entry.previous,
        statusOptions,
        entry.completedAt,
      )
    } catch (err) {
      console.error('Rollback: no se pudo restaurar ítem', entry.itemId, err)
    }
  }

  for (const itemId of [...journal.createdItemIds].reverse()) {
    try {
      await deleteItem(itemId)
    } catch (err) {
      console.error('Rollback: no se pudo eliminar ítem', itemId, err)
    }
  }

  for (const categoryId of [...journal.createdCategoryIds].reverse()) {
    try {
      await deleteCategory(categoryId)
    } catch (err) {
      console.error('Rollback: no se pudo eliminar categoría', categoryId, err)
    }
  }

  if (journal.previousPriorityOptions) {
    try {
      await updateProjectPriorityOptions(projectId, journal.previousPriorityOptions)
    } catch (err) {
      console.error('Rollback: no se pudieron restaurar prioridades', err)
    }
  }
}

/**
 * Validates a full commit plan, then applies writes.
 * On critical failure, attempts compensating rollback so the project is not
 * left half-imported.
 *
 * Dashboard metrics are never imported: after data lands, Planora derives
 * planned/spent/pending/balance/savings/progress from domain rules.
 */
export async function commitImport(input: {
  userId: string
  destination: ImportDestination
  rows: PreviewRow[]
}): Promise<ImportCommitResult> {
  const { userId, destination, rows } = input

  let statusOptions: readonly ProjectStatusOption[]
  let categories: Category[]
  let items: ItemWithOptions[]
  let priorityOptions: typeof DEFAULT_PRIORITY_OPTIONS
  let displayOrderStart: number
  let projectIdForExisting: string | null = null

  if (destination.mode === 'existing') {
    const bundle = await fetchProjectBundle(destination.projectId)
    projectIdForExisting = bundle.project.id
    statusOptions = bundle.project.status_options
    priorityOptions = bundle.project.priority_options
    categories = bundle.categories
    items = bundle.items
    displayOrderStart =
      categories.reduce((max, c) => Math.max(max, c.display_order), -1) + 1
  } else {
    statusOptions = DEFAULT_STATUS_OPTIONS
    priorityOptions = DEFAULT_PRIORITY_OPTIONS
    categories = []
    items = []
    displayOrderStart = 0
  }

  const plan = buildCommitPlan({
    destination,
    rows,
    priorityOptions,
    categories,
    items,
    displayOrderStart,
  })

  const journal: RollbackJournal = {
    createdProjectId: null,
    previousPriorityOptions: null,
    createdCategoryIds: [],
    createdItemIds: [],
    createdOptions: [],
    updatedItems: [],
  }

  let projectId = projectIdForExisting ?? ''
  let priorityBefore = plan.priorityOptionsBefore
  let priorityAfter = plan.priorityOptionsAfter
  let writeStatusOptions = statusOptions

  try {
    if (destination.mode === 'new') {
      const project = await createProject({
        userId,
        name: destination.name.trim(),
        description: null,
        icon: null,
        budget: destination.budget,
        useMoveInTemplate: false,
      })
      projectId = project.id
      journal.createdProjectId = project.id
      writeStatusOptions = project.status_options
      priorityBefore = [...project.priority_options]
      const appended = plan.priorityOptionsAfter.filter(
        (p) => !project.priority_options.some((e) => e.id === p.id),
      )
      priorityAfter = [...project.priority_options, ...appended]
    }

    if (priorityAfter.length !== priorityBefore.length) {
      journal.previousPriorityOptions = priorityBefore
      await updateProjectPriorityOptions(projectId, priorityAfter)
    }

    const categoryIdByKey = new Map<string, string>()
    for (const planned of plan.categoriesToCreate) {
      const created = await createCategory(
        projectId,
        planned.name,
        planned.displayOrder,
      )
      journal.createdCategoryIds.push(created.id)
      categoryIdByKey.set(planned.key, created.id)
    }

    for (const planned of plan.itemCreates) {
      let categoryId: string | null = null
      if (planned.categoryRef.type === 'id') categoryId = planned.categoryRef.id
      else if (planned.categoryRef.type === 'key') {
        categoryId = categoryIdByKey.get(planned.categoryRef.key) ?? null
        if (categoryId == null) {
          throw new Error(
            `No se resolvió la categoría para el ítem «${planned.name}».`,
          )
        }
      }

      const created = await createItem(
        projectId,
        {
          name: planned.name,
          description: null,
          category_id: categoryId,
          status: planned.status,
          priority: planned.priority,
          estimated_cost: planned.estimated_cost,
          actual_cost: planned.actual_cost,
          purchase_url: planned.purchase_url,
          notes: planned.notes,
        },
        writeStatusOptions,
      )
      journal.createdItemIds.push(created.id)

      if (planned.option) {
        const opt = await createAndSelectOption(created.id, planned.option)
        journal.createdOptions.push(opt)
      }
    }

    for (const planned of plan.itemUpdates) {
      journal.updatedItems.push({
        itemId: planned.itemId,
        previous: planned.previous,
        completedAt: planned.previousCompletedAt,
      })

      const next: ItemInput = { ...planned.next }
      if (planned.categoryCreateKey) {
        const resolved = categoryIdByKey.get(planned.categoryCreateKey)
        if (!resolved) {
          throw new Error('No se resolvió la categoría al actualizar un ítem.')
        }
        next.category_id = resolved
      }

      await updateItem(
        planned.itemId,
        next,
        writeStatusOptions,
        planned.previousCompletedAt,
      )

      if (planned.option) {
        const opt = await createAndSelectOption(planned.itemId, planned.option)
        journal.createdOptions.push(opt)
      }
    }

    return { projectId, summary: plan.summary }
  } catch (err) {
    await rollbackImport(journal, writeStatusOptions, projectId)
    const message =
      err instanceof Error ? err.message : 'La importación falló.'
    throw new Error(
      `${message} Se revirtieron los cambios parciales de esta importación.`,
      { cause: err },
    )
  }
}
