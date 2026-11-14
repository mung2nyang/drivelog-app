export function monthKeyOf(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

export function won(amount: number) {
  return `${(Number(amount) || 0).toLocaleString('ko-KR')}원`
}

export function dateLabel(date?: string) {
  if (!date) return ''
  return `${date.slice(5).replace('-', '/')} `
}

export function driverSelfNetProfitLabel(settlement: { label?: string, payMode?: string|null }|null|undefined) {
  if (settlement?.payMode === 'salary') return '이번 달 월급'
  const label = String(settlement?.label || '')
  const m = /\(([^)]+)\)\s*$/.exec(label)
  if (m?.[1] === '월급') return '이번 달 월급'
  if (m && /^\d+(\.\d+)?%$/.test(m[1])) return `이번 달 정산액 ${m[1]}`
  return '이번 달 정산액'
}
