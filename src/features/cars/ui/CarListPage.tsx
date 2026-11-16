import { useState } from 'react'
import ConfirmModal from '../../../shared/ui/ConfirmModal.tsx'
import PageHeader from '../../../shared/ui/PageHeader.tsx'
import CarFormModal from './CarFormModal.tsx'
import CarListItem from './CarListItem.tsx'
import useCarListActions from '../hooks/useCarListActions.ts'
import { DRIVER_CAR_LIMIT_MESSAGE, canAddDriverCar, hasMainCar } from '../../../domain/cars.ts'
import { useToast } from '../../../shared/hooks/useToast.ts'
import { NEW_DRIVER_INCOME_DRAFT, driverIncomeDraftFromCar } from '../../../domain/driverIncomeDeductions.ts'
import { resolveDriverShareBase } from '../../../domain/driverShareBase.ts'
import { getCloudUserId, isCloudSession } from '../../../data/cloud/cloudSession.ts'
import { generateInviteCode } from '../../../domain/drivers.ts'
import { todayIsoDate } from '../api/carInviteFromDraft.ts'
import { useOwnerCars, useOwnerDrivers } from '../../../data/store/ownerDataHooks.ts'
import './car-management.css'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import type { CarLike } from '../../../domain/financeTypes.ts'
import type { CarFormDraft } from './CarFormModal.tsx'

const emptyDraft: CarFormDraft = {
  number: '', tonnage: '', fuelKind: '', type: 'main', driverName: '', driverPhone: '',
  driverPayMode: 'revenue', driverSalaryAmount: '', commEnabled: false, commType: 'percent', commission: '',
  ...NEW_DRIVER_INCOME_DRAFT, driverShareBase: 'gross',
  inviteCode: '', inviteStartDate: '', inviteDriverId: null, connectMode: 'log',
}
const DELETE_CAR_CONFIRM = '이 차량의 운행 기록도 함께 지워지며 되돌릴 수 없습니다.'
const DELETE_CAR_INVITE_CONFIRM = `${DELETE_CAR_CONFIRM} 기사에게 보낸 초대 코드도 더는 쓸 수 없습니다.`
const DISCONNECT_CONFIRM = '연동 중인 기사에게 연동 해제 요청이 전달됩니다. 기사가 동의하거나 3일이 지나면 연동이 해제됩니다.'

export default function CarListPage({ onBack, onOpenMenu }: { onBack?: () => void, onOpenMenu?: (() => void) }) {
  const { ownerKey, session } = useSession()
  const cars = useOwnerCars(ownerKey)
  const drivers = useOwnerDrivers(ownerKey)
  const showToast = useToast()
  const viewerIsEmployedDriver = session?.accountType === 'employed_driver'
  const cloud = isCloudSession(session) || !!getCloudUserId()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string|null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const actions = useCarListActions({ ownerKey, cars, drivers, cloud, draft, editingId, closeModal: () => setModalOpen(false) })
  const deleteHasInvite = !!actions.pendingDelete && drivers.some((d) => d.status !== 'linked' && d.vehicleNumber === actions.pendingDelete?.number)

  function openAdd() {
    const type = hasMainCar(cars) ? 'sub' : 'main'
    if (type === 'sub' && !canAddDriverCar(cars)) {
      showToast?.(DRIVER_CAR_LIMIT_MESSAGE)
      return
    }
    setEditingId(null)
    setDraft({
      ...emptyDraft,
      type,
      inviteCode: type === 'sub' && cloud ? generateInviteCode(drivers) : '',
      inviteStartDate: todayIsoDate(),
    })
    setModalOpen(true)
  }

  function openEdit(car: CarLike) {
    setEditingId(car.id || null)
    const linked = drivers.find((d) => d.vehicleNumber === car.number)
    setDraft({
      number: car.number,
      tonnage: car.tonnage || '',
      fuelKind: car.fuelKind || '',
      type: car.type === 'sub' ? 'sub' : 'main',
      driverName: car.driverName || linked?.name || '',
      driverPhone: car.driverPhone || linked?.phone || '',
      driverPayMode: car.driverPayMode || 'revenue',
      driverSalaryAmount: car.driverSalaryAmount != null ? String(car.driverSalaryAmount) : '',
      commEnabled: !!car.commEnabled,
      commType: 'percent',
      commission: car.commType === 'direct' ? '' : String(car.commission ?? ''),
      ...driverIncomeDraftFromCar(car), driverShareBase: resolveDriverShareBase(car),
      inviteCode: linked?.inviteCode || (car.type === 'sub' && cloud ? generateInviteCode(drivers) : ''),
      inviteStartDate: linked?.startDate || todayIsoDate(),
      inviteDriverId: linked?.id || null,
      connectMode: linked ? 'link' : 'log',
    })
    setModalOpen(true)
  }

  return (
    <div className="page car-management-page">
      <PageHeader title="차량 관리" onBack={onBack} onOpenMenu={onOpenMenu} />
      <div className="car-list">
        {cars.length === 0 && <div className="empty-state">등록된 차량이 없습니다.</div>}
        {cars.map((car, index) => (
          <CarListItem
            key={String(car.id || car.number || `car-${index}`)}
            car={car}
            drivers={drivers}
            assignedView={viewerIsEmployedDriver}
            readOnly={viewerIsEmployedDriver}
            onEdit={() => openEdit(car)}
            onDelete={() => actions.askDelete(car)}
          />
        ))}
      </div>
      {!viewerIsEmployedDriver && (
        <button type="button" className="management-add-fab" onClick={openAdd}>+ 추가</button>
      )}
      {modalOpen && (
        <CarFormModal
          draft={draft}
          setDraft={setDraft}
          editingId={editingId}
          onCancel={() => { actions.cancelDisconnect(); setModalOpen(false) }}
          onSave={actions.save}
          saving={actions.saving}
          cloud={cloud}
          drivers={drivers}
        />
      )}
      {actions.pendingDelete && (
        <ConfirmModal title="이 차량을 삭제하시겠습니까?" message={deleteHasInvite ? DELETE_CAR_INVITE_CONFIRM : DELETE_CAR_CONFIRM} confirmLabel="삭제" danger onCancel={actions.cancelDelete} onConfirm={actions.confirmRemove} />
      )}
      {actions.pendingDisconnect && (
        <ConfirmModal
          title="이 차량의 기사 연동을 해제하시겠습니까?"
          message={DISCONNECT_CONFIRM}
          confirmLabel="연동 해제"
          danger
          onCancel={actions.cancelDisconnect}
          onConfirm={actions.confirmDisconnect}
        />
      )}
    </div>
  )
}
