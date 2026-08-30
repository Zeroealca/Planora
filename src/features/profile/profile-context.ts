import { createContext, useContext } from 'react'
import type { CurrencyCode, Profile } from '@/types/domain'

export type ProfileState = {
  profile: Profile | null
  currency: CurrencyCode
  loading: boolean
  error: string | null
  setCurrency: (currency: CurrencyCode) => Promise<void>
  reload: () => Promise<void>
}

export const ProfileContext = createContext<ProfileState | null>(null)

export function useProfile(): ProfileState {
  const value = useContext(ProfileContext)
  if (!value) {
    throw new Error('useProfile must be used within ProfileProvider')
  }
  return value
}
