import { useEffect, useId, useState } from 'react'
import { Link, Outlet } from 'react-router'
import { IconClose, IconMenu } from '@/components/icons'
import { useAuth } from '@/features/auth/auth-context'
import { ThemeToggle } from '@/features/theme/theme-toggle'
import { PwaInstallBanner } from '@/features/pwa/pwa-install-banner'
import { supabase } from '@/lib/supabase/client'
import { PwaUpdateBanner } from './pwa-update-banner'

export function AppLayout() {
  const { session } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    if (!menuOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className={session ? 'app-shell' : 'app-shell app-shell-guest'}>
      {session ? (
        <header className="app-header">
          <Link to="/projects" className="app-brand" onClick={() => setMenuOpen(false)}>
            Planora
          </Link>
          <button
            type="button"
            className="btn btn-ghost app-nav-toggle"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
          <nav
            id={menuId}
            className={menuOpen ? 'app-nav app-nav-open' : 'app-nav'}
            aria-label="Principal"
          >
            <Link to="/projects" onClick={() => setMenuOpen(false)}>
              Proyectos
            </Link>
            <Link to="/settings" onClick={() => setMenuOpen(false)}>
              Cuenta
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMenuOpen(false)
                void supabase.auth.signOut()
              }}
            >
              Cerrar sesión
            </button>
          </nav>
        </header>
      ) : null}
      <PwaUpdateBanner />
      <PwaInstallBanner />
      <main className="app-main">
        <Outlet />
      </main>
      <ThemeToggle />
    </div>
  )
}
