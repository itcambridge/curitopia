const ALLOWED_NEXT = new Set(['/', '/reset-password'])

const ALLOWED_ORIGINS = [
  /^https:\/\/curitopia\.com$/,
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
]

export function safeNextPath(value: string | null) {
  if (!value) return '/'
  const path = value.split('?')[0]?.split('#')[0] ?? ''
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/'
  return ALLOWED_NEXT.has(path) ? path : '/'
}

export function allowedOrigin(value: string | null) {
  if (!value) return null
  return ALLOWED_ORIGINS.some(pattern => pattern.test(value)) ? value : null
}
