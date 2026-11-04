// @ts-check
/** @typedef {import('../../../domain/driverTypes.ts').DriverRecord} DriverRecord */
import { formatInviteCode, generateInviteCode } from '../../../domain/drivers.ts'
import { DRIVER_CAR_LIMIT_MESSAGE } from '../../../domain/cars.ts'
import InfoTip from '../../../shared/ui/InfoTip.jsx'
import '../../drivers/ui/driver-connection.css'

const LINK_INFO = `기사님이 자기 휴대폰에서 로그인해 이 차량 운행일지를 직접 씁니다.
[코드 생성]으로 만든 초대 코드를 기사님께 보내면, 기사님이 마이페이지 → 초대 코드 입력에 넣어 연동합니다.
차주님은 메뉴의 "(기사 이름) 기사 관리"에서 정산 요약을 봅니다. 일지는 기사님만 고칠 수 있습니다.
계약기간 밖 날짜는 기록할 수 없습니다.
${DRIVER_CAR_LIMIT_MESSAGE}`
const LOG_INFO = `기사님이 앱을 쓰지 않을 때 고릅니다. 차주님이 이 차량 운행일지를 대신 씁니다.
메뉴의 "(기사 이름) 기사 관리" → [운행일지]에서 기록하고, 정산은 연동 기사와 똑같이 계산됩니다.
${DRIVER_CAR_LIMIT_MESSAGE}`

/**
 * 서브차량 "기사 연동 / 운행일지" 패널.
 * @param {Object} props
 * @param {'link'|'log'} props.tab
 * @param {(tab: 'link'|'log') => void} props.onTab
 * @param {string} props.inviteCode
 * @param {(code: string) => void} props.onInviteCode
 * @param {Array<DriverRecord>} props.drivers
 */
export default function CarDriverConnectPanel({
  tab, onTab, inviteCode, onInviteCode, drivers,
}) {
  return (
    <div className="car-driver-connect">
      <div className="car-commission-type car-driver-connect-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'link'}
          className={tab === 'link' ? 'active' : ''}
          onClick={() => onTab('link')}
        >
          기사 연동
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'log'}
          className={tab === 'log' ? 'active' : ''}
          onClick={() => onTab('log')}
        >
          운행일지
        </button>
      </div>

      {tab === 'link' && (
        <div className="car-driver-connect-body">
          <p className="car-driver-connect-copy">
            기사를 초대하고 이 차량을 배정하세요. <InfoTip name="기사 연동" info={LINK_INFO} />
            <br />
            (배정된 기사가 작성한 운행일지를 확인할 수 있습니다.)
          </p>
          <div className="form-group">
            <label htmlFor="carInviteCode">초대 코드</label>
            <div className="driver-code-row">
              <input
                id="carInviteCode"
                className="input-box"
                readOnly
                value={formatInviteCode(inviteCode)}
              />
              <button
                type="button"
                className="theme-toggle-btn"
                onClick={() => onInviteCode(generateInviteCode(drivers))}
              >
                코드 생성
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div className="car-driver-connect-body">
          <p className="car-type-hint">기사 연동 없이, 차주가 운행일지를 직접 작성합니다. <InfoTip name="운행일지" info={LOG_INFO} /></p>
        </div>
      )}
    </div>
  )
}
