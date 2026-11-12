export function buildSmsHref(phone: string, body: string, userAgent: string) {
  const separator = /iPhone|iPad|iPod/i.test(userAgent) ? '&' : '?'
  return `sms:${phone}${separator}body=${encodeURIComponent(body)}`
}
