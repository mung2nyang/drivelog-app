import type { Json } from './question.ts'

export type Fixed = { date: string, count: number, route: string }

const ROUTES_MAX = 30
const ROUTE_NAME_MAX = 60
const COUNT_MAX = 20

export function readRouteNames(value: Json | undefined): Array<string> | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > ROUTES_MAX) return null
  const names: Array<string> = []
  for (const name of value) {
    if (typeof name !== 'string' || name.length > ROUTE_NAME_MAX) return null
    names.push(name)
  }
  return names
}

const bare = (name: string) => name.replace(/\s+/g, '')

export function readFixed(row: { [key: string]: Json }, date: string, routeNames: Array<string>): Fixed {
  const said = row.fixedCount
  const count = typeof said === 'number' && Number.isInteger(said) && said >= 1 && said <= COUNT_MAX ? said : 1
  const heard = typeof row.fixedRoute === 'string' ? bare(row.fixedRoute) : ''
  const route = heard ? routeNames.find((name) => bare(name) === heard) ?? '' : ''
  return { date, count, route }
}
