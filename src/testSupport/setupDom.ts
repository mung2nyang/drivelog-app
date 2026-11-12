// 저장 코드가 브라우저 전역 localStorage를 그대로 쓰므로 Node 테스트에도 jsdom으로 전역을 채운다.
// 부작용 임포트로만 쓰고, 다른 임포트보다 먼저 적어야 저장 코드가 읽을 때 전역이 이미 있다.
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })

Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true, writable: true, enumerable: true })
globalThis.document = dom.window.document
globalThis.localStorage = dom.window.localStorage
// Node 21+는 전역 navigator를 읽기 전용 getter로 이미 갖고 있어 그냥 대입하면 던진다.
// 이 프로젝트가 테스트하는 코드는 navigator를 안 쓰므로 있으면 덮어쓰고, 없으면 넘어간다.
try {
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
} catch {
  // 이미 읽기 전용으로 굳어 있으면(configurable:false) 그냥 Node 기본 navigator를 둔다.
}
