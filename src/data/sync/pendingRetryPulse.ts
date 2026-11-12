let pulse: () => void = () => {}

export function setPendingRetryPulse(fn: () => void) {
  pulse = fn
}

export function pulsePendingRetry() {
  pulse()
}
