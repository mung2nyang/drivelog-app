import { useState } from 'react'
import { buildCloudAppSession, ownerKeyFromSession } from '../../../data/cloud/appSession.ts'
import { requestDriverUnlinkAction } from '../../../data/sync/driverUnlink.ts'
import { hydrateFromSupabase } from '../../../data/hydrate/hydrate.ts'
import { useOwnerDrivers, useOwnerProfile } from '../../../data/store/ownerDataHooks.ts'
import DriverUnlinkControls from './DriverUnlinkControls.tsx'
import { SkeletonLines } from '../../../shared/ui/Skeleton.tsx'
import './driver-connection.css'
import { useToast } from '../../../shared/hooks/useToast.ts'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import type { UnlinkAction } from '../../../data/sync/driverUnlink.ts'
import type { AppSession } from '../../../data/sync/syncTypes.ts'

const HYDRATE_FAIL_TOAST = '연동을 해제했지만 일부 기록을 불러오지 못했습니다.'

export default function EmployerLinkCard({ onUnlinked }: {   onUnlinked?: (session: AppSession) => void, }) {
  const { ownerKey, session } = useSession()
  const showToast = useToast()
  const drivers = useOwnerDrivers(ownerKey)
  const profile = useOwnerProfile(ownerKey)
  const [busy, setBusy] = useState(false)
  const link = drivers.find((driver) => driver.status === 'linked')
  const meId = session?.userId || ''

  async function run(action: UnlinkAction) {
    if (busy || !link || !meId) return
    setBusy(true)
    const result = await requestDriverUnlinkAction({ ownerKey, drivers, driverId: link.id, action })
    const disconnected = !result.failed && !result.drivers.some((driver) => driver.id === link.id)
    if (!disconnected) {
      setBusy(false)
      showToast?.(result.toast)
      return
    }
    const next = await buildCloudAppSession(meId, { name: session?.name, phone: session?.phone })
    let toast = result.toast
    try {
      await hydrateFromSupabase(meId, ownerKeyFromSession(next), { employedDriver: !!next.linkedOwnerId })
    } catch (error) {
      console.error('[EmployerLinkCard] 해제 후 내 계정 불러오기 실패:', error)
      toast = HYDRATE_FAIL_TOAST
    }
    setBusy(false)
    showToast?.(toast)
    onUnlinked?.(next)
  }

  return (
    <section className="setting-section personal-card employer-link-card">
      <div className="personal-card-heading">
        <span className="personal-card-icon">03</span>
        <div><h3>소속 연결</h3><p>차주와 연결 관리</p></div>
      </div>
      {link ? (
        <>
          <p className="car-sub-text">연동 중, {profile.bizName || '연동된 운송사'}, 배정 차량 {link.vehicleNumber || '-'}</p>
          <p className="car-sub-text">계약기간 {link.startDate || '-'} ~ {link.endDate || '종료일 없음'}</p>
          <div className="driver-card-actions">
            <DriverUnlinkControls driver={link} meId={meId} counterpartLabel="차주" onAction={(action) => { void run(action) }} />
          </div>
        </>
      ) : (
        <SkeletonLines label="연동 정보 불러오는 중" />
      )}
    </section>
  )
}
