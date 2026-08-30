export function parseNumeric(value: string | number | null): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function supabaseErrorMessage(error: { message: string } | null): string {
  if (!error) return 'Algo salió mal. Inténtalo de nuevo.'
  return error.message
}

export function authErrorMessage(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('email not confirmed')) {
    return 'Confirma tu cuenta con el enlace del correo antes de entrar.'
  }
  if (lower.includes('invalid login')) return 'Email o contraseña incorrectos.'
  if (lower.includes('user already registered')) return 'Ese email ya tiene una cuenta.'
  if (lower.includes('password')) return 'La contraseña no es válida (mínimo 6 caracteres).'
  if (lower.includes('email')) return 'Revisa el email e inténtalo de nuevo.'
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'No hay conexión. Comprueba la red e inténtalo de nuevo.'
  }
  return 'No se pudo completar la autenticación. Inténtalo de nuevo.'
}
