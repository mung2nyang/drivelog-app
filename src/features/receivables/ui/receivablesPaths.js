// @ts-check

/** @param {string} client @param {string} monthKey @param {string} [search] */
export function receivablesDetailPath(client, monthKey, search = '') {
  return `/app/receivables/${encodeURIComponent(client)}/${monthKey}${search}`
}

/** @param {string} [search] */
export function receivablesListPath(search = '') {
  return `/app/receivables${search}`
}

/** @param {string} [month] @returns {string|null} */
export function parseMonthParam(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null
  return month
}

/** @param {string} [client] */
export function parseClientParam(client) {
  if (!client) return ''
  try {
    return decodeURIComponent(client)
  } catch {
    return ''
  }
}
