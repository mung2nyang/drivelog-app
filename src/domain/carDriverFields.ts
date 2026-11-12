import { driverIncomeFieldsFromDraft } from './driverIncomeDeductions.ts'

export type CarUpsertDraft = {
  number?: string
  tonnage?: string
  fuelKind?: string
  type?: 'main' | 'sub'
  driverName?: string
  driverPhone?: string
  driverPayMode?: string
  driverSalaryAmount?: string
  commEnabled?: boolean
  commType?: string
  commission?: string
  insuranceOn?: boolean
  driverIncomeType?: string
  withholdingOn?: boolean
  expenseRate?: string | number
  insuranceRate?: string | number
  insuranceSplit?: string
  driverShareBase?: string
}

export type DriverFields = {
  driverName: string
  driverPhone: string
  commEnabled: boolean
  commType: string
  commission: string
  insuranceOn: boolean
  driverPayMode?: string
  driverSalaryAmount?: string
  driverIncomeType?: 'employee' | 'business'
  withholdingOn?: boolean
  expenseRate?: string
  insuranceRate?: string
  insuranceSplit?: 'owner' | 'half' | 'driver'
  driverShareBase?: 'gross' | 'afterClientCommission'
}

export function driverFieldsFromDraft(draft: CarUpsertDraft, type: 'main' | 'sub'): DriverFields {
  if (type !== 'sub') {
    return {
      driverName: '',
      driverPhone: '',
      commEnabled: false,
      commType: 'percent',
      commission: '',
      insuranceOn: false,
    }
  }
  const driverPayMode = draft.driverPayMode === 'salary' ? 'salary' : 'revenue'
  const commEnabled = driverPayMode === 'revenue'
  const driverSalaryAmount = String(draft.driverSalaryAmount || '').replace(/\D/g, '')
  return {
    driverName: String(draft.driverName || '').trim(),
    driverPhone: String(draft.driverPhone || '').trim(),
    driverPayMode,
    driverSalaryAmount: driverPayMode === 'salary' ? driverSalaryAmount : '',
    commEnabled,
    commType: 'percent',
    commission: commEnabled ? String(draft.commission || '').trim() : '',
    driverShareBase: draft.driverShareBase === 'afterClientCommission' ? 'afterClientCommission' : 'gross',
    ...driverIncomeFieldsFromDraft(draft),
  }
}
