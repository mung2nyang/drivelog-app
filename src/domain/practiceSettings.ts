import { normalizePinnedLocations } from './locationShortcuts.ts'
import { normalizeFixedRoutePresets, normalizeRunCountPresets } from './practicePresets.ts'
import { normalizePlatformPresets } from './platformPresets.ts'
import { normalizeDismissedNotices } from './dismissedNotices.ts'
import type { JsonValue } from './jsonTypes.ts'
import type { FinanceSettings, SubCarPracticeSettings } from './financeTypes.ts'

export * from './practicePresets.ts'

export const NOTIF_KINDS = ['overdue', 'today', 'driverInvite', 'backup', 'inquiryAnswer', 'adminInquiry']

function normalizeNotifOff(raw: JsonValue | undefined): Array<string> {
  if (!Array.isArray(raw)) return []
  return NOTIF_KINDS.filter((kind) => raw.includes(kind))
}

const defaults = {
  unitPrice: 0,
  theme: 'light',
  themeFollowPhone: true,
  inputMode: 'count',
  callDetail: false,
  paymentOn: false,
  timeOn: false,
  platformOn: false,
  distanceOn: false,
  cargoTonnageOn: false,
  dailyInspectionOn: false,
  fixedOn: true,
  fixedRouteOn: false,
  fixedRoutePresets: [],
  runCountToggle: false,
  runCountPresets: [1, 2, 3, 4, 5],
  subFixedOn: true,
  subFixedRouteOn: false,
  subFixedRoutePresets: [],
  subRunCountToggle: false,
  subRunCountPresets: [1, 2, 3, 4, 5],
  pinnedLocations: [],
  unbiseoDockOn: true,
}

function asBool(value: JsonValue | undefined, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function pickMessageTemplates(raw: JsonValue | undefined): { messageTemplates?: [string, string, string] } {
  if (!Array.isArray(raw) || raw.length !== 3 || !raw.every((item) => typeof item === 'string' && item.trim())) return {}
  return { messageTemplates: [String(raw[0]).trim(), String(raw[1]).trim(), String(raw[2]).trim()] }
}

function pickReportShareMessage(raw: JsonValue | undefined): { reportShareMessage?: string } {
  return typeof raw === 'string' && raw.trim() ? { reportShareMessage: raw.trim() } : {}
}

export function normalizeSettings(raw: FinanceSettings = {}): FinanceSettings {
  const inputMode = raw.inputMode === 'fare' ? 'fare' : 'count'
  const theme = raw.theme === 'dark' ? 'dark' : 'light'
  const fixedOn = asBool(raw.fixedOn, defaults.fixedOn)
  const callDetail = fixedOn ? asBool(raw.callDetail, defaults.callDetail) : true
  return {
    unitPrice: Math.max(0, parseInt(String(raw.unitPrice ?? ''), 10) || 0),
    theme,
    themeFollowPhone: asBool(raw.themeFollowPhone, defaults.themeFollowPhone),
    inputMode,
    callDetail,
    paymentOn: asBool(raw.paymentOn, defaults.paymentOn),
    timeOn: asBool(raw.timeOn, defaults.timeOn),
    platformOn: asBool(raw.platformOn, defaults.platformOn),
    distanceOn: asBool(raw.distanceOn, defaults.distanceOn),
    cargoTonnageOn: asBool(raw.cargoTonnageOn, defaults.cargoTonnageOn),
    dailyInspectionOn: asBool(raw.dailyInspectionOn, defaults.dailyInspectionOn),
    fixedOn,
    fixedRouteOn: asBool(raw.fixedRouteOn, defaults.fixedRouteOn),
    fixedRoutePresets: normalizeFixedRoutePresets(raw.fixedRoutePresets),
    runCountToggle: asBool(raw.runCountToggle, defaults.runCountToggle),
    runCountPresets: normalizeRunCountPresets(raw.runCountPresets),
    subFixedOn: asBool(raw.subFixedOn, fixedOn),
    subFixedRouteOn: asBool(raw.subFixedRouteOn, defaults.subFixedRouteOn),
    subFixedRoutePresets: normalizeFixedRoutePresets(raw.subFixedRoutePresets),
    subRunCountToggle: asBool(raw.subRunCountToggle, defaults.subRunCountToggle),
    subRunCountPresets: normalizeRunCountPresets(raw.subRunCountPresets),
    pinnedLocations: normalizePinnedLocations(raw.pinnedLocations),
    platformPresets: normalizePlatformPresets(raw.platformPresets),
    subCarSettings: normalizeSubCarSettingsMap(raw.subCarSettings, asBool(raw.subFixedOn, fixedOn)),
    notifOff: normalizeNotifOff(raw.notifOff),
    dismissedNotices: normalizeDismissedNotices(raw.dismissedNotices),
    unbiseoDockOn: asBool(raw.unbiseoDockOn, defaults.unbiseoDockOn),
    ...pickMessageTemplates(raw.messageTemplates),
    ...pickReportShareMessage(raw.reportShareMessage),
  }
}

export function normalizeCarSettings(raw: Partial<SubCarPracticeSettings> = {}, subFixedOn = true): SubCarPracticeSettings {
  return {
    inputMode: raw.inputMode === 'fare' ? 'fare' : 'count',
    callDetail: subFixedOn ? asBool(raw.callDetail, defaults.callDetail) : true,
    timeOn: asBool(raw.timeOn, defaults.timeOn),
    platformOn: asBool(raw.platformOn, defaults.platformOn),
    distanceOn: asBool(raw.distanceOn, defaults.distanceOn),
    cargoTonnageOn: asBool(raw.cargoTonnageOn, defaults.cargoTonnageOn),
    dailyInspectionOn: asBool(raw.dailyInspectionOn, defaults.dailyInspectionOn),
  }
}

export function defaultCarSettings(subFixedOn = true): SubCarPracticeSettings {
  return normalizeCarSettings({}, subFixedOn)
}

function normalizeSubCarSettingsMap(raw: JsonValue | undefined, subFixedOn: boolean): Record<string, SubCarPracticeSettings> {
  const map: Record<string, SubCarPracticeSettings> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return map
  Object.entries(raw).forEach(([carNumber, value]) => {
    const key = String(carNumber || '').trim()
    if (!key || !value || typeof value !== 'object' || Array.isArray(value)) return
    map[key] = normalizeCarSettings(value as Partial<SubCarPracticeSettings>, subFixedOn)
  })
  return map
}
