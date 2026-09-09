import { AuthForm } from '@/features/auth/auth-form'
import { RedirectIfAuthed } from '@/features/auth/require-session'
import { ThemeToggle } from '@/features/theme/theme-toggle'

export function LoginPage() {
  return (
    <RedirectIfAuthed>
      <section className="auth-shell">
        <div className="auth-theme-row">
          <ThemeToggle />
        </div>
        <header className="auth-header">
          <span className="auth-logo" aria-hidden="true">
            P
          </span>
          <h1>Planora</h1>
          <p className="auth-lede">
            Gestiona proyectos personales con presupuesto, ítems y progreso.
          </p>
        </header>
        <AuthForm />
      </section>
    </RedirectIfAuthed>
  )
}
