import { Link, Outlet } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase/client'
import { PwaUpdateBanner } from './pwa-update-banner'

export function AppLayout() {
  const { session } = useAuth()

  return (
    <div className={session ? 'app-shell' : 'app-shell app-shell-guest'}>
      {session ? (
        <header className="app-header">
          <Link to="/projects" className="app-brand">
            Planora
          </Link>
          <nav className="app-nav">
            <Link to="/projects">Proyectos</Link>
            <Link to="/settings">Cuenta</Link>
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
        </header>
      ) : null}
      <PwaUpdateBanner />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
