import { supabase } from '@/lib/supabase/client'
import {
  mapBudgetItem,
  mapCategory,
  mapItem,
  mapOption,
  mapProject,
  mapSavingsMovement,
} from '@/lib/supabase/mappers'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import type {
  Category,
  ItemWithOptions,
  LabelPreset,
  Project,
  ProjectSavingsMovement,
  SavingsMode,
  SavingsMovementType,
} from '@/types/domain'
import type { BudgetItem } from '@/utils/budget/calculations'
import type { SavingsPlan } from '@/utils/budget/savings'
import type { Database } from '@/types/database'
import { createItem } from '@/features/items/item-api'
import { createOption, selectOption } from '@/features/item-options/option-api'
import {
  buildProjectPayload,
  buildSavingsGoalPayload,
  buildSavingsModePayload,
  buildSavingsPlanPayload,
  type ProjectSavingsGoalInput,
} from './project-savings'
import {
  DEFAULT_PRIORITY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
  MOVE_IN_PRIORITY_OPTIONS,
} from './project-options'
import { MOVE_IN_TEMPLATE_CATEGORIES } from './templates'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type CategoryRow = Database['public']['Tables']['categories']['Row']
type ItemRow = Database['public']['Tables']['items']['Row']
type OptionRow = Database['public']['Tables']['item_options']['Row']

type ProjectBundleRow = ProjectRow & {
  categories: CategoryRow[] | null
  items: Array<ItemRow & { item_options: OptionRow[] | null }> | null
}

export type ProjectListEntry = Project & { items: BudgetItem[] }

export async function fetchProjects(): Promise<ProjectListEntry[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(
      '*, items(status, priority, category_id, estimated_cost, actual_cost, item_options(price, selected))',
    )
    .order('created_at', { ascending: false })

  if (error) throw new Error(supabaseErrorMessage(error))

  return (data ?? []).map((row) => {
    const bundle = row as unknown as ProjectRow & {
      items: Array<{
        status: string
        priority: string
        category_id: string | null
        estimated_cost: string | null
        actual_cost: string | null
        item_options: Array<{
          price: string | null
          selected: boolean
        }> | null
      }> | null
    }
    return {
      ...mapProject(bundle),
      items: (bundle.items ?? []).map(mapBudgetItem),
    }
  })
}

export async function fetchProjectBundle(projectId: string): Promise<{
  project: Project
  categories: Category[]
  items: ItemWithOptions[]
  savingsMovements: ProjectSavingsMovement[]
}> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, categories(*), items(*, item_options(*))')
    .eq('id', projectId)
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  if (!data) throw new Error('Proyecto no encontrado.')

  const row = data as unknown as ProjectBundleRow
  const categories = (row.categories ?? [])
    .map(mapCategory)
    .sort((a, b) => a.display_order - b.display_order)

  const items = (row.items ?? []).map((itemRow) => ({
    ...mapItem(itemRow),
    options: (itemRow.item_options ?? []).map(mapOption),
  }))

  // Separate query avoids PostgREST schema-cache embed issues after new tables.
  const { data: movementRows, error: movementError } = await supabase
    .from('project_savings_movements')
    .select('*')
    .eq('project_id', projectId)
    .order('movement_date', { ascending: true })

  if (movementError) throw new Error(supabaseErrorMessage(movementError))

  const savingsMovements = (movementRows ?? [])
    .map(mapSavingsMovement)
    .sort((a, b) => a.movement_date.localeCompare(b.movement_date) || a.name.localeCompare(b.name))

  return {
    project: mapProject(row),
    categories,
    items,
    savingsMovements,
  }
}

