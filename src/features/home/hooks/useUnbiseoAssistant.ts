import { useEffect, useRef, useState } from 'react'
import { isCloudSession } from '../../../data/cloud/cloudSession.ts'
import { useSession } from '../../../data/cloud/sessionContext.ts'
import { readOwnerDrivers, readOwnerWorkData, useOwnerClients, useOwnerDrivers, useOwnerSettings, useOwnerWorkData } from '../../../data/store/ownerDataHooks.ts'
import { savePracticeSettings } from '../../../data/sync/settingsSave.ts'
import { resolveLogSettings } from '../../../domain/carSettingsScope.ts'
import { todayWorkLogSelection } from '../../../domain/calendar.ts'
import { isOffDay } from '../../../domain/day-record.ts'
import { assignmentPeriodNotice } from '../../../domain/drivers.ts'
import { useToast } from '../../../shared/hooks/useToast.ts'
import { SERVER_SAVE_FAIL } from '../../../shared/utils/failureMessages.ts'
import { requestUnbiseoParse, routeNamesForAi } from '../api/unbiseoParse.ts'
import type { UnbiseoCall, UnbiseoClient, UnbiseoDayOff, UnbiseoExpense, UnbiseoFixed } from '../api/unbiseoParse.ts'
import type { UnbiseoSms } from '../api/unbiseoSms.ts'
import { matchChoice } from '../api/unbiseoChoice.ts'
import type { UnbiseoStep } from '../api/unbiseoChoice.ts'
import { INSPECTION_WAIT, WEATHER_WAIT, describeDayOff, describeExistingClient, describeResult } from '../api/unbiseoSentence.ts'
import { checkInspection, saveAllGood, savedSentence } from '../api/unbiseoInspection.ts'
import type { UnbiseoInspectionSave } from '../api/unbiseoInspection.ts'
import { requestWeatherSentence } from '../api/unbiseoWeather.ts'
import { questionNumbers } from '../api/unbiseoNumbers.ts'
import { describeQuestion } from '../api/unbiseoQuestion.ts'
import useSpeechInput from './useSpeechInput.ts'
import useSpeechOutput from './useSpeechOutput.ts'

export type UnbiseoAnswer = { said: string, sentence: string, call: UnbiseoCall | null, expense: UnbiseoExpense | null, fixed: UnbiseoFixed | null, client: UnbiseoClient | null, sms: UnbiseoSms | null, inspection: UnbiseoInspectionSave | null, dayOff: UnbiseoDayOff | null }

function waiting(said: string, sentence: string): UnbiseoAnswer {
  return { said, sentence, call: null, expense: null, fixed: null, client: null, sms: null, inspection: null, dayOff: null }
}

function dayOffAlready(owner: string, dayOff: UnbiseoDayOff, isDriver: boolean): boolean {
  const link = isDriver ? readOwnerDrivers(owner).find((driver) => driver.status === 'linked') : null
  if (isDriver && assignmentPeriodNotice(dayOff.date, link?.startDate, link?.endDate)) return false
  return isOffDay(readOwnerWorkData(owner)[dayOff.date]) === dayOff.off
}

