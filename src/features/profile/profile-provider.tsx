import { useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_CURRENCY, type CurrencyCode } from '@/features/profile/currencies'
import { fetchProfile, updateProfileCurrency } from '@/features/profile/profile-api'
import { useAuth } from '@/features/auth/auth-context'
import type { Profile } from '@/types/domain'
import { ProfileContext } from './profile-context'

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!user) return
    setError(null)
    try {
      setProfile(await fetchProfile(user.id))
    } catch (err) {
      console.error(err)
      setProfile(null)
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu perfil.')
    }
  }

  useEffect(() => {
    if (!user) return

    let cancelled = false
    void fetchProfile(user.id).then(
      (data) => {
        if (cancelled) return
        setProfile(data)
        setError(null)
      },
      (err: unknown) => {
        if (cancelled) return
        console.error(err)
        setProfile(null)
        setError(err instanceof Error ? err.message : 'No se pudo cargar tu perfil.')
      },
    )

    return () => {
      cancelled = true
    }
  }, [user])

  async function setCurrency(currency: CurrencyCode) {
    if (!user) return
    const updated = await updateProfileCurrency(user.id, currency)
    setProfile(updated)
    setError(null)
  }

  const effectiveProfile =
    user && profile?.id === user.id ? profile : null
  const currency = effectiveProfile?.currency_code ?? DEFAULT_CURRENCY
  const loading = Boolean(user) && effectiveProfile === null && error === null

  return (
    <ProfileContext.Provider
      value={{ profile: effectiveProfile, currency, loading, error, setCurrency, reload }}
    >
      {children}
    </ProfileContext.Provider>
  )
}
