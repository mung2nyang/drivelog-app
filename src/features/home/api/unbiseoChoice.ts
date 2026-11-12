import { MESSAGE_TEMPLATE_TITLES } from '../../../data/sync/messageTemplates.ts'

export type UnbiseoChoice = { words: Array<string>, choose: () => void }
export type UnbiseoStep = { question: string, choices: Array<UnbiseoChoice> }

export const ALL_WORDS = ['전체', '전부', '남은거다']
export const DIRECT_WORDS = ['직접', '고를게']
const NUMBER_WORDS = [['1번', '일번', '첫번째'], ['2번', '두번째'], ['3번', '세번째']]

export function normalizeSaid(said: string): string {
  return said.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
}

export function clientWords(client: string): Array<string> {
  return [normalizeSaid(client)]
}

export function monthWords(month: string, today: string): Array<string> {
  const name = `${Number(month.slice(5, 7))}월`
  const words = month.slice(0, 4) === today.slice(0, 4) ? [name] : [`${month.slice(0, 4)}년${name}`]
  return words.flatMap((word) => [`${word}분`, word])
}

export function templateWords(template: 1 | 2 | 3): Array<string> {
  return [...NUMBER_WORDS[template - 1], normalizeSaid(MESSAGE_TEMPLATE_TITLES[template - 1])]
}

export function stepQuestion(prompt: string, labels: Array<string>): string {
  return labels.length ? `${prompt} ${labels.join(', ')}.` : prompt
}

function hits(said: string, word: string): boolean {
  let at = said.indexOf(word)
  while (at >= 0) {
    if (!/^\d/.test(word) || at === 0 || !/\d/.test(said[at - 1])) return true
    at = said.indexOf(word, at + 1)
  }
  return false
}

function longestHit(said: string, choice: UnbiseoChoice): number {
  return choice.words.reduce((best, word) => (word && word.length > best && hits(said, word) ? word.length : best), 0)
}

export function matchChoice(said: string, choices: Array<UnbiseoChoice>): UnbiseoChoice | null {
  const text = normalizeSaid(said)
  const scored = choices.map((choice) => ({ choice, length: longestHit(text, choice) }))
  const best = Math.max(0, ...scored.map((row) => row.length))
  const top = scored.filter((row) => row.length === best)
  return best > 0 && top.length === 1 ? top[0].choice : null
}
