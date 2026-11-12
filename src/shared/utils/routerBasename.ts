export function routerBasename() {
  const env = import.meta.env
  const base = (env && env.BASE_URL) || '/'
  if (base === '/') return ''
  return base.replace(/\/$/, '')
}