export async function createProject(input: {
  userId: string
  name: string
  description: string | null
  icon: string | null
  budget: number | null
  useMoveInTemplate: boolean
  /** Locked at creation: `goal` projects stay goals forever. */
  savingsMode?: SavingsMode
}): Promise<Project> {
  const label_preset: LabelPreset = input.useMoveInTemplate ? 'move_in' : 'default'
  const savingsMode: SavingsMode = input.savingsMode === 'goal' ? 'goal' : 'none'
  const payload = buildProjectPayload({
    name: input.name,
    description: input.description,
    icon: input.icon,
    label_preset,
    budget: savingsMode === 'goal' ? null : input.budget,
    savingsGoal:
      savingsMode === 'goal'
        ? {
            enabled: true,
            initialBalance: null,
            targetAmount: null,
            minimumReserve: null,
            monthlyContribution: null,
            startDate: null,
          }
        : undefined,
  })

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: input.userId,
      ...payload,
      savings_mode: savingsMode,
      savings_goal_enabled: savingsMode === 'goal',
      status_options: DEFAULT_STATUS_OPTIONS as unknown as import('@/types/database').Json,
      priority_options: (input.useMoveInTemplate
        ? MOVE_IN_PRIORITY_OPTIONS
        : DEFAULT_PRIORITY_OPTIONS) as unknown as import('@/types/database').Json,
    })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  const project = mapProject(data)

  if (input.useMoveInTemplate && savingsMode !== 'goal') {
    const rows = MOVE_IN_TEMPLATE_CATEGORIES.map((name, index) => ({
      project_id: project.id,
      name,
      display_order: index,
    }))
    const { error: catError } = await supabase.from('categories').insert(rows)
    if (catError) throw new Error(supabaseErrorMessage(catError))
  }

  return project
}

