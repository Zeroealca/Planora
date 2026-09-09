import { useState, type FormEvent } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { getAuthRedirectUrl } from '@/lib/supabase/auth-redirect'
import { authErrorMessage } from '@/lib/supabase/errors'
import { PasswordInput } from './password-input'

type AuthMode = 'login' | 'register' | 'recover'

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!isSupabaseConfigured) {
    return (
      <p className="alert" role="status">
        Configura <code>VITE_SUPABASE_URL</code> y{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> en <code>.env</code>. La URL debe
        ser la de <strong>Settings → API</strong> (p. ej.{' '}
        <code>https://xxxx.supabase.co</code>), no la del dashboard.
      </p>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    try {
      if (mode === 'recover') {
        const { error: recoverError } = await supabase.auth.resetPasswordForEmail(
          email,
          { redirectTo: getAuthRedirectUrl() },
        )
        if (recoverError) {
          setError(authErrorMessage(recoverError.message))
        } else {
          setInfo(
            'Si existe una cuenta con ese email, te enviamos un enlace para restablecer la contraseña.',
          )
        }
      } else if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          setError(authErrorMessage(signInError.message))
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        })
        if (signUpError) {
          setError(authErrorMessage(signUpError.message))
        } else if (!data.session) {
          setInfo(
            'Te enviamos un correo de confirmación. Abre el enlace para activar tu cuenta.',
          )
        }
      }
    } catch (err) {
      console.error(err)
      setError('No hay conexión. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="stack auth-form" onSubmit={onSubmit}>
      {mode !== 'recover' ? (
        <div className="segmented" role="group" aria-label="Tipo de acceso">
          <button
            type="button"
            className={mode === 'login' ? 'segmented-active' : ''}
            onClick={() => {
              setMode('login')
              setError(null)
              setInfo(null)
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'segmented-active' : ''}
            onClick={() => {
              setMode('register')
              setError(null)
              setInfo(null)
            }}
          >
            Crear cuenta
          </button>
        </div>
      ) : (
        <h2 className="auth-recover-title">Recuperar contraseña</h2>
      )}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="tu@email.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      {mode !== 'recover' ? (
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === 'register' ? (
            <p className="field-hint">Mínimo 6 caracteres.</p>
          ) : null}
        </div>
      ) : (
        <p className="field-hint">
          Te enviaremos un enlace para elegir una contraseña nueva.
        </p>
      )}

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

      <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
        {submitting
          ? 'Enviando…'
          : mode === 'login'
            ? 'Entrar'
            : mode === 'register'
              ? 'Crear cuenta'
              : 'Enviar enlace'}
      </button>

      {mode === 'login' ? (
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            setMode('recover')
            setError(null)
            setInfo(null)
            setPassword('')
          }}
        >
          ¿Olvidaste tu contraseña?
        </button>
      ) : null}

      {mode === 'recover' ? (
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            setMode('login')
            setError(null)
            setInfo(null)
          }}
        >
          Volver a entrar
        </button>
      ) : null}
    </form>
  )
}
