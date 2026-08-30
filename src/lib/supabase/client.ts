import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function looksLikeApiUrl(value: string | undefined): boolean {
  if (!value) return false
  try {
    const host = new URL(value).hostname
    return host.endsWith('.supabase.co') || host.endsWith('.supabase.in')
  } catch {
    return false
  }
}

export const isSupabaseConfigured = Boolean(url && anonKey && looksLikeApiUrl(url))

export const supabase = createClient<Database>(
  looksLikeApiUrl(url) ? url! : 'https://unavailable.local',
  anonKey || 'unavailable',
)
