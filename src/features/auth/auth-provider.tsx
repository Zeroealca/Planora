import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let cancelled = false

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    void supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (cancelled) return
      if (error) {
        console.error(error)
        setSession(null)
      } else {
        setSession(sessionData.session)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading }}
    >
      {children}
    </AuthContext.Provider>
  )
}
