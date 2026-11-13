export type WorkLogCloseTarget = { mode: 'back' } | { mode: 'replace', to: string }

export function resolveWorkLogCloseTarget(locationState: { from?: string } | null | undefined, logId = 'main', dateKey = ''): WorkLogCloseTarget {
  if (locationState?.from === 'calendar' || locationState?.from === 'home') return { mode: 'back' }
  const [year, month] = dateKey.split('-').map(Number)
  const monthQuery = year && month ? `?y=${year}&m=${month - 1}` : ''
  if (logId && logId !== 'main') {
    return { mode: 'replace', to: `/app/logs/${encodeURIComponent(logId)}${monthQuery}` }
  }
  return { mode: 'replace', to: `/app/calendar${monthQuery}` }
}
