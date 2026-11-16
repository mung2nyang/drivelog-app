import { formatCurrencyInput } from '../../../domain/money.ts'
import CardActionButtons from '../../../shared/ui/CardActionButtons.tsx'
import type { DriverRecord } from '../../../domain/driverTypes.ts'
import type { CarLike } from '../../../domain/financeTypes.ts'

type CarListItemProps = {
  car: CarLike
  drivers?: Array<DriverRecord>
  assignedView?: boolean
  readOnly?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export default function CarListItem({
  car,
  drivers = [],
  assignedView = false,
  readOnly = false,
  onEdit,
  onDelete,
}: CarListItemProps) {
  const isSub = car.type === 'sub'
  const hasDriverLink = isSub && drivers.some((d) => d.vehicleNumber === car.number)
  const commissionText = isSub && car.commEnabled && car.commission && car.commType !== 'direct' ? `, 수수료 ${car.commission}%` : ''
  const salaryText = isSub && car.driverPayMode === 'salary' && car.driverSalaryAmount
    ? `, 월급 ${formatCurrencyInput(car.driverSalaryAmount)}원`
    : ''
  const subText = `${car.tonnage ? `(${car.tonnage})` : ''}${commissionText}${salaryText}`

  return (
    <div className="management-list-card">
      <div className="management-card-copy">
        <div className="car-info-text">
          {car.type === 'main' && <span className="management-badge main">메인</span>}
          {car.number}
          {isSub && car.driverName && ` [${car.driverName}]`}
        </div>
        {isSub && (
          <div className="car-card-badges">
            <span className="management-badge sub">{assignedView ? '배정 차량' : '기사 차량'}</span>
            <span className="management-badge">{hasDriverLink ? '기사연동' : '운행일지'}</span>
          </div>
        )}
        {subText && <div className="car-sub-text">{subText}</div>}
      </div>
      {!readOnly && onEdit && onDelete && (
        <div className="car-action-btns">
          <CardActionButtons onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  )
}
