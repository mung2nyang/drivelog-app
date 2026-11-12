// 앱 안 파일 저장(Capacitor C-3-A) — 앱이면 문서/운행일지 폴더에 쓰고 위치 안내, 웹이면 지금처럼 링크 내려받기.
import '../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

let native = true
/** @type {Error | null} */
let writeError = null
/** 덮어쓸 수 없는(예전 앱이 만든) 파일 경로 @type {Set<string>} */
let lockedPaths = new Set()
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
        if (lockedPaths.has(options.path)) throw new Error(`denied ${options.path}`)
        return { uri: `file:///storage/emulated/0/Documents/${options.path}` }
      },
    },
  },
})

const { saveFileToDevice, APP_SAVED_HINT } = await import('./saveFile.ts')

function reset() {
  native = true
  writeError = null
  lockedPaths = new Set()
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

test('앱: 같은 이름 파일을 덮어쓸 수 없으면(앱을 다시 깐 경우) "이름 (2).확장자"로 새로 저장하고 위치 안내를 돌려준다', async () => {
  reset()
  lockedPaths = new Set(['운행일지/2026년_11월_운송비내역서.pdf'])
  const hint = await saveFileToDevice(new Blob(['운행 내역']), '2026년_11월_운송비내역서.pdf')
  assert.equal(hint, APP_SAVED_HINT)
  assert.deepEqual(writes.map((write) => write.path), ['운행일지/2026년_11월_운송비내역서.pdf', '운행일지/2026년_11월_운송비내역서 (2).pdf'])
  assert.equal(Buffer.from(writes[1].data, 'base64').toString('utf8'), '운행 내역')
  assert.equal(writes[1].directory, 'DOCUMENTS')
})

test('앱: (2)도 막혀 있으면 (3)으로, 덮어쓸 수 있으면 번호 없이 한 번만 쓴다', async () => {
  reset()
  lockedPaths = new Set(['운행일지/a.xlsx', '운행일지/a (2).xlsx'])
  await saveFileToDevice(new Blob(['x']), 'a.xlsx')
  assert.deepEqual(writes.map((write) => write.path), ['운행일지/a.xlsx', '운행일지/a (2).xlsx', '운행일지/a (3).xlsx'])
  reset()
  await saveFileToDevice(new Blob(['x']), 'a.xlsx')
  assert.deepEqual(writes.map((write) => write.path), ['운행일지/a.xlsx'])
})

test('앱: (5)까지 모두 막히면 첫 실패를 그대로 넘기고 더 시도하지 않는다', async () => {
  reset()
  lockedPaths = new Set(['운행일지/b.json', '운행일지/b (2).json', '운행일지/b (3).json', '운행일지/b (4).json', '운행일지/b (5).json'])
  await assert.rejects(saveFileToDevice(new Blob(['x']), 'b.json'), { message: 'denied 운행일지/b.json' })
  assert.equal(writes.length, 5)
})

test('앱: 확장자가 없는 이름은 끝에 번호를 붙인다', async () => {
  reset()
  lockedPaths = new Set(['운행일지/백업'])
  await saveFileToDevice(new Blob(['x']), '백업')
  assert.equal(writes[1].path, '운행일지/백업 (2)')
})
