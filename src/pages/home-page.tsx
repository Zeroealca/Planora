import { Navigate } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { GeneralDashboard } from '@/features/dashboard/general-dashboard'

export function HomePage() {
  const { session, loading } = useAuth()

  if (loading) {
    return <p className="page-status">Cargando…</p>
  }

  if (!session) return <Navigate to="/login" replace />

  return <GeneralDashboard />
}
