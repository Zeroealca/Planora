import { useState, type FormEvent } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/supabase/errors'

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
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
      if (mode === 'login') {
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
        })
        if (signUpError) {
          setError(authErrorMessage(signUpError.message))
        } else if (!data.session) {
          setInfo('Revisa tu email para confirmar la cuenta.')
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
    <form className="stack" onSubmit={onSubmit}>
      <div className="segmented" role="group" aria-label="Tipo de acceso">
        <button
          type="button"
          className={mode === 'login' ? 'segmented-active' : ''}
          onClick={() => setMode('login')}
        >
          Entrar
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'segmented-active' : ''}
          onClick={() => setMode('register')}
        >
          Crear cuenta
        </button>
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={6}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="alert" role="status">
          {info}
        </p>
      ) : null}

      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting
          ? 'Enviando…'
          : mode === 'login'
            ? 'Entrar'
            : 'Crear cuenta'}
      </button>
    </form>
  )
}
