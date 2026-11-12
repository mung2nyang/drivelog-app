const chains: Map<string, Promise<void>> = new Map()

export function runOwnerSaveSerialized<T>(ownerKey: string, task: () => Promise<T>): Promise<T> {
  const prev = chains.get(ownerKey) || Promise.resolve()
  const run = prev.then(task, task)
  chains.set(ownerKey, run.then(() => undefined, () => undefined))
  return run
}

export function resetOwnerSaveQueueForTests() {
  chains.clear()
}
