import type { Json } from './question.ts'

export type SmsDraft = { client: string, month: string, all: boolean, template: 1 | 2 | 3 | null }

const TEMPLATES: Array<1 | 2 | 3> = [1, 2, 3]

export function readSmsDraft(row: { [key: string]: Json }, today: string, client: string): SmsDraft {
  const said = row.smsMonth
  const month = typeof said === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(said) && said <= today.slice(0, 7) ? said : ''
  return {
    client,
    month,
    all: !month && row.smsAll === true,
    template: TEMPLATES.find((number) => number === row.smsTemplate) ?? null,
  }
}
