// @ts-check

const IN_APP_PREFIXES = ['/app', '/onboarding']

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isAlreadyInAppOnBoot(pathname) {
  return IN_APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
