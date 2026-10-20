export function updateTransactionPeriodParams(
  params: URLSearchParams,
  period: string,
): URLSearchParams {
  const next = new URLSearchParams(params)
  next.set('period', period)
  next.delete('transaction')
  return next
}
