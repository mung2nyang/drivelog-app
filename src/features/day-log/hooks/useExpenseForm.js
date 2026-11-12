// @ts-check
import { useRef, useState } from 'react'
import { deleteExpense, saveExpenseDraft } from '../../../data/sync/expensesSave.ts'
import { emptyExpenseDraft, expenseToDraft } from '../../../domain/expenseDraft.ts'
import { useOwnerCars, useOwnerExpenses } from '../../../data/store/ownerDataHooks.ts'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import { defaultFuelTypeForLog } from '../../../domain/cars.ts'
import { useToast } from '../../../shared/hooks/useToast.ts'

/** @typedef {import('../ui/dayLogTypes.js').ExpenseItem} ExpenseItem */

/**
 * @param {string} ownerKey
 * @param {string} dateKey
 * @param {string} [logId]
 */
export function useExpenseForm(ownerKey, dateKey, logId = 'main') {
  const showToast = useToast()
  const expenses = useOwnerExpenses(ownerKey)
  const cars = useOwnerCars(ownerKey)
  const { session } = useSession()
  const [kindPick, setKindPick] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(/** @type {string|null} */ (null))
  const [draft, setDraft] = useState(() => emptyExpenseDraft('maint', dateKey))
  const [saving, setSaving] = useState(false)
  const busyRef = useRef(false)
  /** @template R @param {() => Promise<R>} run @returns {Promise<R|undefined>} */
  async function once(run) {
    if (busyRef.current) return undefined
    busyRef.current = true
    setSaving(true)
    try { return await run() } finally { busyRef.current = false; setSaving(false) }
  }

  /** @param {string} kind @param {import('../../../domain/expenseTypes.ts').ExpenseDraft} [preset] */
  function openAdd(kind, preset) {
    const fuel = kind === 'fuel' ? { fuelType: defaultFuelTypeForLog(cars, logId, session?.accountType === 'employed_driver') } : {}
    const fresh = () => ({ ...emptyExpenseDraft(kind, dateKey, logId !== 'main' ? logId : undefined), ...fuel, ...preset })
    if (kindPick) {
      setKindPick(false)
      setTimeout(() => {
        setEditingId(null)
        setDraft(fresh())
        setModalOpen(true)
      }, 420)
      return
    }
    setKindPick(false)
    setEditingId(null)
    setDraft(fresh())
    setModalOpen(true)
  }

  /** @param {ExpenseItem} item */
  function openEdit(item) {
    setKindPick(false)
    setEditingId(item.id)
    setDraft(expenseToDraft(item, dateKey))
    setModalOpen(true)
  }

  /** @param {string} id */
  async function remove(id) {
    const message = await once(() => deleteExpense(ownerKey, id))
    if (message) showToast?.(message)
  }

  async function save() {
    const message = await once(async () => (await saveExpenseDraft(ownerKey, { ...draft, date: dateKey }, editingId)) ?? '')
    if (message === undefined) return
    if (message) {
      showToast?.(message)
      return
    }
    setModalOpen(false)
    showToast?.(editingId ? '내역을 수정했습니다.' : '내역을 등록했습니다.')
  }

  function openKindPick() { setModalOpen(false); setKindPick(true) }
  function closeAll() { setKindPick(false); setModalOpen(false) }

  return { expenses, kindPick, modalOpen, editingId, draft, setDraft, saving, openAdd, openEdit, remove, save, openKindPick, closeAll, closeModal: () => setModalOpen(false) }
}
