import { useMemo, useState } from 'react'
import { getTaxInvoiceFlowMeta } from '../../../domain/finance.ts'
import { saveInvoices } from '../../../data/sync/invoicesSave.ts'
import { lastDayOfMonth, listMonthInvoices, invoiceCanIssue } from '../../../domain/invoices.ts'
import { formatWon } from '../../../domain/money.ts'
import { buildFinanceSettings } from '../../../data/sync/ownerFinance.ts'
import { changeTaxInvoiceStatus, saveTaxInvoiceDraft } from '../api/taxInvoiceActions.ts'
import { exportTaxInvoiceExcel } from '../api/taxInvoiceExcel.ts'
import {
  readOwnerInvoices,
  useOwnerCars,
  useOwnerClients,
  useOwnerDrivers,
  useOwnerInvoices,
  useOwnerProfile,
  useOwnerSettings,
  useOwnerWorkDataByLogId,
} from '../../../data/store/ownerDataHooks.ts'
import SummaryInfoToggle from '../../../shared/ui/SummaryInfoToggle.tsx'
import TaxInvoiceDraftModal from './TaxInvoiceDraftModal.tsx'
import TaxInvoiceEntryList from './TaxInvoiceEntryList.tsx'
import MonthNavigator from '../../../shared/ui/MonthNavigator.tsx'
import './tax-invoice.css'
import { useToast } from '../../../shared/hooks/useToast.ts'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import type { InvoiceLike } from '../../../domain/financeTaxInvoiceEntries.ts'
import type { ReactNode } from 'react'

const HOMETAX_GUIDE = [
  '1. 엑셀 파일을 저장한 뒤 [발급하러 가기]를 누르세요.',
  '2. 홈택스에 사업자 계정으로 로그인하세요.',
  '3. [일괄작성 파일]에서 [파일 선택]을 눌러 저장한 엑셀 파일을 선택하세요.',
  '4. [엑셀파일 변환하기]를 누르세요.',
  '5. [일괄 발급]을 누르세요.',
].join('\n')

type TaxInvoiceTabProps = {
  logKey: string
  viewDate: Date
  onChangeMonth: (next: Date) => void
  tabs?: ReactNode
}

