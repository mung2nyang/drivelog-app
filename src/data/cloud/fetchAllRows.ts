import type { SupabaseQueryError } from '../hydrate/hydrateMergeTypes.ts'

export const PAGE_SIZE = 1000

export async function fetchAllRows<Row>(buildQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: Array<Row> | null, error: SupabaseQueryError }> }): Promise<{ data: Array<Row> | null, error: SupabaseQueryError }> {
  const rows: Array<Row> = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    const page = Array.isArray(data) ? data : []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return { data: rows, error: null }
  }
}
