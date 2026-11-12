// @ts-check
/** @typedef {import('../../../domain/jsonTypes.ts').JsonValue} JsonValue */
/** @typedef {import('../../../domain/clientTypes.ts').ClientLike} ClientLike */

/** @param {JsonValue|undefined} value */
export function dash(value) {
  const text = String(value || '').trim()
  return text || '-'
}

/**
 * @param {number} year
 * @param {number} monthIndex
 */
export function buildReportFileName(year, monthIndex) {
  return `${year}년_${monthIndex + 1}월_운송비내역서.pdf`
}

/**
 * @param {number} year
 * @param {number} monthIndex
 * @param {string} clientFilter
 */
export function buildDetailReportFileName(year, monthIndex, clientFilter) {
  const suffix = clientFilter === 'ALL' ? '전체' : clientFilter
  return `${year}년_${monthIndex + 1}월_운송비내역서(세부)_${suffix}.pdf`
}

/**
 * @param {'summary'|'detail'} viewMode
 * @param {number} year
 * @param {number} monthIndex
 * @param {string} clientFilter
 */
export function reportBaseFileName(viewMode, year, monthIndex, clientFilter) {
  return (viewMode === 'detail'
    ? buildDetailReportFileName(year, monthIndex, clientFilter)
    : buildReportFileName(year, monthIndex)).replace(/\.pdf$/, '')
}

/**
 * @param {'summary'|'detail'} viewMode
 * @param {string} clientFilter
 * @returns {string}
 */
export function getReportShareCompanyName(viewMode, clientFilter) {
  return viewMode === 'detail' && clientFilter !== 'ALL' ? clientFilter : '거래처'
}

/**
 * @param {'summary'|'detail'} viewMode
 * @param {string} clientFilter
 * @param {Array<ClientLike>|null|undefined} clients
 * @returns {{ name: string, phone: string } | null}
 */
export function getDetailReportClientContact(viewMode, clientFilter, clients) {
  if (viewMode !== 'detail' || clientFilter === 'ALL') return null
  const client = (clients || []).find((item) => item.companyName === clientFilter)
  return client?.phone ? { name: client.companyName, phone: client.phone } : null
}
