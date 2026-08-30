import { supabase } from '@/lib/supabase/client'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import { mapCategory } from '@/lib/supabase/mappers'
import type { Category } from '@/types/domain'

export async function createCategory(
  projectId: string,
  name: string,
  displayOrder: number,
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      project_id: projectId,
      name: name.trim(),
      display_order: displayOrder,
    })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  return mapCategory(data)
}

export async function updateCategory(
  categoryId: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ name: name.trim() })
    .eq('id', categoryId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId)
  if (error) throw new Error(supabaseErrorMessage(error))
}
