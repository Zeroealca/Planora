import { useSearchParams } from 'react-router'
import { AccountSettingsForm } from '@/features/profile/account-settings-form'
import { ChangePasswordForm } from '@/features/auth/change-password-form'
import { useTheme } from '@/features/theme/use-theme'

export function SettingsPage() {
  const { theme } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const fromRecovery = searchParams.get('password') === '1'

  return (
    <div className="page">
      <header className="page-header">
        <h1>Cuenta</h1>
        <p className="muted">Preferencias globales de tu perfil.</p>
      </header>

      {fromRecovery ? (
        <p className="alert alert-success" role="status">
          Elige una contraseña nueva para terminar la recuperación.
        </p>
      ) : null}

      <ChangePasswordForm
        title={fromRecovery ? 'Nueva contraseña' : 'Cambiar contraseña'}
        submitLabel={fromRecovery ? 'Guardar y continuar' : 'Guardar contraseña'}
        onSuccess={() => {
          if (fromRecovery) {
            setSearchParams({}, { replace: true })
          }
        }}
      />

      <section className="stack card" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Apariencia</h2>
        <p className="muted">
          Usa el botón flotante (sol/luna) para cambiar el tema. Ahora mismo:{' '}
          {theme === 'dark' ? 'oscuro' : 'claro'}.
        </p>
      </section>

      <AccountSettingsForm />
    </div>
  )
}
