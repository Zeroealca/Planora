import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/supabase/errors'

function readAuthCallbackError(): string | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const queryParams = new URLSearchParams(window.location.search)
  const authError =
    hashParams.get('error_description') ?? queryParams.get('error_description')

  if (!authError) return null
  return decodeURIComponent(authError.replace(/\+/g, ' '))
}

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(() => readAuthCallbackError())
  const [status, setStatus] = useState('Confirmando cuenta…')

  useEffect(() => {
    if (error) return

    let cancelled = false
    let recovery = false

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY') {
        recovery = true
        setStatus('Enlace de recuperación válido…')
        void navigate('/settings?password=1', { replace: true })
        return
      }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && !recovery) {
        void navigate('/projects', { replace: true })
      }
    })

    void supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (cancelled || recovery) return
      if (sessionError) {
        setError(authErrorMessage(sessionError.message))
        return
      }
      if (sessionData.session) {
        void navigate('/projects', { replace: true })
      }
    })

    const timeout = window.setTimeout(() => {
      if (cancelled || recovery) return
      setError((current) => current ?? 'El enlace expiró o no es válido. Inicia sesión de nuevo.')
    }, 12000)

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
      window.clearTimeout(timeout)
    }
  }, [error, navigate])

  if (error) {
    return (
      <section className="auth-shell stack">
        <h1>No se pudo confirmar</h1>
        <p className="field-error" role="alert">
          {error}
        </p>
        <Link className="btn btn-primary" to="/login">
          Volver al inicio de sesión
        </Link>
      </section>
    )
  }

  return (
    <section className="auth-shell stack">
      <h1>{status}</h1>
      <p className="muted">Espera un momento mientras verificamos tu enlace.</p>
    </section>
  )
}
