// 앱 안 파일 저장(Capacitor C-3-A) — 앱이면 문서/운행일지 폴더에 쓰고 위치 안내, 웹이면 지금처럼 링크 내려받기.
import '../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

let native = true
/** @type {Error | null} */
let writeError = null
/** @type {Array<{ path: string, data: string, directory: string, recursive: boolean }>} */
let writes = []

mock.module('@capacitor/core', {
  namedExports: { Capacitor: { isNativePlatform: () => native } },
})
mock.module('@capacitor/filesystem', {
  namedExports: {
    Directory: { Documents: 'DOCUMENTS' },
    Filesystem: {
      writeFile: async (/** @type {{ path: string, data: string, directory: string, recursive: boolean }} */ options) => {
        writes.push(options)
        if (writeError) throw writeError
        return { uri: `file:///storage/emulated/0/Documents/${options.path}` }
      },
    },
  },
})

const { saveFileToDevice, APP_SAVED_HINT } = await import('./saveFile.ts')

function reset() {
  native = true
  writeError = null
  writes = []
}

/** @param {() => Promise<void>} run */
async function withLinkSpy(run) {
  /** @type {Array<{ download: string, href: string }>} */
  const clicked = []
  const spy = mock.method(window.HTMLAnchorElement.prototype, 'click', /** @this {HTMLAnchorElement} */ function recordLink() { clicked.push({ download: this.download, href: this.href }) })
  const originalCreate = URL.createObjectURL
  URL.createObjectURL = () => 'blob:fake'
  try {
    await run()
  } finally {
    spy.mock.restore()
    URL.createObjectURL = originalCreate
  }
  return clicked
}

test('앱: 문서 폴더 운행일지/파일이름에 파일 내용을 그대로 쓰고 위치 안내를 돌려준다(링크 내려받기 없음)', async () => {
  reset()
  /** @type {string} */
  let hint = ''
  const clicked = await withLinkSpy(async () => {
    hint = await saveFileToDevice(new Blob(['운행 내역'], { type: 'text/plain' }), '2026년_11월_운송비내역서.pdf')
  })
  assert.equal(hint, APP_SAVED_HINT)
  assert.equal(APP_SAVED_HINT, ' 내 파일 > 문서 > 운행일지에서 볼 수 있어요.')
  assert.deepEqual(clicked, [])
  assert.equal(writes.length, 1)
  assert.equal(writes[0].path, '운행일지/2026년_11월_운송비내역서.pdf')
  assert.equal(writes[0].directory, 'DOCUMENTS')
  assert.equal(writes[0].recursive, true)
  assert.equal(Buffer.from(writes[0].data, 'base64').toString('utf8'), '운행 내역')
})

test('웹: 앱 저장을 부르지 않고 파일 이름으로 링크를 눌러 내려받으며 안내는 빈 문자열', async () => {
  reset()
  native = false
  /** @type {string | null} */
  let hint = null
  const clicked = await withLinkSpy(async () => {
    hint = await saveFileToDevice(new Blob(['x']), '운송내역_백업_2026-11-05.json')
  })
  assert.equal(hint, '')
  assert.equal(writes.length, 0)
  assert.deepEqual(clicked, [{ download: '운송내역_백업_2026-11-05.json', href: 'blob:fake' }])
  assert.equal(document.querySelector('a[download]'), null, '누른 뒤 링크는 지움')
})

test('앱: 저장이 실패(권한 거절 등)하면 오류를 그대로 넘긴다', async () => {
  reset()
  writeError = new Error('OS-PLUG-FILE-0007')
  await assert.rejects(saveFileToDevice(new Blob(['x']), 'a.xlsx'), /OS-PLUG-FILE-0007/)
})
