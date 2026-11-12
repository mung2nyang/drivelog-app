import { commitSettings } from '../store/commitHelpers.ts'
import { normalizeSettings } from '../../domain/practiceSettings.ts'
import { readOwnerProfile, readOwnerSettings } from '../store/ownerDataHooks.ts'
import {
  assertSessionStillCurrent,
  blockedReasonForOwnerDataWrite,
  captureSession,
  getCloudOwnerKey,
  getCloudUserId,
} from '../cloud/cloudSession.ts'
import { upsertProfileOnSupabase } from './profileCloudCommit.ts'
import type { FinanceSettings } from '../../domain/financeTypes.ts'

export type SettingsPatch = FinanceSettings | ((current: FinanceSettings) => FinanceSettings)

const saveTails: Map<string, Promise<void>> = new Map()

export function savePracticeSettings(ownerKey: string, patch?: SettingsPatch): Promise<FinanceSettings> {
  const previous = saveTails.get(ownerKey) || Promise.resolve()
  const run = previous.then(() => saveSettingsNow(ownerKey, patch))
  const tail: Promise<void> = run.then(() => undefined, () => undefined)
  saveTails.set(ownerKey, tail)
  void tail.then(() => { if (saveTails.get(ownerKey) === tail) saveTails.delete(ownerKey) })
  return run
}

async function saveSettingsNow(ownerKey: string, patch?: SettingsPatch) {
  const current = readOwnerSettings(ownerKey)
  const changes = typeof patch === 'function' ? patch(current) : patch
  const next = normalizeSettings({ ...current, ...(changes || {}) })
  if (getCloudOwnerKey() !== ownerKey) return commitSettings(ownerKey, next)
  const userId = getCloudUserId()
  const blocked = blockedReasonForOwnerDataWrite({ ownerKey, userId })
  if (blocked) throw new Error(blocked)
  const captured = captureSession()
  await upsertProfileOnSupabase((userId) as string, readOwnerProfile(ownerKey), next, { ownFieldsOnly: userId !== ownerKey })
  assertSessionStillCurrent(captured)
  return commitSettings(ownerKey, next)
}

export function applyTheme(theme?: 'light' | 'dark') {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  else document.documentElement.removeAttribute('data-theme')
  try { localStorage.setItem('lastTheme', theme === 'dark' ? 'dark' : 'light') } catch { }
}

export function phoneTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function settingsTheme(settings: FinanceSettings, phone: 'light' | 'dark'): 'light' | 'dark' {
  if (settings.themeFollowPhone === false) return settings.theme === 'dark' ? 'dark' : 'light'
  return phone
}

export function watchPhoneTheme(onChange: (theme: 'light' | 'dark') => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => onChange(query.matches ? 'dark' : 'light')
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
