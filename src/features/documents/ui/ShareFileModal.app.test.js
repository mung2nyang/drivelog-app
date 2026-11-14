import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

/** @type {Array<{ path: string, directory: string }>} */
const writes = []
mock.module('@capacitor/core', {
  namedExports: { Capacitor: { isNativePlatform: () => true } },
})
mock.module('@capacitor/filesystem', {
  namedExports: {
    Directory: { Cache: 'CACHE', Documents: 'DOCUMENTS' },
    Filesystem: {
      writeFile: async (/** @type {{ path: string, directory: string }} */ options) => {
        writes.push({ path: options.path, directory: options.directory })
        return { uri: `file:///storage/emulated/0/Documents/${options.path}` }
      },
    },
  },
})

const React = await import('react')
const { withToast } = await import('../../../testSupport/withToast.ts')
const { act } = React
const { createRoot } = await import('react-dom/client')
const { default: DailyInspectionShareModal } = await import('./DailyInspectionShareModal.tsx')

test('앱: 문자 [PDF로 보내기]는 문서/운행일지에 파일을 저장하고 위치를 알린 뒤 문자 앱으로 간다(링크 내려받기 없음)', async () => {
  /** @type {Array<string>} */
  const toasts = []
  let linkClicks = 0
  const spy = mock.method(window.HTMLAnchorElement.prototype, 'click', () => { linkClicks += 1 })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(withToast(React.createElement(DailyInspectionShareModal, {
      month: 10,
      buildFile: async () => new File(['점검'], '2026년_11월_일상점검표.pdf', { type: 'application/pdf' }),
      onClose: () => {},
    }), (/** @type {string} */ message) => { toasts.push(message) }))
  })
  try {
    const section = [...container.querySelectorAll('.report-share-channel')].find((el) => el.querySelector('strong')?.textContent === '문자로 보내기')
    const button = [...(section?.querySelectorAll('button') || [])].find((el) => el.textContent === 'PDF로 보내기')
    assert.ok(button)
    await act(async () => { button.click() })
    for (let i = 0; i < 50 && toasts.length < 2; i += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    }
    assert.deepEqual(writes, [{ path: '운행일지/2026년_11월_일상점검표.pdf', directory: 'DOCUMENTS' }])
    assert.equal(linkClicks, 0)
    assert.deepEqual(toasts, [
      '문자로 보낼 PDF를 저장하고 있습니다.',
      '문자에 붙일 파일을 저장했습니다. 내 파일 > 문서 > 운행일지에서 볼 수 있어요.',
    ])
  } finally {
    spy.mock.restore()
    await act(async () => { root.unmount() })
    container.remove()
  }
})
