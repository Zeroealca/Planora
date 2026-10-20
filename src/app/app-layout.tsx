import { Suspense, useEffect, useId, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
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
  const location = useLocation()
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLElement>(null)

  function closeMenu({ restoreFocus = false } = {}) {
    setMenuOpen(false)
    if (restoreFocus) requestAnimationFrame(() => menuToggleRef.current?.focus())
  }

  useEffect(() => {
    if (!menuOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu({ restoreFocus: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus())
  }, [menuOpen])

  function isCurrent(path: string) {
    return path === '/' ? location.pathname === path : location.pathname.startsWith(path)
  }

  return (
    <div className={session ? 'app-shell' : 'app-shell app-shell-guest'}>
      {session ? (
        <header className="app-header">
          <Link to="/" className="app-brand" onClick={() => closeMenu()}>
            Planora
          </Link>
          <button
            type="button"
            className="btn btn-ghost app-nav-toggle"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuOpen((open) => !open)}
            ref={menuToggleRef}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
          <nav
            id={menuId}
            className={menuOpen ? 'app-nav app-nav-open' : 'app-nav'}
            aria-label="Principal"
            ref={menuRef}
          >
            <Link to="/" aria-current={isCurrent('/') ? 'page' : undefined} onClick={() => closeMenu({ restoreFocus: true })}>
              Inicio
            </Link>
            <Link to="/budget" aria-current={isCurrent('/budget') ? 'page' : undefined} onClick={() => closeMenu({ restoreFocus: true })}>
              Presupuesto
            </Link>
            <Link to="/projects" aria-current={isCurrent('/projects') ? 'page' : undefined} onClick={() => closeMenu({ restoreFocus: true })}>
              Proyectos
            </Link>
            <Link to="/settings" aria-current={isCurrent('/settings') ? 'page' : undefined} onClick={() => closeMenu({ restoreFocus: true })}>
              Cuenta
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                closeMenu({ restoreFocus: true })
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
        <Suspense fallback={<p className="page-status" role="status">Cargando página…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <ThemeToggle />
    </div>
  )
}
