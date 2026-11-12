// @ts-check
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { searchParamsForViewDate, viewDateFromSearchParams } from '../../../domain/calendarViewDate.ts'
import { resolveLogSettings } from '../../../domain/carSettingsScope.ts'
import { hasAnyDailyInspection } from '../../../data/sync/dailyInspections.ts'
import { vehicleSupabaseIdForLog } from '../../../data/sync/mainDayLogRouting.ts'
import { useOwnerSettings } from '../../../data/store/ownerDataHooks.ts'
import PageHeader from '../../../shared/ui/PageHeader.tsx'
import ReportPage from './ReportPage.jsx'
import DailyInspectionMonthSheet from './DailyInspectionMonthSheet.jsx'
import TaxInvoiceTab from './TaxInvoiceTab.jsx'
import './documents.css'
import { useSession } from '../../../data/cloud/sessionContext.ts'

/**
 * @param {Object} props
 * @param {() => void} [props.onBack]
 * @param {(() => void)} [props.onOpenMenu]
 * @param {boolean} [props.isEmployedDriver]
 */
export default function DocumentIssuePage({ onBack, onOpenMenu, isEmployedDriver = false }) {
  const { ownerKey } = useSession()
  const { logId: rawLogId } = useParams()
  const logKey = (rawLogId ? decodeURIComponent(rawLogId) : '') || 'main'
  const settings = resolveLogSettings(useOwnerSettings(ownerKey), logKey === 'main' ? '' : logKey)
  const vehicleId = vehicleSupabaseIdForLog(ownerKey, logKey)
  const [hasRecords, setHasRecords] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab = tabParam === 'tax' || tabParam === 'report' || tabParam === 'inspection' ? tabParam : null
  const viewDate = useMemo(() => viewDateFromSearchParams(searchParams), [searchParams])

  /** @param {Record<string, string>} changes */
  function replaceParams(changes) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(changes)) next.set(key, value)
      return next
    }, { replace: true })
  }
  /** @param {'tax'|'report'|'inspection'} key */
  const setTab = (key) => { replaceParams({ tab: key }) }
  /** @param {Date} next */
  const setViewDate = (next) => { replaceParams(searchParamsForViewDate(next)) }

  useEffect(() => {
    if (ownerKey === 'guest' || vehicleId == null) return undefined
    let alive = true
    hasAnyDailyInspection(vehicleId)
      .then((found) => { if (alive) setHasRecords(found) })
      .catch((error) => { console.error('[DocumentIssuePage] 점검표 확인 실패:', error) })
    return () => { alive = false }
  }, [ownerKey, vehicleId])

  const inspectionVisible = ownerKey !== 'guest' && vehicleId != null && (!!settings.dailyInspectionOn || hasRecords)
  /** @type {Array<['tax'|'report'|'inspection', string]>} */
  const visible = [
    ...(isEmployedDriver ? [] : /** @type {Array<['tax', string]>} */ ([['tax', '세금계산서']])),
    ['report', '운송비 내역서'],
    ...(inspectionVisible ? /** @type {Array<['inspection', string]>} */ ([['inspection', '일상점검표']]) : []),
  ]
  const defaultTab = isEmployedDriver ? (inspectionVisible ? 'inspection' : 'report') : 'tax'
  const activeTab = tab && visible.some(([key]) => key === tab) ? tab : defaultTab
  const tabs = visible.length > 1 ? (
    <div className="doc-tabs" role="tablist" aria-label="서류 종류">
      {visible.map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={activeTab === key} className={`doc-tab${activeTab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
          {label}
        </button>
      ))}
    </div>
  ) : null

  if (activeTab === 'report') {
    return <ReportPage logId={logKey} onBack={onBack} onOpenMenu={onOpenMenu} tabs={tabs} viewDate={viewDate} onChangeMonth={setViewDate} />
  }
  return (
    <div className="page report-page-wrap">
      <PageHeader title="서류 발급" onBack={onBack} onOpenMenu={onOpenMenu} />
      {activeTab === 'tax'
        ? <TaxInvoiceTab logKey={logKey} viewDate={viewDate} onChangeMonth={setViewDate} tabs={tabs} />
        : <DailyInspectionMonthSheet logKey={logKey} viewDate={viewDate} onChangeMonth={setViewDate} tabs={tabs} />}
    </div>
  )
}
