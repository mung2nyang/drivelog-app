// @ts-check

/** @typedef {{ mode: 'back' } | { mode: 'replace', to: string }} WorkLogCloseTarget */

/**
 * @param {{ from?: string } | null | undefined} locationState
 * @param {string} [logId]
 * @param {string} [dateKey]
 * @returns {WorkLogCloseTarget}
 */
export function resolveWorkLogCloseTarget(locationState, logId = 'main', dateKey = '') {
  if (locationState?.from === 'calendar' || locationState?.from === 'home') return { mode: 'back' }
  const [year, month] = dateKey.split('-').map(Number)
  const monthQuery = year && month ? `?y=${year}&m=${month - 1}` : ''
  if (logId && logId !== 'main') {
    return { mode: 'replace', to: `/app/logs/${encodeURIComponent(logId)}${monthQuery}` }
  }
  return { mode: 'replace', to: `/app/calendar${monthQuery}` }
}
