export function receivablesDetailPath(client: string, monthKey: string, search: string = '') {
  return `/app/receivables/${encodeURIComponent(client)}/${monthKey}${search}`
}

export function receivablesListPath(search: string = '') {
  return `/app/receivables${search}`
}

export function parseMonthParam(month?: string): string|null {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null
  return month
}

export function parseClientParam(client?: string) {
  if (!client) return ''
  try {
    return decodeURIComponent(client)
  } catch {
    return ''
  }
}
