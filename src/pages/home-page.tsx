import { Navigate } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'

export function HomePage() {
  const { session, loading } = useAuth()

  if (loading) {
    return <p className="page-status">Cargando…</p>
  }

  return <Navigate to={session ? '/projects' : '/login'} replace />
}
