// @ts-check
// 차량 연료 종류 드롭다운 — "선택 안 함"이면 비운다.
import AppDropdown from './AppDropdown.jsx'
import { CAR_FUEL_KINDS } from '../../domain/cars.ts'

const OPTIONS = [{ value: '', label: '선택 안 함' }, ...CAR_FUEL_KINDS.map((kind) => ({ value: kind, label: kind }))]

/**
 * @param {Object} props
 * @param {string} props.id
 * @param {string|undefined} props.value
 * @param {(next: string) => void} props.onChange
 * @param {string} [props.groupClassName] 칸을 감싸는 클래스(차량 창 form-group, 첫 설정 auth-field)
 */
export default function CarFuelKindField({ id, value, onChange, groupClassName = 'form-group' }) {
  return (
    <div className={groupClassName}>
      <label htmlFor={id}>연료 종류</label>
      <AppDropdown
        id={id}
        label="연료 종류"
        value={value || ''}
        options={OPTIONS}
        onChange={onChange}
        className="app-dropdown-boxed"
      />
    </div>
  )
}
