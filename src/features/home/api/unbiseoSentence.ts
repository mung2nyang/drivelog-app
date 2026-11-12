import { formatWon } from '../../../domain/money.ts'
import { formatPhoneNumber } from '../../../domain/formatPhone.ts'
import { getPaymentTermLabel, needsPaymentTermValue } from '../../../domain/clientPaymentTerms.ts'
import type { UnbiseoCall, UnbiseoClient, UnbiseoDayOff, UnbiseoExpense, UnbiseoFixed, UnbiseoResult } from './unbiseoParse.ts'
import type { UnbiseoQuestion } from './unbiseoQuestion.ts'

function withRo(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${word}로`
  const final = code % 28
  return final === 0 || final === 8 ? `${word}로` : `${word}으로`
}

export function dateLabelOf(date: string, today: string): string {
  const [, month, day] = date.split('-').map(Number)
  return date === today ? '오늘' : `${month}월 ${day}일`
}

export function describeCall(call: UnbiseoCall, today: string): string {
  const dateLabel = dateLabelOf(call.date, today)
  const route = [call.loadLoc, call.unloadLoc].filter(Boolean).join(' → ')
  const parts = [route, call.fare === null ? '' : formatWon(call.fare), call.client].filter(Boolean)
  if (!parts.length) return `${dateLabel} 운행으로 기록할게요.`
  return `${dateLabel} ${withRo(parts.join(', '))} 기록할게요.`
}

export function describeFixed(fixed: UnbiseoFixed, today: string): string {
  return `${dateLabelOf(fixed.date, today)} ${fixed.route || '고정 노선'} ${fixed.count}회로 기록할게요.`
}

const EXPENSE_LABEL = { maint: '정비', fuel: '주유', misc: '기타' }

export function describeExpense(expense: UnbiseoExpense, today: string): string {
  const item = expense.type === 'fuel' ? expense.fuelType || '주유' : expense.name || expense.category || EXPENSE_LABEL[expense.type]
  const parts = [item, expense.cost === null ? '' : formatWon(expense.cost), expense.payment].filter(Boolean)
  return `${dateLabelOf(expense.date, today)} ${withRo(parts.join(', '))} 기록할게요.`
}

export function withParticle(word: string, withFinal: string, without: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? `${word}${withFinal}` : `${word}${without}`
}

export function describeClient(client: UnbiseoClient): string {
  const termShown = !!client.paymentTerm && (!needsPaymentTermValue(client.paymentTerm) || client.paymentTermValue !== null)
  const commission = client.commType === 'percent' ? `수수료 ${client.commValue}%` : client.commType === 'direct' ? `수수료 ${formatWon(client.commValue ?? 0)}` : ''
  const details = [
    client.manager && `담당자 ${client.manager}`,
    client.phone && formatPhoneNumber(client.phone),
    termShown && getPaymentTermLabel(client.paymentTerm, client.paymentTermValue ?? ''),
    commission,
  ].filter(Boolean)
  const head = `${withParticle(client.name, '을', '를')} 거래처로 등록할게요.`
  return details.length ? `${head} (${details.join(', ')})` : head
}

export function describeExistingClient(name: string): string {
  return `${withParticle(name, '은', '는')} 이미 등록된 거래처예요.`
}

export function describeDayOff(dayOff: UnbiseoDayOff, today: string, same: boolean): string {
  const label = dateLabelOf(dayOff.date, today)
  if (same) return `${withParticle(label, '은', '는')} ${dayOff.off ? '이미 휴무예요.' : '휴무가 아니에요.'}`
  return dayOff.off ? `${withParticle(label, '을', '를')} 휴무로 할게요.` : `${label} 휴무를 취소할게요.`
}

export const WEATHER_WAIT = '날씨를 알아보는 중…'
export const INSPECTION_WAIT = '점검표를 확인하는 중…'

export function describeResult(result: UnbiseoResult, today: string, answerQuestion: (question: UnbiseoQuestion) => string): string {
  if (result.kind === 'call') return describeCall(result.call, today)
  if (result.kind === 'expense') return describeExpense(result.expense, today)
  if (result.kind === 'fixed') return describeFixed(result.fixed, today)
  if (result.kind === 'client') return describeClient(result.client)
  if (result.kind === 'sms') return result.sms.client ? `${result.sms.client}에 미수금 문자를 보낼게요.` : '미수금 문자를 보낼게요.'
  if (result.kind === 'question') return answerQuestion(result.question)
  if (result.kind === 'weather') return WEATHER_WAIT
  if (result.kind === 'inspection') return INSPECTION_WAIT
  if (result.kind === 'dayOff') return describeDayOff(result.dayOff, today, false)
  if (result.kind === 'unknown') return '운행 기록 요청으로 이해하지 못했어요. 다시 말씀해 주세요.'
  return result.message
}
