import { supabase } from '@/lib/supabase/client'
import { mapBudgetItem, mapCategory, mapItem, mapOption, mapProject } from '@/lib/supabase/mappers'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import type { Category, ItemWithOptions, LabelPreset, Project } from '@/types/domain'
import type { BudgetItem } from '@/utils/budget/calculations'
import type { SavingsPlan } from '@/utils/budget/savings'
import type { Database } from '@/types/database'
import { buildProjectPayload, buildSavingsPayload } from './project-savings'
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
      '*, items(status, priority, category_id, estimated_cost, actual_cost)',
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

  return { project: mapProject(row), categories, items }
}

export async function createProject(input: {
  userId: string
  name: string
  description: string | null
  icon: string | null
  useMoveInTemplate: boolean
  savings: SavingsPlan
}): Promise<Project> {
  const label_preset: LabelPreset = input.useMoveInTemplate ? 'move_in' : 'default'
  const payload = buildProjectPayload({
    name: input.name,
    description: input.description,
    icon: input.icon,
    label_preset,
    savings: input.savings,
  })

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: input.userId,
      ...payload,
      status_options: DEFAULT_STATUS_OPTIONS as unknown as import('@/types/database').Json,
      priority_options: (input.useMoveInTemplate
        ? MOVE_IN_PRIORITY_OPTIONS
        : DEFAULT_PRIORITY_OPTIONS) as unknown as import('@/types/database').Json,
    })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  const project = mapProject(data)

  if (input.useMoveInTemplate) {
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
    label_preset: LabelPreset
  },
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      name: input.name.trim(),
      description: input.description,
      icon: input.icon,
      label_preset: input.label_preset,
    })
    .eq('id', projectId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function updateProjectSavings(
  projectId: string,
  savings: SavingsPlan,
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update(buildSavingsPayload(savings))
    .eq('id', projectId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw new Error(supabaseErrorMessage(error))
}
