import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

/** @type {string|Error} */
let saveOutcome = ''
let saves = 0
mock.module('../api/guestBackupFile.ts', {
  namedExports: {
    saveGuestBackupFile: async () => {
      saves += 1
      if (saveOutcome instanceof Error) throw saveOutcome
      return saveOutcome
    },
    guestHasRecords: () => true,
  },
})

const React = await import('react')
const { withToast } = await import('../../../testSupport/withToast.ts')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: GuestLoginBackupModal } = await import('./GuestLoginBackupModal.tsx')

async function render() {
  /** @type {string[]} */
  const toasts = []
  /** @type {string[]} */
  const calls = []
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(withToast(React.createElement(GuestLoginBackupModal, {
      onClose: () => { calls.push('close') },
      onLogin: () => { calls.push('login') },
    }), (/** @type {string} */ m) => { toasts.push(m) }))
  })
  /** @param {string} label */
  const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent === label)
  return {
    container, toasts, calls,
    labels: () => [...container.querySelectorAll('.modal-btns button')].map((b) => b.textContent),
    /** @param {string} label */
    async press(label) { await act(async () => { button(label)?.click() }) },
    async cleanup() { await act(async () => { root.unmount() }); container.remove() },
  }
}

test('창 문구와 버튼 세 개, 기록이 지워지지 않는다는 안내', async () => {
  const view = await render()
  try {
    assert.ok(view.container.textContent?.includes('비회원 기록 옮기기'))
    assert.ok(view.container.textContent?.includes('마이페이지 → 데이터 다운로드에서 [불러오기]'))
    assert.ok(view.container.textContent?.includes('비회원 기록은 지워지지 않고 이 휴대폰에 그대로 남습니다.'))
    assert.deepEqual(view.labels(), ['백업 저장 후 로그인', '그냥 로그인', '취소'], '위아래로, 주 버튼이 맨 위')
  } finally { await view.cleanup() }
})

test('[취소]는 닫기만, [그냥 로그인]은 저장 없이 로그인', async () => {
  saves = 0
  const view = await render()
  try {
    await view.press('취소')
    assert.deepEqual(view.calls, ['close'])
    await view.press('그냥 로그인')
    assert.deepEqual(view.calls, ['close', 'login'])
    assert.equal(saves, 0)
  } finally { await view.cleanup() }
})

test('[백업 저장 후 로그인] 성공: 저장 안내 뒤 로그인', async () => {
  saves = 0
  saveOutcome = ' 내 파일 > 문서 > 운행일지에서 볼 수 있어요.'
  const view = await render()
  try {
    await view.press('백업 저장 후 로그인')
    assert.equal(saves, 1)
    assert.deepEqual(view.toasts, ['백업 파일을 저장했습니다. 내 파일 > 문서 > 운행일지에서 볼 수 있어요.'])
    assert.deepEqual(view.calls, ['login'])
  } finally { await view.cleanup() }
})

test('[백업 저장 후 로그인] 실패: 실패 안내, 로그인하지 않고 창에 머묾', async () => {
  saveOutcome = new Error('OS-PLUG-FILE-0007')
  const quiet = mock.method(console, 'error', () => {})
  const view = await render()
  try {
    await view.press('백업 저장 후 로그인')
    assert.deepEqual(view.toasts, ['백업 파일 생성에 실패했습니다.'])
    assert.deepEqual(view.calls, [])
    assert.ok(view.labels().length === 3)
    assert.equal(view.container.querySelector('.modal-btns button')?.hasAttribute('disabled'), false)
  } finally { quiet.mock.restore(); await view.cleanup() }
})
