import { supabase } from '@/lib/supabase/client'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import { mapOption } from '@/lib/supabase/mappers'
import type { ItemOption } from '@/types/domain'

export const OPTION_IMAGE_BUCKET = 'item-option-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export type OptionInput = {
  name: string
  brand: string | null
  model: string | null
  price: number | null
  store: string | null
  product_url: string | null
  description: string | null
  specifications: string | null
  notes: string | null
}

export async function createOption(
  itemId: string,
  input: OptionInput,
): Promise<ItemOption> {
  const { data, error } = await supabase
    .from('item_options')
    .insert({
      item_id: itemId,
      name: input.name.trim(),
      brand: input.brand,
      model: input.model,
      price: input.price,
      store: input.store,
      product_url: input.product_url,
      description: input.description,
      specifications: input.specifications,
      notes: input.notes,
      selected: false,
    })
    .select()
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  return mapOption(data)
}

export async function updateOption(
  optionId: string,
  input: OptionInput,
): Promise<void> {
  const { error } = await supabase
    .from('item_options')
    .update({
      name: input.name.trim(),
      brand: input.brand,
      model: input.model,
      price: input.price,
      store: input.store,
      product_url: input.product_url,
      description: input.description,
      specifications: input.specifications,
      notes: input.notes,
    })
    .eq('id', optionId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function deleteOption(option: ItemOption): Promise<void> {
  if (option.image_url) {
    await supabase.storage.from(OPTION_IMAGE_BUCKET).remove([option.image_url])
  }
  const { error } = await supabase.from('item_options').delete().eq('id', option.id)
  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function selectOption(optionId: string): Promise<void> {
  const { error } = await supabase.rpc('select_item_option', {
    p_option_id: optionId,
  })
  if (error) throw new Error(supabaseErrorMessage(error))
}

export function optionImagePath(
  userId: string,
  projectId: string,
  itemId: string,
  optionId: string,
): string {
  return `${userId}/${projectId}/${itemId}/${optionId}`
}

export function validateOptionImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Usa una imagen JPG, PNG o WebP.'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'La imagen no puede superar 5 MB.'
  }
  return null
}

export async function uploadOptionImage(
  path: string,
  file: File,
  previousPath: string | null,
): Promise<string> {
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(OPTION_IMAGE_BUCKET).remove([previousPath])
  }

  const { error } = await supabase.storage
    .from(OPTION_IMAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(supabaseErrorMessage(error))

  const { error: updateError } = await supabase
    .from('item_options')
    .update({ image_url: path })
    .eq('id', path.split('/').at(-1) ?? '')

  if (updateError) throw new Error(supabaseErrorMessage(updateError))
  return path
}

export async function signedImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  if (path.startsWith('http')) return path
  const { data, error } = await supabase.storage
    .from(OPTION_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error) {
    console.error(error)
    return null
  }
  return data.signedUrl
}
