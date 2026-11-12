import AppDropdown from './AppDropdown.tsx'
import './calendar-date-select.css'

type Props = {
  label: string,
  value: string | number,
  options: Array<{ value: string, label: string }>,
  onChange: (next: string) => void,
}

/** 연/월 전용 래퍼 — 로직은 `AppDropdown`, 날짜 네비 레이아웃만 남긴다. */
export default function CalendarDateSelect({ label, value, options, onChange }: Props) {
  return (
    <AppDropdown
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      className="app-date-dropdown"
    />
  )
}
