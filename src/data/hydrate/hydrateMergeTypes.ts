import type { JsonRecord } from '../../domain/jsonTypes.ts'
import type { CarLike } from '../../domain/financeTypes.ts'
import type { ClientLike } from '../../domain/clientTypes.ts'
import type { DriverRecord } from '../../domain/driverTypes.ts'

export type { JsonRecord }

export type SupabaseQueryError = { message: string, code?: string } | Error | null
export type HydrateError = Error & { failedTables?: Array<string>, cause?: Record<string, SupabaseQueryError> }

export type LocalProfile = { name?: string, phone?: string, bizName?: string, bizRepresentative?: string, bizNumber?: string, bizAddress?: string, bizType?: string, bizItem?: string, bizEmail?: string, bankName?: string, accountNumber?: string, accountHolder?: string }
export type ProfileRow = { name?: string, phone?: string, business_name?: string, business_number?: string, business_address?: string, business_type?: string, business_item?: string, business_email?: string, business_representative?: string, bank_name?: string, account_number?: string, account_holder?: string } | null | undefined

export type LocalCar = CarLike
export type RawCarBackup = Partial<LocalCar>
export type LocalClient = ClientLike
export type RawClientBackup = Partial<LocalClient>
export type LocalDriver = Partial<DriverRecord> & { driverName?: string }

export type VehicleRow = { id: string | number, raw?: RawCarBackup | null, number?: string, type?: string, tonnage?: string, driver_name?: string, driver_pay_mode?: string | null, driver_salary_amount?: number | string | null, comm_enabled?: boolean, comm_type?: string | null, comm_value?: string | number }

export type ClientRow = { id: string | number, raw?: RawClientBackup | null, company_name?: string, legacy_client_id?: string, is_pinned?: boolean }

export type DriverLinkRow = { id: string | number, invite_code?: string, vehicle_id?: string | number, assignment_start?: string, assignment_end?: string, status?: string, driver_name?: string | null, unlink_requested_by?: string | null, unlink_requested_at?: string | null }

export type DailyLogRow = { work_date: string, raw?: JsonRecord | null, is_off?: boolean, fixed_count?: number }
export type DetailRow = { work_date: string, raw?: JsonRecord | null }
export type MergedDayRecord = { isOff: boolean, fixedCount: number, callDetails: Array<JsonRecord>, fuelItems?: Array<JsonRecord>, maintItems?: Array<JsonRecord>, miscItems?: Array<JsonRecord>, assignedVehicleNumber?: string }
