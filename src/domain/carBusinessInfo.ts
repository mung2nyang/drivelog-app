import type { JsonValue } from './jsonTypes.ts'
import type { CarLike } from './financeTypes.ts'

export type CarBusinessForm = {
  sameAsOwner: boolean
  name: string
  bizNumber: string
  representative: string
  address: string
  bizType: string
  bizItem: string
  email: string
  bank: string
  account: string
  accountHolder: string
}

function text(value: JsonValue | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

export function carToBusinessForm(car: CarLike | null | undefined): CarBusinessForm {
  const biz = car?.businessInfo
  const person = car?.personalInfo
  const same = !biz || !!biz.sameAsOwner
  return {
    sameAsOwner: same,
    name: same ? '' : text(biz?.name),
    bizNumber: same ? '' : text(biz?.bizNumber),
    representative: same ? '' : text(biz?.representative),
    address: same ? '' : text(biz?.address),
    bizType: same ? '' : text(biz?.bizType),
    bizItem: same ? '' : text(biz?.bizItem),
    email: same ? '' : text(biz?.email),
    bank: same ? '' : text(person?.bank),
    account: same ? '' : text(person?.account),
    accountHolder: same ? '' : text(person?.accountHolder),
  }
}

export function applyBusinessForm(car: CarLike, form: CarBusinessForm): CarLike {
  const same = !!form.sameAsOwner
  const pick = (value: string) => (same ? '' : text(value))
  return {
    ...car,
    businessInfo: {
      sameAsOwner: same,
      name: pick(form.name),
      bizNumber: pick(form.bizNumber),
      representative: pick(form.representative),
      address: pick(form.address),
      bizType: pick(form.bizType),
      bizItem: pick(form.bizItem),
      email: pick(form.email),
    },
    personalInfo: {
      ...car.personalInfo,
      name: pick(form.representative),
      bizNumber: pick(form.bizNumber),
      address: pick(form.address),
      bizType: pick(form.bizType),
      bizItem: pick(form.bizItem),
      email: pick(form.email),
      bank: pick(form.bank),
      account: pick(form.account),
      accountHolder: pick(form.accountHolder),
    },
  }
}
