export type ExpenseItem = {
  id: string
  kind: 'maint' | 'fuel' | 'misc'
  date: string
  name?: string
  category?: string
  fuelType?: string
  payment?: string
  cost?: number
  subsidy?: number
  mileage?: number
  liters?: number | string
  vehicleNumber?: string
}

export type ExpenseDraft = {
  kind?: string
  date?: string
  name?: string
  category?: string
  fuelType?: string
  payment?: string
  cost?: string | number
  subsidy?: string | number
  mileage?: string | number
  liters?: string | number
  vehicleNumber?: string
}

export type DriverExpenseItem = ExpenseItem & { vehicleNumber: string }
