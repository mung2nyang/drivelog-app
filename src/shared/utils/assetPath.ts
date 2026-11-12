export function assetPath(path: string): string {
  const env = import.meta.env
  const base = (env && env.BASE_URL) || '/'
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return `${base}${normalized}`
}
