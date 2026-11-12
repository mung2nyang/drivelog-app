export type JsonValue = string | number | boolean | null | Array<JsonValue> | { [key: string]: JsonValue }

export type KeyedWrite = {
  key: string
  value?: JsonValue
  remove?: boolean
}

export function writeAllOrNothing(pairs: Array<KeyedWrite>) {
  const writes: Array<{ key: string, remove: true, json: null } | { key: string, remove: false, json: string }> = pairs.map((pair) => (
    pair.remove
      ? { key: pair.key, remove: true, json: null }
      : { key: pair.key, remove: false, json: JSON.stringify(pair.value) }
  ))

  const backups = writes.map(({ key }) => ([key, localStorage.getItem(key)]) as [string, string | null])
  let writtenCount = 0
  try {
    for (const write of writes) {
      if (write.remove) localStorage.removeItem(write.key)
      else localStorage.setItem(write.key, write.json)
      writtenCount += 1
    }
  } catch (error) {
    for (let i = 0; i < writtenCount; i += 1) {
      const backup = backups[i]
      if (!backup) continue
      const [key, previous] = backup
      if (previous === null) localStorage.removeItem(key)
      else localStorage.setItem(key, previous)
    }
    throw error
  }
}
