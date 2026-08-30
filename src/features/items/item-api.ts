import { supabase } from '@/lib/supabase/client'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import { mapItem } from '@/lib/supabase/mappers'
import { isCompletedStatus, type Item, type ItemPriority, type ItemStatus } from '@/types/domain'

export function completedAtForStatus(
  status: ItemStatus,
  current: string | null,
): string | null {
  if (!isCompletedStatus(status)) return null
  return current ?? new Date().toISOString()
}

export type ItemInput = {
  name: string
  description: string | null
  category_id: string | null
  status: ItemStatus
  priority: ItemPriority
  estimated_cost: number | null
  actual_cost: number | null
  notes: string | null
}

export async function createItem(
  projectId: string,
  input: ItemInput,
): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      project_id: projectId,
      name: input.name.trim(),
      description: input.description,
      category_id: input.category_id,
      status: input.status,
      priority: input.priority,
      estimated_cost: input.estimated_cost,
      actual_cost: input.actual_cost,
      notes: input.notes,
      completed_at: completedAtForStatus(input.status, null),
    })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  return mapItem(data)
}

export async function updateItem(
  itemId: string,
  input: ItemInput,
  currentCompletedAt: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({
      name: input.name.trim(),
      description: input.description,
      category_id: input.category_id,
      status: input.status,
      priority: input.priority,
      estimated_cost: input.estimated_cost,
      actual_cost: input.actual_cost,
      notes: input.notes,
      completed_at: completedAtForStatus(input.status, currentCompletedAt),
    })
    .eq('id', itemId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', itemId)
  if (error) throw new Error(supabaseErrorMessage(error))
}
