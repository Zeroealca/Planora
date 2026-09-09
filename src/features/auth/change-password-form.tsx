import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/supabase/errors'
import { PasswordInput } from '@/features/auth/password-input'

export function ChangePasswordForm({
  title = 'Cambiar contraseña',
  submitLabel = 'Guardar contraseña',
  onSuccess,
}: {
  title?: string
  submitLabel?: string
  onSuccess?: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(authErrorMessage(updateError.message))
        return
      }
      setPassword('')
      setConfirm('')
      setInfo('Contraseña actualizada.')
      onSuccess?.()
    } catch (err) {
      console.error(err)
      setError('No hay conexión. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="stack card" onSubmit={onSubmit} aria-labelledby="change-password-heading">
      <h2 id="change-password-heading">{title}</h2>
      <div className="field">
        <label htmlFor="new-password">Nueva contraseña</label>
        <PasswordInput
          id="new-password"
          name="new-password"
          autoComplete="new-password"
          minLength={6}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="confirm-password">Confirmar contraseña</label>
        <PasswordInput
          id="confirm-password"
          name="confirm-password"
          autoComplete="new-password"
          minLength={6}
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="alert alert-success" role="status">
          {info}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : submitLabel}
      </button>
    </form>
  )
}
