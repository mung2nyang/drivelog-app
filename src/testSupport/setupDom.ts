import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })

Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true, writable: true, enumerable: true })
globalThis.document = dom.window.document
globalThis.localStorage = dom.window.localStorage
try {
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
} catch {
}
