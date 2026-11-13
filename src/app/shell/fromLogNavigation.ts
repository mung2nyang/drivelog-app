import type { NavigateOptions, To } from 'react-router-dom'

export function parseAppLogPath(pathname: string) {
  const match = pathname.match(/^\/app\/logs\/([^/]+)\/day\/(\d{4}-\d{2}-\d{2})$/)
  if (!match) return null
  return { logId: decodeURIComponent(match[1]), dateKey: match[2] }
}

export function withFromLogState(pathname: string, to: To, options?: NavigateOptions) {
  const dest = typeof to === 'string' ? to : (to && typeof to === 'object' && 'pathname' in to ? String(to.pathname || '') : '')
  if (!dest.startsWith('/app/cars')) return options
  const fromLog = parseAppLogPath(pathname)
  if (!fromLog) return options
  return { ...options, state: { ...(options && options.state && typeof options.state === 'object' ? options.state : {}), fromLog } }
}
