import { supabase } from '@/lib/supabase/client'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import { mapItemSubarticle } from '@/lib/supabase/mappers'
import type { ItemSubarticle } from '@/types/domain'

export type ItemSubarticleInput = {
  name: string
  estimated_cost: number | null
  status: 'pending' | 'purchased'
  actual_cost: number | null
}

export async function createItemSubarticle(
  itemId: string,
  input: ItemSubarticleInput,
): Promise<ItemSubarticle> {
  const { data, error } = await supabase
    .from('item_subarticles')
    .insert({ item_id: itemId, ...input, name: input.name.trim() })
    .select()
    .single()
  if (error) throw new Error(supabaseErrorMessage(error))
  return mapItemSubarticle(data)
}

export async function updateItemSubarticle(id: string, input: ItemSubarticleInput): Promise<void> {
  const { error } = await supabase
    .from('item_subarticles')
    .update({ ...input, name: input.name.trim() })
    .eq('id', id)
  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function deleteItemSubarticle(id: string): Promise<void> {
  const { error } = await supabase.from('item_subarticles').delete().eq('id', id)
  if (error) throw new Error(supabaseErrorMessage(error))
}
