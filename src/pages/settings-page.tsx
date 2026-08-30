import { AccountSettingsForm } from '@/features/profile/account-settings-form'

export function SettingsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <h1>Cuenta</h1>
        <p className="muted">Preferencias globales de tu perfil.</p>
      </header>
      <AccountSettingsForm />
    </div>
  )
}
