import crypto from 'node:crypto'

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

const tokenMatches = (providedToken, expectedToken) => {
  if (typeof expectedToken !== 'string' || expectedToken.length === 0) return false
  const provided = Buffer.from(String(providedToken || ''))
  const expected = Buffer.from(expectedToken)
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected)
}

export const isTelemetryIngestAuthorized = ({ providedToken, expectedToken, remoteAddress }) => {
  if (LOOPBACK_ADDRESSES.has(String(remoteAddress || '').toLowerCase())) return true
  return tokenMatches(providedToken, expectedToken)
}
