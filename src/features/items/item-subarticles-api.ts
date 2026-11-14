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

export async function createItemSubarticles(
  itemId: string,
  inputs: readonly ItemSubarticleInput[],
): Promise<ItemSubarticle[]> {
  if (inputs.length === 0) return []
  const { data, error } = await supabase
    .from('item_subarticles')
    .insert(inputs.map((input) => ({ item_id: itemId, ...input, name: input.name.trim() })))
    .select()
  if (error) throw new Error(supabaseErrorMessage(error))
  return data.map(mapItemSubarticle)
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
