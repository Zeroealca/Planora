import { Link, Outlet } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase/client'
import { PwaUpdateBanner } from './pwa-update-banner'

export function AppLayout() {
  const { session } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to={session ? '/projects' : '/'} className="app-brand">
          Planora
        </Link>
        {session ? (
          <nav className="app-nav">
            <Link to="/projects">Proyectos</Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                void supabase.auth.signOut()
              }}
            >
              Cerrar sesión
            </button>
          </nav>
        ) : null}
      </header>
      <PwaUpdateBanner />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
