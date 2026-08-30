export const DEFAULT_CURRENCY = 'USD' as const

export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'MXN',
  'COP',
  'CLP',
  'PEN',
  'ARS',
  'GBP',
  'BRL',
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: 'Dólar estadounidense (USD)',
  EUR: 'Euro (EUR)',
  MXN: 'Peso mexicano (MXN)',
  COP: 'Peso colombiano (COP)',
  CLP: 'Peso chileno (CLP)',
  PEN: 'Sol peruano (PEN)',
  ARS: 'Peso argentino (ARS)',
  GBP: 'Libra esterlina (GBP)',
  BRL: 'Real brasileño (BRL)',
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}
