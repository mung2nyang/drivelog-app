// @ts-check
import { supabase } from '../data/cloud/supabaseClient.ts'
import { getCloudUserId } from '../data/cloud/cloudSession.ts'

export const MAX_REPORTS_PER_LOAD = 10
/** @type {Set<string>} */
const sentMessages = new Set()

/** @param {string|undefined} text @param {number} max */
function cut(text, max) {
  return String(text ?? '').slice(0, max)
}

/**
 * @param {{ message?: string, stack?: string }|string|null|undefined} value
 * @returns {{ message: string, stack: string }}
 */
export function describeError(value) {
  if (typeof value === 'string') return { message: value, stack: '' }
  if (value && typeof value === 'object') return { message: String(value.message ?? ''), stack: String(value.stack ?? '') }
  return { message: String(value ?? ''), stack: '' }
}

/**
 * @param {{ kind: 'render'|'error'|'unhandledrejection', message?: string, stack?: string }} report
 * @returns {boolean}
 */
export function reportClientError({ kind, message = '', stack = '' }) {
  if (!getCloudUserId() || sentMessages.size >= MAX_REPORTS_PER_LOAD) return false
  const text = cut(message, 500)
  if (sentMessages.has(text)) return false
  sentMessages.add(text)
  try {
    void supabase.from('client_errors').insert({
      kind,
      message: text,
      stack: cut(stack, 2000),
      path: cut(window.location.pathname, 300),
      user_agent: cut(window.navigator.userAgent, 200),
    }).then(() => {}, () => {})
  } catch {
  }
  return true
}

/**
 * @typedef {{ error?: { message?: string, stack?: string }|string|null, message?: string, reason?: { message?: string, stack?: string }|string|null }} ErrorLikeEvent
 * @param {{ addEventListener: (type: 'error'|'unhandledrejection', listener: (event: ErrorLikeEvent) => void) => void }} win
 */
export function installErrorReporting(win) {
  win.addEventListener('error', (event) => {
    reportClientError({ kind: 'error', ...describeError(event.error ?? event.message) })
  })
  win.addEventListener('unhandledrejection', (event) => {
    reportClientError({ kind: 'unhandledrejection', ...describeError(event.reason) })
  })
}

export function resetErrorReportsForTests() {
  sentMessages.clear()
}
