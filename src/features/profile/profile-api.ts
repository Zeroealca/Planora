import { supabase } from '@/lib/supabase/client'
import { mapProfile } from '@/lib/supabase/mappers'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import type { CurrencyCode, Profile } from '@/types/domain'

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  return mapProfile(data)
}

export async function updateProfileCurrency(
  userId: string,
  currencyCode: CurrencyCode,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ currency_code: currencyCode })
    .eq('id', userId)
    .select('*')
    .single()

  if (error) throw new Error(supabaseErrorMessage(error))
  return mapProfile(data)
}
