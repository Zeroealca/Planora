import { Navigate, Outlet, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from './auth-context'
import { locationDestination, safePostLoginDestination } from './post-login-navigation'

export function RequireSession() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p className="page-status">Comprobando sesión…</p>
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: locationDestination(location) }} />
  }

  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p className="page-status">Comprobando sesión…</p>
  }

  if (session) {
    const state = location.state as { from?: unknown } | null
    return <Navigate to={safePostLoginDestination(state?.from)} replace />
  }

  return children
}
