export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function parseCost(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : Number.NaN
}

export function costInputValue(value: number | null): string {
  return value == null ? '' : String(value)
}
