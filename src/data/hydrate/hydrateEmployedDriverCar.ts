import { isCarFuelKind } from '../../domain/cars.ts'
import { driverIncomeFieldsFromDraft } from '../../domain/driverIncomeDeductions.ts'
import type { LocalCar } from './hydrateMergeTypes.ts'

export function carFromAssignedSummary(row: { id: string, number?: string, type?: string, tonnage?: string, driver_pay_mode?: string | null, driver_salary_amount?: number | string | null, comm_enabled?: boolean | null, comm_type?: string | null, comm_value?: string | number | null, insurance_on?: boolean | null, driver_income_type?: string | null, withholding_on?: boolean | null, expense_rate?: string | null, insurance_rate?: string | null, driver_share_base?: string | null, insurance_split?: string | null, fuel_kind?: string | null }): LocalCar {
  return {
    id: `car-${row.id}`,
    number: row.number || '',
    type: row.type === 'main' ? 'main' : 'sub',
    tonnage: row.tonnage || '',
    supabaseId: row.id,
    driverPayMode: row.driver_pay_mode || 'revenue',
    driverSalaryAmount: row.driver_salary_amount ?? '',
    commEnabled: !!row.comm_enabled,
    commType: row.comm_type || 'percent',
    commission: row.comm_value ?? '',
    ...driverIncomeFieldsFromDraft({
      driverIncomeType: row.driver_income_type ?? undefined,
      insuranceOn: row.insurance_on === true,
      withholdingOn: row.withholding_on === true,
      expenseRate: row.expense_rate ?? undefined,
      insuranceRate: row.insurance_rate ?? undefined,
      insuranceSplit: row.insurance_split ?? undefined,
    }),
    driverShareBase: row.driver_share_base === 'afterClientCommission' ? 'afterClientCommission' : 'gross',
    ...(isCarFuelKind(row.fuel_kind) ? { fuelKind: row.fuel_kind } : {}),
    infoType: 'existing',
    driverName: '',
    driverPhone: '',
    driverLinkId: '',
  }
}
