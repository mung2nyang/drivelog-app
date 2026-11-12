export class StaleSessionError extends Error {
  constructor(message = '세션이 바뀌어 남은 원격 작업을 중단합니다.') {
    super(message)
    this.name = 'StaleSessionError'
  }
}

export class PermanentFailureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermanentFailureError'
  }
}
