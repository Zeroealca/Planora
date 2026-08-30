export function formatMoney(value: number): string {
  return new Intl.NumberFormat('es', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2).replace(/\.?0+$/, '')}%`
}
