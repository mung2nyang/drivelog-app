// 비회원 [백업 저장하기] — 파일 저장이 성공한 뒤에만 "마지막 백업"이 바뀌고, 앱이면 알림 끝에 저장 위치 안내.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

/** @type {{ hint: string } | Error} */
let saveOutcome = { hint: '' }
/** @type {string[]} */
let savedNames = []
mock.module('../../../shared/utils/saveFile.ts', {
  namedExports: {
    saveFileToDevice: async (/** @type {Blob} */ _blob, /** @type {string} */ name) => {
      savedNames.push(name)
      if (saveOutcome instanceof Error) throw saveOutcome
      return saveOutcome.hint
    },
  },
})

const React = await import('react')
const { withToast } = await import('../../../testSupport/withToast.js')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: AppSettingsBackupSection } = await import('./AppSettingsBackupSection.jsx')

async function render() {
  /** @type {string[]} */
  const toasts = []
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(withToast(React.createElement(AppSettingsBackupSection), (/** @type {string} */ m) => { toasts.push(m) }))
  })
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('백업 저장하기'))
  return {
    container, toasts,
    async save() { await act(async () => { button?.click() }) },
    async cleanup() { await act(async () => { root.unmount() }); container.remove() },
  }
}

test('저장이 실패하면 "마지막 백업"이 그대로이고 실패 알림이 뜬다', async () => {
  localStorage.clear()
  savedNames = []
  saveOutcome = new Error('OS-PLUG-FILE-0007')
  const quiet = mock.method(console, 'error', () => {})
  const view = await render()
  try {
    await view.save()
    assert.equal(savedNames.length, 1)
    assert.match(savedNames[0], /^운송내역_백업_\d{4}-\d{2}-\d{2}\.json$/)
    assert.equal(localStorage.getItem('lastBackupAt'), null)
    assert.ok(view.container.textContent?.includes('아직 백업한 적 없음'))
    assert.deepEqual(view.toasts, ['백업 파일 생성에 실패했습니다.'])
  } finally { quiet.mock.restore(); await view.cleanup() }
})

test('저장이 성공하면 "마지막 백업"이 오늘로 바뀌고 알림 끝에 저장 위치 안내가 붙는다', async () => {
  localStorage.clear()
  savedNames = []
  saveOutcome = { hint: ' 내 파일 > 문서 > 운행일지에서 볼 수 있어요.' }
  const view = await render()
  try {
    await view.save()
    assert.ok(localStorage.getItem('lastBackupAt'))
    assert.ok(view.container.textContent?.includes('마지막 백업:'))
    assert.deepEqual(view.toasts, ['백업 파일을 저장했습니다. 내 파일 > 문서 > 운행일지에서 볼 수 있어요.'])
  } finally { await view.cleanup() }
})
