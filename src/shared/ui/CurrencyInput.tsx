import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { roundCurrencyText } from '../../domain/money.ts'
import ClearableInput from './ClearableInput.tsx'

function displayText(text: string) {
  const raw = String(text).replace(/[^0-9.]/g, '')
  const dot = raw.indexOf('.')
  const intDigits = (dot >= 0 ? raw.slice(0, dot) : raw).replace(/^0+(?=\d)/, '')
  const intShown = intDigits ? Number(intDigits).toLocaleString('ko-KR') : (dot >= 0 ? '0' : '')
  return dot >= 0 ? `${intShown}.${raw.slice(dot + 1).replace(/\./g, '')}` : intShown
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string, onValueChange: (next: string) => void, clearable?: boolean }

export default function CurrencyInput({ value, onValueChange, onBlur, clearable = false, ...rest }: Props) {
  const [typed, setTyped] = useState<string | null>(null)
  const shown = typed !== null && roundCurrencyText(typed) === value ? typed : value
  const Field = clearable ? ClearableInput : 'input'
  return (
    <Field
      inputMode="numeric"
      {...rest}
      value={shown}
      onChange={(e) => {
        const next = displayText(e.target.value)
        setTyped(next)
        onValueChange(roundCurrencyText(next))
      }}
      onBlur={(e) => { setTyped(null); onBlur?.(e) }}
    />
  )
}
