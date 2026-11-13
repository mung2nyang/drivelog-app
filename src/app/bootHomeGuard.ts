const IN_APP_PREFIXES = ['/app', '/onboarding']

export function isAlreadyInAppOnBoot(pathname: string): boolean {
  return IN_APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
