// InfoTip — 괄호에 바로 붙은 한글 사이에만 이음 문자, 그 밖 글자는 그대로.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: InfoTip } = await import('./InfoTip.jsx')

/** @param {string} info */
async function shownText(info) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(React.createElement(InfoTip, { name: '시험', info })) })
  const btn = container.querySelector('button')
  assert.ok(btn instanceof window.HTMLButtonElement)
  await act(async () => { btn.click() })
  const text = container.querySelector('.summary-info-text')?.textContent
  await act(async () => { root.unmount() })
  container.remove()
  return text
}

test('한글 바로 뒤 여는 괄호, 닫는 괄호 바로 뒤 한글이면 사이에 이음 문자(U+2060)', async () => {
  assert.equal(await shownText('법정 요율(1.8%)입니다. 수수료(10%)를 뺍니다.'), '법정 요율⁠(1.8%)⁠입니다. 수수료⁠(10%)⁠를 뺍니다.')
})

test('괄호 앞뒤가 띄어쓰기·문장 부호·영문·숫자·줄 끝이면 그대로', async () => {
  const info = '합계 (부가세 포함) 금액, (10%). (A)b a(1)2\n(끝)'
  assert.equal(await shownText(info), info)
})
