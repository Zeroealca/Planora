import { useState, type FormEvent } from 'react'
import {
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from '@/features/profile/currencies'
import { useProfile } from '@/features/profile/profile-context'

export function AccountSettingsForm() {
  const { currency, setCurrency, loading, error } = useProfile()
  const [draft, setDraft] = useState<CurrencyCode | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const selected = draft ?? currency

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setSaved(false)
    setSubmitting(true)
    try {
      await setCurrency(selected)
      setDraft(null)
      setSaved(true)
    } catch (err) {
      console.error(err)
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la moneda.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="page-status">Cargando preferencias…</p>
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="currency">Moneda de la cuenta</label>
        <select
          id="currency"
          name="currency"
          value={selected}
          onChange={(event) => {
            setDraft(event.target.value as CurrencyCode)
            setSaved(false)
          }}
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {CURRENCY_LABELS[code]}
            </option>
          ))}
        </select>
        <p className="field-hint">
          Se usa en presupuestos, ítems y opciones de todos tus proyectos.
        </p>
      </div>

      {formError ? (
        <p className="field-error" role="alert">
          {formError}
        </p>
      ) : null}
      {saved ? (
        <p className="alert alert-success" role="status">
          Moneda actualizada.
        </p>
      ) : null}

      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
