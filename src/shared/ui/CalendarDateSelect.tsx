import AppDropdown from './AppDropdown.tsx'
import './calendar-date-select.css'

type Props = {
  label: string,
  value: string | number,
  options: Array<{ value: string, label: string }>,
  onChange: (next: string) => void,
}

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
