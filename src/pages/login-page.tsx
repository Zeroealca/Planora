import { AuthForm } from '@/features/auth/auth-form'
import { RedirectIfAuthed } from '@/features/auth/require-session'

export function LoginPage() {
  return (
    <RedirectIfAuthed>
      <section className="page">
        <h1>Planora</h1>
        <p className="page-lede">
          Gestión de proyectos personales con presupuesto, ítems y progreso.
        </p>
        <AuthForm />
      </section>
    </RedirectIfAuthed>
  )
}
