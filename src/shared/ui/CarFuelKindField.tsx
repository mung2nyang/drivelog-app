// 차량 연료 종류 칩 — 고른 칩을 다시 누르면 비운다.
import { CAR_FUEL_KINDS } from '../../domain/cars.ts'

type Props = {
  id: string,
  value: string | undefined,
  onChange: (next: string) => void,
  /** 칸을 감싸는 클래스(차량 창 form-group, 첫 설정 auth-field) */
  groupClassName?: string,
}

export default function CarFuelKindField({ id, value, onChange, groupClassName = 'form-group' }: Props) {
  return (
    <div className={groupClassName}>
      <label id={`${id}-label`}>연료 종류</label>
      <div id={id} className="car-commission-type four" role="group" aria-labelledby={`${id}-label`}>
        {CAR_FUEL_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={value === kind ? 'active' : ''}
            aria-pressed={value === kind}
            onClick={() => onChange(value === kind ? '' : kind)}
          >
            {kind}
          </button>
        ))}
      </div>
    </div>
  )
}
