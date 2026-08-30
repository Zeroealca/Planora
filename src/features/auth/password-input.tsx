import { useState, type ChangeEvent } from 'react'

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.5 10.67A3 3 0 0 0 12 15a3 3 0 0 0 2.83-2M7.36 7.37C8.93 6.34 10.4 5.8 12 5.8c6.5 0 10 6.2 10 6.2a18.2 18.2 0 0 1-3.16 4.12M5.6 5.6A18.8 18.8 0 0 0 2 12s3.5 7 10 7c1.57 0 3.07-.38 4.45-1.05"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PasswordInput({
  id,
  name,
  value,
  autoComplete,
  minLength,
  required,
  onChange,
}: {
  id: string
  name: string
  value: string
  autoComplete: 'current-password' | 'new-password'
  minLength?: number
  required?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="input-group">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="input-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}
