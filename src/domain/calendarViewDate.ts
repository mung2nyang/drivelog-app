export function viewDateFromSearchParams(searchParams: URLSearchParams): Date {
  const yParam = searchParams.get('y')
  const mParam = searchParams.get('m')
  const y = yParam === null ? NaN : parseInt(yParam, 10)
  const m = mParam === null ? NaN : parseInt(mParam, 10)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) return new Date()
  return new Date(y, m, 1)
}

export function searchParamsForViewDate(viewDate: Date): { y: string, m: string } {
  return { y: String(viewDate.getFullYear()), m: String(viewDate.getMonth()) }
}
