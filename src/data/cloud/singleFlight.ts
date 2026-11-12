const inFlight = new Map()

export function singleFlight<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = Promise.resolve()
    .then(factory)
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key)
    })
  inFlight.set(key, promise)
  return promise
}

export function resetSingleFlightForTests() {
  inFlight.clear()
}

export function evict(key: string) {
  inFlight.delete(key)
}