export async function updateProject(
  projectId: string,
  input: {
    name: string
    description: string | null
    icon: string | null
    budget: number | null
    label_preset: LabelPreset
  },
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      name: input.name.trim(),
      description: input.description,
      icon: input.icon,
      budget: input.budget,
      label_preset: input.label_preset,
    })
    .eq('id', projectId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function updateProjectSavingsGoal(
  projectId: string,
  goal: ProjectSavingsGoalInput,
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      ...buildSavingsGoalPayload({ ...goal, enabled: true }),
      savings_mode: 'goal',
      savings_goal_enabled: true,
    })
    .eq('id', projectId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function updateProjectSavingsPlan(
  projectId: string,
  plan: SavingsPlan,
  currentMode: SavingsMode = 'none',
): Promise<void> {
  if (currentMode === 'goal') {
    throw new Error('Este proyecto es una meta de ahorro y no admite plan de compras.')
  }
  const { error } = await supabase
    .from('projects')
    .update(buildSavingsPlanPayload(plan))
    .eq('id', projectId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function updateProjectSavingsMode(
  projectId: string,
  mode: SavingsMode,
  currentMode: SavingsMode,
): Promise<void> {
  if (currentMode === 'goal') {
    throw new Error(
      'Este proyecto es una meta de ahorro y no puede cambiar de tipo.',
    )
  }
  if (mode === 'goal') {
    throw new Error(
      'La meta de ahorro solo se elige al crear el proyecto y no se puede activar después.',
    )
  }
  if (mode !== 'none' && mode !== 'plan') {
    throw new Error('Modo de ahorro no válido.')
  }

  const { error } = await supabase
    .from('projects')
    .update(buildSavingsModePayload(mode))
    .eq('id', projectId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function updateProjectBudget(
  projectId: string,
  budget: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ budget })
    .eq('id', projectId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

/** @deprecated Use updateProjectSavingsPlan */
export async function updateProjectSavings(
  projectId: string,
  savings: {
    savings_amount: number | null
    savings_accrues_interest: boolean
    savings_interest_rate_annual: number | null
    savings_start_date: string | null
    savings_end_date: string | null
  },
): Promise<void> {
  await updateProjectSavingsPlan(projectId, savings)
}

export async function createSavingsMovement(
  projectId: string,
  input: {
    name: string
    movement_date: string
    amount: number
    movement_type: SavingsMovementType
  },
): Promise<ProjectSavingsMovement> {
  const { data, error } = await supabase
    .from('project_savings_movements')
    .insert({
      project_id: projectId,
      name: input.name.trim(),
      movement_date: input.movement_date,
      amount: input.amount,
      movement_type: input.movement_type,
    })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  return mapSavingsMovement(data)
}

export async function updateSavingsMovement(
  movementId: string,
  input: {
    name: string
    movement_date: string
    amount: number
    movement_type: SavingsMovementType
  },
): Promise<void> {
  const { error } = await supabase
    .from('project_savings_movements')
    .update({
      name: input.name.trim(),
      movement_date: input.movement_date,
      amount: input.amount,
      movement_type: input.movement_type,
    })
    .eq('id', movementId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function deleteSavingsMovement(movementId: string): Promise<void> {
  const { error } = await supabase
    .from('project_savings_movements')
    .delete()
    .eq('id', movementId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw new Error(supabaseErrorMessage(error))
}

export type DuplicateProjectMode = 'full' | 'config'

/**
 * Duplicates a project.
 * - `config`: budget, savings goal, movements, status/priority options, categories (no items).
 * - `full`: same as config plus items and their options.
 */
export async function duplicateProject(
  sourceProjectId: string,
  userId: string,
  mode: DuplicateProjectMode,
): Promise<Project> {
  const { project, categories, items, savingsMovements } =
    await fetchProjectBundle(sourceProjectId)
  const copyName = `${project.name} (copia)`

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: copyName,
      description: project.description,
      icon: project.icon,
      budget: project.budget,
      label_preset: project.label_preset,
      status_options: project.status_options as unknown as import('@/types/database').Json,
      priority_options: project.priority_options as unknown as import('@/types/database').Json,
      savings_mode: project.savings_mode,
      savings_goal_enabled: project.savings_mode === 'goal',
      savings_initial_balance: project.savings_initial_balance,
      savings_target_amount: project.savings_target_amount,
      savings_minimum_reserve: project.savings_minimum_reserve,
      savings_goal_monthly_amount: project.savings_goal_monthly_amount,
      savings_goal_start_date: project.savings_goal_start_date,
      savings_amount: project.savings_amount,
      savings_accrues_interest: project.savings_accrues_interest,
      savings_interest_rate_annual: project.savings_interest_rate_annual,
      savings_start_date: project.savings_start_date,
      savings_end_date: project.savings_end_date,
    })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  const created = mapProject(data)

  try {
    if (savingsMovements.length > 0) {
      const { error: movementError } = await supabase
        .from('project_savings_movements')
        .insert(
          savingsMovements.map((movement) => ({
            project_id: created.id,
            name: movement.name,
            movement_date: movement.movement_date,
            amount: movement.amount,
            movement_type: movement.movement_type,
          })),
        )
      if (movementError) throw new Error(supabaseErrorMessage(movementError))
    }

    const categoryIdMap = new Map<string, string>()
    if (categories.length > 0) {
      const { data: catRows, error: catError } = await supabase
        .from('categories')
        .insert(
          categories.map((category) => ({
            project_id: created.id,
            name: category.name,
            display_order: category.display_order,
          })),
        )
        .select()

      if (catError) throw new Error(supabaseErrorMessage(catError))
      const inserted = (catRows ?? [])
        .map(mapCategory)
        .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
      const sources = [...categories].sort(
        (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name),
      )
      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index]
        const match = inserted[index]
        if (source && match) categoryIdMap.set(source.id, match.id)
      }
    }

    if (mode === 'full' && items.length > 0) {
      for (const item of items) {
        const createdItem = await createItem(
          created.id,
          {
            name: item.name,
            description: item.description,
            category_id: item.category_id
              ? (categoryIdMap.get(item.category_id) ?? null)
              : null,
            status: item.status,
            priority: item.priority,
            estimated_cost: item.estimated_cost,
            actual_cost: item.actual_cost,
            purchase_url: item.purchase_url,
            notes: item.notes,
          },
          project.status_options,
        )

        if (item.completed_at) {
          const { error: completedError } = await supabase
            .from('items')
            .update({ completed_at: item.completed_at })
            .eq('id', createdItem.id)
          if (completedError) throw new Error(supabaseErrorMessage(completedError))
        }

        for (const option of item.options) {
          const createdOption = await createOption(createdItem.id, {
            name: option.name,
            brand: option.brand,
            model: option.model,
            price: option.price,
            store: option.store,
            product_url: option.product_url,
            description: option.description,
            specifications: option.specifications,
            notes: option.notes,
          })
          if (option.selected) {
            await selectOption(createdOption.id)
          }
        }
      }
    }
  } catch (err) {
    await supabase.from('projects').delete().eq('id', created.id)
    throw err
  }

  return created
}
