// 파일 보내기(Capacitor C-3-B) — 앱이면 캐시 폴더에 쓰고 안드로이드 공유 창, 웹이면 지금처럼 브라우저 공유.
import '../../testSupport/setupDom.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

let native = true
/** @type {Error | null} */
let shareError = null
/** @type {Array<{ path: string, data: string, directory: string, recursive: boolean }>} */
let writes = []
/** @type {Array<{ files: Array<string>, title: string, text: string, dialogTitle: string }>} */
let appShares = []

mock.module('@capacitor/core', {
  namedExports: { Capacitor: { isNativePlatform: () => native } },
})
mock.module('@capacitor/filesystem', {
  namedExports: {
    Directory: { Cache: 'CACHE', Documents: 'DOCUMENTS' },
    Filesystem: {
      writeFile: async (/** @type {{ path: string, data: string, directory: string, recursive: boolean }} */ options) => {
        writes.push(options)
        return { uri: `file:///data/user/0/com.getdrivelog.app/cache/${options.path}` }
      },
    },
  },
})
mock.module('@capacitor/share', {
  namedExports: {
    Share: {
      share: async (/** @type {{ files: Array<string>, title: string, text: string, dialogTitle: string }} */ options) => {
        appShares.push(options)
        if (shareError) throw shareError
        return { activityType: 'com.kakao.talk' }
      },
    },
  },
})

const { shareFileFromDevice } = await import('./shareFile.ts')

const pdf = new File(['운송비 내역'], '2026년_11월_운송비내역서.pdf', { type: 'application/pdf' })
const words = { title: '운송비 내역서', text: '안녕하세요. 11월 운송비 내역서입니다.' }

/** @param {((data: ShareData) => Promise<void>) | undefined} share @param {(() => boolean) | undefined} [canShare] */
function setBrowserShare(share, canShare) {
  Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: share })
  Object.defineProperty(navigator, 'canShare', { configurable: true, writable: true, value: canShare })
}

function reset() {
  native = true
  shareError = null
  writes = []
  appShares = []
  setBrowserShare(undefined)
}

test('앱: 캐시 폴더 share/파일이름에 내용을 그대로 쓰고 그 주소·제목·문구로 공유 창을 띄운다', async () => {
  reset()
  assert.equal(await shareFileFromDevice(pdf, words), true)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].path, 'share/2026년_11월_운송비내역서.pdf')
  assert.equal(writes[0].directory, 'CACHE')
  assert.equal(writes[0].recursive, true)
  assert.equal(Buffer.from(writes[0].data, 'base64').toString('utf8'), '운송비 내역')
  assert.deepEqual(appShares, [{
    files: ['file:///data/user/0/com.getdrivelog.app/cache/share/2026년_11월_운송비내역서.pdf'],
    title: '운송비 내역서',
    text: '안녕하세요. 11월 운송비 내역서입니다.',
    dialogTitle: '운송비 내역서',
  }])
})

test('앱: 공유 창을 닫으면(취소) 오류 없이 끝나고, 다른 실패는 그대로 넘긴다', async () => {
  reset()
  shareError = new Error('Share canceled')
  assert.equal(await shareFileFromDevice(pdf, words), true)
  shareError = new Error('only file urls are supported')
  await assert.rejects(shareFileFromDevice(pdf, words), /only file urls are supported/)
})

test('웹: 앱 쪽을 부르지 않고 브라우저 공유에 파일·제목·문구를 넘긴다, 취소는 조용히 끝난다', async () => {
  reset()
  native = false
  /** @type {Array<ShareData>} */
  const browserShares = []
  setBrowserShare(async (/** @type {ShareData} */ data) => { browserShares.push(data) }, () => true)
  assert.equal(await shareFileFromDevice(pdf, words), true)
  assert.deepEqual(browserShares, [{ files: [pdf], ...words }])
  assert.equal(writes.length, 0)
  assert.equal(appShares.length, 0)
  setBrowserShare(async () => { const error = new Error('cancel'); error.name = 'AbortError'; throw error })
  assert.equal(await shareFileFromDevice(pdf, words), true)
})

test('웹: 브라우저 공유가 없거나 파일을 못 보내면 false', async () => {
  reset()
  native = false
  assert.equal(await shareFileFromDevice(pdf, words), false)
  setBrowserShare(async () => {}, () => false)
  assert.equal(await shareFileFromDevice(pdf, words), false)
  setBrowserShare(undefined)
})
