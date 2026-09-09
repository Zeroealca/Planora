import { AccountSettingsForm } from '@/features/profile/account-settings-form'
import { ThemeToggle } from '@/features/theme/theme-toggle'
import { useTheme } from '@/features/theme/use-theme'

export function SettingsPage() {
  const { theme } = useTheme()

  return (
    <div className="page">
      <header className="page-header">
        <h1>Cuenta</h1>
        <p className="muted">Preferencias globales de tu perfil.</p>
      </header>

      <section className="stack card" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Apariencia</h2>
        <p className="muted">
          El tema lo eliges tú en la app. Ahora mismo:{' '}
          {theme === 'dark' ? 'oscuro' : 'claro'}.
        </p>
        <div className="row">
          <ThemeToggle className="btn" />
        </div>
      </section>

      <AccountSettingsForm />
    </div>
  )
}
