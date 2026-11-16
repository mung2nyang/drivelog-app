import { buildGuestBackupData, markBackupDone } from '../../../data/sync/guestBackup.ts'
import { saveFileToDevice } from '../../../shared/utils/saveFile.ts'
import type { JsonValue } from '../../../domain/jsonTypes.ts'

function hasItems(value: JsonValue | undefined) {
  return Array.isArray(value) && value.length > 0
}

function hasDays(logs: JsonValue | undefined) {
  if (!logs || typeof logs !== 'object' || Array.isArray(logs)) return false
  return Object.values(logs).some((days) => !!days && typeof days === 'object' && !Array.isArray(days) && Object.keys(days).length > 0)
}

export function guestHasRecords(): boolean {
  const data = buildGuestBackupData()
  return hasDays(data.workLogs) || hasItems(data.clients) || hasItems(data.expenses) || hasItems(data.invoices)
}

export async function saveGuestBackupFile(): Promise<string> {
  const data = buildGuestBackupData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const hint = await saveFileToDevice(blob, `운송내역_백업_${new Date().toISOString().slice(0, 10)}.json`)
  markBackupDone()
  return hint
}