export default function TaxInvoiceTab({ logKey, viewDate, onChangeMonth, tabs }: TaxInvoiceTabProps) {
  const { ownerKey } = useSession()
  const showToast = useToast()
  const clients = useOwnerClients(ownerKey)
  const cars = useOwnerCars(ownerKey)
  const practiceSettings = useOwnerSettings(ownerKey)
  const profile = useOwnerProfile(ownerKey)
  const drivers = useOwnerDrivers(ownerKey)
  const records = useOwnerInvoices(ownerKey)
  const [tab, setTab] = useState<'draft'|'issued'>('draft')
  const [modalItem, setModalItem] = useState<InvoiceLike|null>(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const settings = useMemo(() => {
    void clients
    void cars
    void practiceSettings
    void profile
    void drivers
    return buildFinanceSettings(ownerKey)
  }, [ownerKey, clients, cars, practiceSettings, profile, drivers])
  const workDataByLogId = useOwnerWorkDataByLogId(ownerKey)
  const flowMeta = getTaxInvoiceFlowMeta()
  const listed = useMemo(
    () => listMonthInvoices(monthKey, 'sales', settings, workDataByLogId, records, logKey),
    [monthKey, settings, workDataByLogId, records, logKey],
  )
  const entries = (tab === 'issued' ? listed.issuedEntries : listed.draftEntries) as Array<InvoiceLike>
  const supplyTotal = entries.reduce((sum, item) => sum + Number(item.supplyAmount || 0), 0)
  const taxTotal = entries.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0)
  const issuerReady = settings.bizName && settings.bizNumber && settings.userName && settings.bizType && settings.bizItem

  async function persist(next: Array<InvoiceLike>) {
    await saveInvoices(ownerKey, next)
  }

  function openDraft(item: InvoiceLike) {
    setModalItem({
      ...item,
      issueDate: item.issueDate || lastDayOfMonth(monthKey),
      itemName: item.itemName || flowMeta.itemName,
    })
  }

  async function saveDraft() {
    if (!modalItem) return
    const closed = await saveTaxInvoiceDraft({
      ownerKey,
      clients,
      records: readOwnerInvoices(ownerKey),
      modalItem,
      persist,
      showToast,
    })
    if (closed) setModalItem(null)
  }

  function changeStatus(item: InvoiceLike, status: 'draft'|'issued') {
    void changeTaxInvoiceStatus({
      item,
      status,
      settings,
      records: readOwnerInvoices(ownerKey),
      persist,
      openDraft,
      showToast,
    })
  }

  async function exportExcel(item: InvoiceLike) {
    const check = invoiceCanIssue(item, settings)
    if (!check.ok) {
      if (check.error) showToast?.(check.error)
      return
    }
    try {
      const hint = await exportTaxInvoiceExcel(item, settings, profile, monthKey)
      showToast?.(`세금계산서 엑셀 파일을 저장했습니다.${hint}`)
    } catch (error) {
      console.error('세금계산서 엑셀 저장 실패:', error)
      showToast?.('엑셀 저장에 실패했습니다.')
    }
  }

  return (
    <div className="tax-invoice-tab">
      <div className="report-top-card">
        <MonthNavigator viewDate={viewDate} onChange={onChangeMonth} />
        {tabs}
        <div className="doc-scope-tabs" role="tablist" aria-label="계산서 상태">
          <button type="button" role="tab" aria-selected={tab === 'draft'} className={`doc-scope-tab${tab === 'draft' ? ' active' : ''}`} onClick={() => setTab('draft')}>
            작성 전 <span className="tab-count-badge">{listed.draftEntries.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'issued'} className={`doc-scope-tab${tab === 'issued' ? ' active' : ''}`} onClick={() => setTab('issued')}>
            {flowMeta.completeLabel} <span className="tab-count-badge">{listed.issuedEntries.length}</span>
          </button>
        </div>
        {issuerReady && <p className="tax-invoice-issuer-line">{`${settings.bizName}, ${settings.bizNumber}, ${flowMeta.label}`}</p>}
        {!issuerReady && (
          <div className="tax-invoice-guide">
            <p className="tax-invoice-guide-title">세금계산서를 발급받으려면 사업자 정보 입력이 필요합니다.</p>
            <p className="tax-invoice-guide-desc">마이페이지 → 개인정보에서 사업자 정보를 등록해 주세요.</p>
          </div>
        )}
      </div>

      <div className="summary-card">
        <SummaryInfoToggle
          className="summary-title"
          label={`${flowMeta.label} 월간 정산`}
          value={`${entries.length}건`}
          infoName="홈택스 발급 방법"
          info={HOMETAX_GUIDE}
        />
        <div className="summary-row"><span>공급가액</span><span className="summary-value">{formatWon(supplyTotal)}</span></div>
        <div className="summary-row"><span>부가세</span><span className="summary-value">{formatWon(taxTotal)}</span></div>
        <div className="summary-row total"><span>합계</span><span className="summary-value">{formatWon(supplyTotal + taxTotal)}</span></div>
      </div>

      <TaxInvoiceEntryList
        entries={entries}
        tab={tab}
        emptyDraft="계산서 발행 대상 거래처의 운행내역이 없습니다."
        flowMeta={flowMeta}
        onOpenDraft={openDraft}
        onExportExcel={exportExcel}
        onChangeStatus={changeStatus}
      />

      {modalItem && (
        <TaxInvoiceDraftModal
          modalItem={modalItem}
          flowMeta={flowMeta}
          onChange={setModalItem}
          onCancel={() => setModalItem(null)}
          onSave={saveDraft}
        />
      )}
    </div>
  )
}
