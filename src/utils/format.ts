import { DEFAULT_CURRENCY, type CurrencyCode } from '@/features/profile/currencies'
import { useProfile } from '@/features/profile/profile-context'

export function formatMoney(value: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat('es', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2).replace(/\.?0+$/, '')}%`
}

export function useFormatMoney() {
  const { currency } = useProfile()
  return (value: number) => formatMoney(value, currency)
}
