// 달력 보던 달 기억: 달을 넘긴 뒤 다른 화면에 갔다 [달력](주소에 달 없음)으로 오면 그 달, 다른 계정·앱을 다시 켜면 이번 달.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./src/testSupport/jsxLoaderHook.mjs').href, import.meta.url)

import '../../../testSupport/stubSupabaseClient.js'
import '../../../testSupport/setupDom.js'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const React = await import('react')
const { withSession } = await import('../../../testSupport/withSession.js')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { act } = React
const { default: CalendarPage } = await import('./CalendarPage.jsx')
const { forgetViewMonths } = await import('../../../data/store/viewMonthMemory.ts')

const now = new Date()
const label = (/** @type {Date} */ date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`
const THIS_MONTH = label(now)
const LAST_MONTH = label(new Date(now.getFullYear(), now.getMonth() - 1, 1))

/** 아래 탭 [달력]처럼 주소에 달 없이 연다. @param {string} ownerKey */
async function open(ownerKey) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: ['/app/calendar'] },
      withSession(React.createElement(CalendarPage, { onSelectDay: () => {} }), { ownerKey }),
    ))
  })
  return {
    picked: () => [...container.querySelectorAll('.date-navigator .app-dropdown-trigger')].map((el) => el.textContent?.trim()).join(' '),
    async previous() {
      const button = container.querySelector('button[title="이전 달"]')
      assert.ok(button instanceof window.HTMLButtonElement)
      await act(async () => { button.click() })
    },
    async close() { await act(async () => { root.unmount() }); container.remove() },
  }
}

beforeEach(() => { forgetViewMonths() })

test('지난달로 넘긴 뒤 화면을 떠났다 [달력]으로 오면 지난달 그대로', async () => {
  const first = await open('calendar-memory-owner')
  assert.equal(first.picked(), THIS_MONTH)
  await first.previous()
  assert.equal(first.picked(), LAST_MONTH)
  await first.close()

  const again = await open('calendar-memory-owner')
  try { assert.equal(again.picked(), LAST_MONTH) } finally { await again.close() }
})

test('다른 계정이거나 앱을 다시 켜면(기억 비움) 이번 달', async () => {
  const first = await open('calendar-memory-a')
  await first.previous()
  await first.close()

  const other = await open('calendar-memory-b')
  try { assert.equal(other.picked(), THIS_MONTH) } finally { await other.close() }

  forgetViewMonths()
  const restarted = await open('calendar-memory-a')
  try { assert.equal(restarted.picked(), THIS_MONTH) } finally { await restarted.close() }
})
