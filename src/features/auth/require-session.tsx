import { Navigate, Outlet, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from './auth-context'

export function RequireSession() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p className="page-status">Comprobando sesión…</p>
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return <p className="page-status">Comprobando sesión…</p>
  }

  if (session) {
    return <Navigate to="/projects" replace />
  }

  return children
}
