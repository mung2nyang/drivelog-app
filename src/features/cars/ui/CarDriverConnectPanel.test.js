import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: CarDriverConnectPanel } = await import('./CarDriverConnectPanel.jsx')

test('운행 일지 탭은 안내 문구만 렌더한다', async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(React.createElement(CarDriverConnectPanel, {
        tab: 'log',
        onTab: () => {},
        inviteCode: '',
        onInviteCode: () => {},
        drivers: [],
      }))
    })
    const body = container.querySelector('.car-driver-connect-body')
    assert.ok(body)
    assert.equal(
      body?.textContent?.trim(),
      '기사 연동 없이, 차주가 운행일지를 직접 작성합니다.',
    )
    assert.equal(container.querySelectorAll('.car-daylog-preview').length, 0)
    assert.equal(container.querySelectorAll('.car-open-vehicle-log').length, 0)
  } finally {
    root.unmount()
    container.remove()
  }
})

test('두 탭 설명 옆 (i)를 누르면 연동, 미연동 안내가 펼쳐진다', async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const render = (tab) => act(async () => {
    root.render(React.createElement(CarDriverConnectPanel, { tab, onTab: () => {}, inviteCode: '', onInviteCode: () => {}, drivers: [] }))
  })
  const openTip = async (label) => {
    const button = container.querySelector(`.car-driver-connect-body button[aria-label="${label} 설명 보기"]`)
    assert.ok(button, label)
    await act(async () => { button.click() })
    return container.querySelector('.car-driver-connect-body .summary-info-text')?.textContent ?? ''
  }
  try {
    await render('link')
    const linkText = await openTip('기사 연동')
    assert.ok(linkText.startsWith('기사님이 자기 휴대폰에서 로그인해 이 차량 운행일지를 직접 씁니다.'))
    assert.ok(linkText.includes('마이페이지 → 초대 코드 입력'))
    assert.ok(linkText.includes('계약기간 밖 날짜는 기록할 수 없습니다.'))
    await render('log')
    const logText = await openTip('운행일지')
    assert.ok(logText.startsWith('기사님이 앱을 쓰지 않을 때 고릅니다.'))
    assert.ok(logText.includes('정산은 연동 기사와 똑같이 계산됩니다.'))
  } finally {
    root.unmount()
    container.remove()
  }
})

test('신규 등록(logEnabled 없던 시절의 disabled 게이트 삭제됨) — 운행 일지 탭은 항상 클릭 가능', async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let currentTab = 'link'
  try {
    await act(async () => {
      root.render(React.createElement(CarDriverConnectPanel, {
        tab: currentTab,
        onTab: (next) => { currentTab = next },
        inviteCode: '',
        onInviteCode: () => {},
        drivers: [],
      }))
    })
    const tabs = [...container.querySelectorAll('.car-driver-connect-tabs button')]
    const logTab = tabs.find((b) => b.textContent === '운행일지')
    assert.ok(logTab)
    assert.equal(logTab.disabled, false)
    await act(async () => { logTab.click() })
    assert.equal(currentTab, 'log')
  } finally {
    root.unmount()
    container.remove()
  }
})
