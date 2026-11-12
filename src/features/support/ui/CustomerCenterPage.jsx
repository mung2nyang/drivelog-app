// @ts-check
import { useState } from 'react'
import { isCloudSession } from '../../../data/cloud/cloudSession.ts'
import PageHeader from '../../../shared/ui/PageHeader.tsx'
import InquiryForm from './InquiryForm.jsx'
import MyInquiriesList from './MyInquiriesList.jsx'
import './customer-center.css'
import { useSession } from '../../../data/cloud/sessionContext.ts'

/** @typedef {'faq'|'inquiry'|'myInquiries'} SupportTab */

const FAQ_ITEMS = [
  {
    q: '운행 기록은 자동으로 저장되나요?',
    a: '로그인하면 서버에 자동 저장됩니다. 비회원은 이 휴대폰에만 저장되므로, 앱을 지우거나 휴대폰을 바꾸면 기록이 사라질 수 있습니다. 앱 설정의 백업으로 꼭 보관해 주세요.',
  },
  {
    q: '차량을 추가하거나 변경하려면 어떻게 하나요?',
    a: '메뉴 → 차량 관리에서 차량을 추가하거나 수정할 수 있습니다.',
  },
  {
    q: '데이터를 다른 기기로 옮길 수 있나요?',
    a: '로그인 계정은 다른 휴대폰에서 같은 계정으로 로그인하면 됩니다. 비회원 기록은 앱 설정의 [백업 저장하기]로 파일을 만든 뒤, 새 휴대폰에서 [백업 불러오기]로 옮길 수 있습니다.',
  },
  {
    q: '문의 답변은 어디서 확인하나요?',
    a: '[나의 문의/건의 확인]에서 문의 접수 내역과 답변 상태를 확인할 수 있습니다.',
  },
  {
    q: '연동 기사와 미연동 기사는 무엇이 다른가요?',
    a: '누가 운행일지를 쓰느냐의 차이입니다. 연동 기사는 기사님이 자기 휴대폰에서 직접 쓰고, 미연동 기사는 차주님이 대신 씁니다. 기사님께 드릴 정산 계산은 둘이 같습니다.',
  },
  {
    q: '기사님을 연동하려면 어떻게 하나요?',
    a: '차주님과 기사님 모두 로그인해야 합니다. 메뉴 → 차량 관리에서 기사 차량을 추가하고 [기사 연동] 탭의 [코드 생성]으로 초대 코드를 만들어 기사님께 보내 주세요. 기사님이 마이페이지 → 초대 코드 입력에 코드를 넣으면 연동됩니다. 계약기간 밖 날짜는 기록할 수 없습니다.',
  },
  {
    q: '연동하면 차주는 무엇을 볼 수 있나요?',
    a: '메뉴의 "(기사 이름) 기사 관리"에서 기사님이 쓴 기록으로 계산한 운송료, 수수료, 산재보험료, 정산액과 거래처별 세금계산서를 볼 수 있습니다. 운행일지는 기사님만 고칠 수 있습니다.',
  },
  {
    q: '연동을 해제하면 기록은 어떻게 되나요?',
    a: '차주님이나 기사님 한쪽이 해제를 요청하고, 상대가 동의하거나 3일이 지나면 해제됩니다. 해제 전까지 쓴 기록은 차주님과 기사님 모두에게 남습니다. 연동 중에는 탈퇴할 수 없으니 먼저 해제해 주세요.',
  },
  {
    q: '기사 차량은 몇 대까지 등록할 수 있나요?',
    a: '연동 기사와 미연동 기사를 합쳐 최대 3대까지 등록할 수 있습니다. 더 등록하려면 쓰지 않는 기사 차량을 지워 주세요.',
  },
  {
    q: '기사 연동은 무료인가요?',
    a: '네, 무료입니다.',
  },
]

/**
 * @param {Object} props
 * @param {() => void} [props.onGoAuth]
 */
function GuestLoginPrompt({ onGoAuth }) {
  return (
    <div className="support-panel-empty">
      <p>로그인 후 이용해 주세요.</p>
      <button type="button" className="personal-account-btn" onClick={onGoAuth}>로그인하러 가기</button>
    </div>
  )
}

/**
 * @param {Object} props
 * @param {() => void} [props.onBack]
 * @param {() => void} [props.onGoAuth]
 * @param {(() => void)} [props.onOpenMenu]
 * @param {SupportTab} [props.initialTab]
 */
export default function CustomerCenterPage({ onBack, onGoAuth, onOpenMenu, initialTab = 'faq' }) {
  const { session } = useSession()
  const [tab, setTab] = useState(initialTab)
  const [openFaq, setOpenFaq] = useState(/** @type {number|null} */ (null))
  const cloud = isCloudSession(session)
  const userId = cloud ? session?.userId : null

  /** @param {number} index */
  function toggleFaq(index) {
    setOpenFaq((prev) => (prev === index ? null : index))
  }

  return (
    <div className="page customer-center-page">
      <PageHeader title="고객센터" onBack={onBack} onOpenMenu={onOpenMenu} />

      <div className="support-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'faq'} className={`support-tab${tab === 'faq' ? ' active' : ''}`} onClick={() => setTab('faq')}>FAQ</button>
        <button type="button" role="tab" aria-selected={tab === 'inquiry'} className={`support-tab${tab === 'inquiry' ? ' active' : ''}`} onClick={() => setTab('inquiry')}>1:1 문의/건의</button>
        <button type="button" role="tab" aria-selected={tab === 'myInquiries'} className={`support-tab${tab === 'myInquiries' ? ' active' : ''}`} onClick={() => setTab('myInquiries')}>나의 문의/건의 확인</button>
      </div>

      {tab === 'faq' && (
        <section className="support-panel" aria-label="FAQ">
          <div className="support-card">
            <h3>자주 묻는 질문</h3>
          </div>
          {FAQ_ITEMS.map((item, index) => (
            <button key={item.q} type="button" className={`faq-item${openFaq === index ? ' open' : ''}`} onClick={() => toggleFaq(index)}>
              <span>{item.q}</span>
              <i>{openFaq === index ? '−' : '+'}</i>
              <div className="support-detail">{item.a}</div>
            </button>
          ))}
        </section>
      )}

      {tab === 'inquiry' && (
        <section className="support-panel" aria-label="1:1 문의/건의">
          <div className="support-card">
            <h3>무엇을 도와드릴까요?</h3>
            <p>문의나 개선 의견을 남겨주시면 확인 후 답변드리겠습니다.</p>
          </div>
          {userId ? <InquiryForm userId={userId} /> : <GuestLoginPrompt onGoAuth={onGoAuth} />}
        </section>
      )}

      {tab === 'myInquiries' && (
        <section className="support-panel" aria-label="나의 문의/건의 확인">
          <div className="support-card">
            <h3>나의 문의/건의 확인</h3>
            <p>접수하신 문의와 답변 상태를 확인할 수 있습니다.</p>
          </div>
          {userId ? <MyInquiriesList userId={userId} /> : <GuestLoginPrompt onGoAuth={onGoAuth} />}
        </section>
      )}
    </div>
  )
}
