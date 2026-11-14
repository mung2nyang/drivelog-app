import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import MonthNavigator from '../../../shared/ui/MonthNavigator.tsx'
import ExpenseFormModal from './ExpenseFormModal.tsx'
import MaintFuelDayList from './MaintFuelDayList.tsx'
import PageHeader from '../../../shared/ui/PageHeader.tsx'
import { resolveDriverOrPlateLabel } from '../../../domain/driverManagementContext.ts'
import { defaultFuelTypeForLog } from '../../../domain/cars.ts'
import { getExpensesForLog } from '../../../domain/expenseScope.ts'
import { deleteExpense, saveExpenseDraft } from '../../../data/sync/expensesSave.ts'
import { filterMonth, groupExpensesByDate, KINDS, monthTotal } from '../../../domain/expenses.ts'
import { emptyExpenseDraft, expenseToDraft } from '../../../domain/expenseDraft.ts'
import { formatWon } from '../../../domain/money.ts'
import { useOwnerCars, useOwnerDrivers, useOwnerExpenses } from '../../../data/store/ownerDataHooks.ts'
import './maint-fuel.css'
import { useToast } from '../../../shared/hooks/useToast.ts'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import type { ExpenseDraft, ExpenseItem } from '../../../domain/expenseTypes.ts'

export default function MaintFuelPage({ logId: logIdProp, onBack, onOpenMenu }: { logId?: string, onBack?: () => void, onOpenMenu?: (() => void) }) {
  const { ownerKey, session } = useSession()
  const showToast = useToast()
  const { logId: rawLogId } = useParams()
  const logId = logIdProp ?? (rawLogId ? decodeURIComponent(rawLogId) : undefined)
  const items = useOwnerExpenses(ownerKey)
  const drivers = useOwnerDrivers(ownerKey)
  const cars = useOwnerCars(ownerKey)
  const [kind, setKind] = useState<ExpenseItem['kind']>('maint')
  const [viewDate, setViewDate] = useState(() => new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string|null>(null)
  const [draft, setDraft] = useState<ExpenseDraft>(emptyExpenseDraft('maint'))
  const [saving, setSaving] = useState(false)
  const busyRef = useRef(false)
  async function once<R>(run: () => Promise<R>): Promise<R|undefined> {
    if (busyRef.current) return undefined
    busyRef.current = true
    setSaving(true)
    try { return await run() } finally { busyRef.current = false; setSaving(false) }
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const scopedItems = useMemo(() => getExpensesForLog(items, logId), [items, logId])
  const list = useMemo(() => filterMonth(scopedItems, kind, year, month), [scopedItems, kind, year, month])
  const groups = useMemo(() => groupExpensesByDate(list), [list])
  const total = monthTotal(scopedItems, kind, year, month)
  const kindLabel = KINDS.find((item) => item.value === kind)?.label || '정비'
  const title = !logId || logId === 'main'
    ? '차량 유지비'
    : `${resolveDriverOrPlateLabel(logId, drivers, cars)} 차량 유지비`

  function openAdd() {
    setEditingId(null)
    const fresh = emptyExpenseDraft(kind, undefined, logId && logId !== 'main' ? logId : undefined)
    setDraft(kind === 'fuel' ? { ...fresh, fuelType: defaultFuelTypeForLog(cars, logId, session?.accountType === 'employed_driver') } : fresh)
    setModalOpen(true)
  }

  function openEdit(item: ExpenseItem) {
    setEditingId(item.id)
    setDraft(expenseToDraft(item))
    setModalOpen(true)
  }

  async function save() {
    const message = await once(async () => (await saveExpenseDraft(ownerKey, { ...draft, kind: draft.kind || kind }, editingId)) ?? '')
    if (message === undefined) return
    if (message) {
      showToast?.(message)
      return
    }
    setModalOpen(false)
    showToast?.(editingId ? '내역을 수정했습니다.' : '내역을 등록했습니다.')
  }

  async function remove(id: string) {
    const message = await once(async () => (await deleteExpense(ownerKey, id)) ?? '')
    if (message === undefined) return
    showToast?.(message || '내역을 삭제했습니다.')
  }

  const monthLabelClass = kind === 'fuel' ? 'fuel-color' : kind === 'misc' ? 'misc-color' : undefined

  return (
    <div className="page maint-fuel-page">
      <PageHeader title={title} onBack={onBack} onOpenMenu={onOpenMenu} />

      <div className="maint-top-card">
        <MonthNavigator viewDate={viewDate} onChange={setViewDate} />
        <div className="settings-segmented-control maint-fuel-tabs maint-management-tabs">
          {KINDS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`toggle-btn${kind === item.value ? ' active-work' : ''}`}
              onClick={() => setKind(item.value as ExpenseItem['kind'])}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="maint-month-summary">
          <strong className={monthLabelClass}>{month + 1}월 {kindLabel}</strong>
          <span>합계</span>
          <b>{formatWon(total)}</b>
        </div>
      </div>

      <MaintFuelDayList groups={groups} kind={kind} kindLabel={kindLabel} onEdit={openEdit} onDelete={remove} />

      <button type="button" className="management-add-fab" onClick={openAdd}>+ 추가</button>

      {modalOpen && (
        <ExpenseFormModal
          draft={draft}
          editingId={editingId}
          kindLabel={kindLabel}
          onChange={setDraft}
          onClose={() => setModalOpen(false)}
          onSave={save}
          saving={saving}
        />
      )}
    </div>
  )
}
