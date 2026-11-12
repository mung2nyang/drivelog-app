// @ts-check
import { useEffect, useState } from 'react'
import { fetchDailyInspection } from '../../../data/sync/dailyInspections.ts'
import { subscribeDailyInspectionChanges } from '../../../data/sync/dailyInspectionChanges.ts'
import { vehicleSupabaseIdForLog } from '../../../data/sync/mainDayLogRouting.ts'

/**
 * @param {{ ownerKey: string, dateKey: string, enabled: boolean, isOff: boolean }} input
 * @returns {boolean}
 */
export default function useTodayInspectionMissing({ ownerKey, dateKey, enabled, isOff }) {
  const vehicleId = vehicleSupabaseIdForLog(ownerKey, 'main')
  const active = enabled && !isOff && ownerKey !== 'guest' && vehicleId != null
  const loadKey = `${ownerKey}|${vehicleId}|${dateKey}`
  const [result, setResult] = useState(/** @type {{ key: string, missing: boolean }|null} */ (null))

  useEffect(() => {
    if (!active || vehicleId == null) return undefined
    let alive = true
    fetchDailyInspection(vehicleId, dateKey)
      .then((record) => { if (alive) setResult({ key: loadKey, missing: record == null }) })
      .catch((error) => { console.error('[useTodayInspectionMissing] 불러오기 실패:', error) })
    return () => { alive = false }
  }, [active, vehicleId, dateKey, loadKey])

  useEffect(() => {
    if (!active || vehicleId == null) return undefined
    return subscribeDailyInspectionChanges((change) => {
      if (String(change.vehicleId) === String(vehicleId) && change.workDate === dateKey) setResult({ key: loadKey, missing: !change.saved })
    })
  }, [active, vehicleId, dateKey, loadKey])

  return active && result?.key === loadKey && result.missing
}