export default function useUnbiseoAssistant() {
  const { ownerKey, session } = useSession()
  const clients = useOwnerClients(ownerKey)
  const settings = useOwnerSettings(ownerKey)
  const showToast = useToast()
  const loggedIn = isCloudSession(session)
  const isDriver = session?.accountType === 'employed_driver'
  const workData = useOwnerWorkData(ownerKey)
  const myLink = useOwnerDrivers(ownerKey).find((driver) => driver.status === 'linked')
  const mainSettings = resolveLogSettings(settings, 'main')
  const callDetailOn = !!mainSettings.callDetail
  const fixedOn = !!mainSettings.fixedOn
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingNow = useRef(false)
  const [answer, setAnswer] = useState<UnbiseoAnswer | null>(null)
  const [answerOwner, setAnswerOwner] = useState(ownerKey)
  if (answerOwner !== ownerKey) {
    setAnswerOwner(ownerKey)
    setText('')
    setAnswer(null)
  }
  const voice = useSpeechOutput(showToast)
  const stopSpeaking = voice.stop
  const currentOwner = useRef(ownerKey)
  useEffect(() => {
    currentOwner.current = ownerKey
    stopSpeaking()
  }, [ownerKey, stopSpeaking])
  const input = useSpeechInput((heard) => {
    setText(heard)
    void send(heard, true)
  })
  const speech = { ...input, start() { stopSpeaking(); input.start() } }
  const step = useRef<UnbiseoStep | null>(null)
  const speakNext = useRef(false)
  function reportStep(next: UnbiseoStep | null) {
    step.current = next
    if (!next || !speakNext.current) return
    speakNext.current = false
    voice.speak(next.question)
  }

  async function send(said: string, byVoice = false) {
    const trimmed = said.trim()
    if (!loggedIn || busy || !trimmed) return
    const chosen = matchChoice(trimmed, step.current?.choices ?? [])
    speakNext.current = !!chosen && byVoice
    if (chosen) {
      setText('')
      chosen.choose()
      return
    }
    const today = todayWorkLogSelection(new Date()).dateKey
    const owner = ownerKey
    stopSpeaking()
    setBusy(true)
    setAnswer(waiting(trimmed, '알아듣는 중…'))
    const routeNames = fixedOn && mainSettings.fixedRouteOn ? routeNamesForAi(mainSettings.fixedRoutePresets || []) : []
    const result = await requestUnbiseoParse({ text: trimmed, today, clientNames: clients.map((client) => client.companyName || ''), routeNames })
    const asksWeather = result.kind === 'weather' && owner === currentOwner.current
    if (asksWeather) setAnswer(waiting(trimmed, WEATHER_WAIT))
    const weatherSentence = asksWeather && result.kind === 'weather' ? await requestWeatherSentence(result.weather, today) : ''
    const asksInspection = result.kind === 'inspection' && owner === currentOwner.current
    if (asksInspection) setAnswer(waiting(trimmed, INSPECTION_WAIT))
    const checked = asksInspection && result.kind === 'inspection' ? await checkInspection(owner, result.inspection.date, today, isDriver) : null
    setBusy(false)
    if (owner !== currentOwner.current) return
    const heardClient = result.kind === 'client' ? result.client : null
    const existing = !!heardClient && clients.some((client) => (client.companyName || '').trim() === heardClient.name)
    const sameDayOff = result.kind === 'dayOff' && dayOffAlready(owner, result.dayOff, isDriver)
    const sentence = weatherSentence || checked?.sentence || (sameDayOff && result.kind === 'dayOff' ? describeDayOff(result.dayOff, today, true) : existing && heardClient ? describeExistingClient(heardClient.name) : describeResult(result, today, (question) => describeQuestion(question, today, isDriver, (asked) => questionNumbers(owner, asked, isDriver))))
    setAnswer({
      said: trimmed,
      sentence,
      call: result.kind === 'call' ? result.call : null,
      expense: result.kind === 'expense' ? result.expense : null,
      fixed: result.kind === 'fixed' ? result.fixed : null,
      client: existing ? null : heardClient,
      sms: result.kind === 'sms' ? result.sms : null,
      inspection: checked?.save ?? null,
      dayOff: result.kind === 'dayOff' && !sameDayOff ? result.dayOff : null,
    })
    if (byVoice) voice.speak(sentence)
  }

  async function enableSetting(patch: { callDetail: true } | { fixedOn: true }): Promise<boolean> {
    if (enabling) return false
    setEnabling(true)
    let saved = true
    try {
      await savePracticeSettings(ownerKey, patch)
    } catch (error) {
      console.error('설정 저장 실패:', error)
      showToast(SERVER_SAVE_FAIL)
      saved = false
    }
    setEnabling(false)
    return saved
  }

  async function saveInspection() {
    const save = answer?.inspection
    if (!save || savingNow.current) return
    const owner = ownerKey
    savingNow.current = true
    setSaving(true)
    const failed = await saveAllGood(save)
    savingNow.current = false
    setSaving(false)
    if (owner !== currentOwner.current) return
    if (failed) showToast(failed)
    else setAnswer((shown) => (shown?.inspection === save ? { ...shown, sentence: savedSentence(save.date, todayWorkLogSelection(new Date()).dateKey), inspection: null } : shown))
  }

  const callDate = answer?.call?.date ?? answer?.expense?.date ?? answer?.fixed?.date ?? answer?.dayOff?.date
  const periodNotice = callDate && session?.accountType === 'employed_driver' ? assignmentPeriodNotice(callDate, myLink?.startDate, myLink?.endDate) : null
  const dayOff = !!callDate && isOffDay(workData[callDate])

  return { loggedIn, text, setText, busy, answer, send, reportStep, speech, speaking: voice.speaking, stopSpeaking, callDetailOn, fixedOn, enabling, enableSetting, saving, saveInspection, periodNotice, dayOff }
}

export type UnbiseoAssistant = ReturnType<typeof useUnbiseoAssistant>
