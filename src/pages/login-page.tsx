import { AuthForm } from '@/features/auth/auth-form'
import { RedirectIfAuthed } from '@/features/auth/require-session'

export function LoginPage() {
  return (
    <RedirectIfAuthed>
      <section className="auth-shell">
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
