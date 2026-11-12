// @ts-check
import { useState } from 'react'
import { assetPath } from '../../../shared/utils/assetPath.ts'
import { formatPhoneNumber } from '../../../domain/formatPhone.ts'
import ClearableInput from '../../../shared/ui/ClearableInput.tsx'
import './welcome-profile.css'

const BANNER = assetPath('/images/banner_image.png')

/**
 * @param {Object} props
 * @param {string} [props.initialName]
 * @param {(fields: { name: string, phone: string }) => Promise<boolean>} props.onSubmit
 */
export default function WelcomeProfileView({ initialName = '', onSubmit }) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = name.trim() && phone.replace(/\D/g, '').length >= 10

  async function submit() {
    if (busy || !ready) return
    setBusy(true)
    const ok = await onSubmit({ name: name.trim(), phone: phone.trim() })
    if (!ok) setBusy(false)
  }

  return (
    <div className="account-flow-page">
      <div className="auth-view">
        <div className="auth-topbar">
          <span aria-hidden="true" />
          <div className="auth-brand-sm">
            <img src={BANNER} alt="" className="auth-logo-sm" />
            <span>운행일지</span>
          </div>
        </div>
        <div className="auth-heading-box">
          <h1>기본 정보</h1>
          <p className="auth-desc-text">이름과 휴대전화 번호를 입력해 주세요.</p>
        </div>

        <div className="auth-form-fields">
          <div className="auth-field">
            <label htmlFor="welcomeName">이름(실명)</label>
            <ClearableInput
              id="welcomeName"
              className="auth-input-box"
              placeholder="본인 실명"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="auth-field-hint">서비스 이용과 본인 확인을 위해 실명을 입력해 주세요.</p>
          </div>
          <div className="auth-field">
            <label htmlFor="welcomePhone">휴대전화 번호</label>
            <ClearableInput
              id="welcomePhone"
              type="tel"
              className="auth-input-box"
              placeholder="010-0000-0000"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            />
          </div>
        </div>
        <div className="auth-bottom-sticky">
          <button
            type="button"
            className={`auth-primary-btn${busy ? ' save-action-loading' : ''}`}
            disabled={!ready || busy}
            onClick={() => { void submit() }}
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  )
}
