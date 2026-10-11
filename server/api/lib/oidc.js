import crypto from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const issuer = String(process.env.OIDC_ISSUER || '').replace(/\/$/, '')
const clientId = String(process.env.OIDC_CLIENT_ID || '')
const transactions = new Map()
let providerPromise
let remoteJwks

export const oidcEnabled = () => Boolean(issuer && clientId)

async function provider() {
  if (!oidcEnabled()) throw new Error('统一登录尚未配置')
  if (process.env.NODE_ENV === 'production' && !issuer.startsWith('https://')) throw new Error('生产环境统一身份服务必须使用 HTTPS')
  providerPromise ||= fetch(`${issuer}/.well-known/openid-configuration`).then(async (response) => {
    if (!response.ok) throw new Error('无法读取统一身份服务配置')
    const metadata = await response.json()
    if (metadata.issuer !== issuer || !metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.jwks_uri) {
      throw new Error('统一身份服务配置不完整或 issuer 不匹配')
    }
    remoteJwks = createRemoteJWKSet(new URL(metadata.jwks_uri))
    return metadata
  }).catch((error) => {
    providerPromise = undefined
    throw error
  })
  return providerPromise
}

const random = (size = 32) => crypto.randomBytes(size).toString('base64url')
const hash = (value) => crypto.createHash('sha256').update(value).digest('base64url')

export async function beginOidc({ mode, userId, redirectUri }) {
  const metadata = await provider()
  const allowed = new Set(String(process.env.OIDC_REDIRECT_ORIGINS || 'http://localhost:4028,http://127.0.0.1:4028,https://192.168.1.9:4028').split(',').map((value) => value.trim()).filter(Boolean))
  const redirect = new URL(redirectUri)
  if (!allowed.has(redirect.origin) || redirect.pathname !== '/oidc/callback' || redirect.search || redirect.hash) {
    throw new Error('统一登录回调地址未登记')
  }
  const state = random(24)
  const verifier = random(48)
  const nonce = random(24)
  const cookieKey = random(24)
  const now = Date.now()
  for (const [key, item] of transactions) if (item.expiresAt <= now) transactions.delete(key)
  if (transactions.size >= 1000) throw new Error('统一登录暂不可用，请稍后重试')
  transactions.set(cookieKey, { state, verifier, nonce, mode, userId: userId || null, redirectUri, expiresAt: now + 10 * 60_000 })
  const authorization = new URL(metadata.authorization_endpoint)
  authorization.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: redirectUri,
    state,
    nonce,
    code_challenge: hash(verifier),
    code_challenge_method: 'S256',
  }).toString()
  return { authorizationUrl: authorization.toString(), cookieKey }
}

export function takeOidcTransaction(cookieKey, state) {
  const transaction = transactions.get(cookieKey)
  transactions.delete(cookieKey)
  if (!transaction || transaction.expiresAt <= Date.now() || transaction.state !== state) return null
  return transaction
}

export async function exchangeOidcCode(transaction, code) {
  const metadata = await provider()
  const response = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: transaction.redirectUri,
      code_verifier: transaction.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error('统一身份服务拒绝了授权码')
  const tokens = await response.json()
  if (!tokens.id_token) throw new Error('统一身份服务未返回 ID token')
  const verified = await jwtVerify(tokens.id_token, remoteJwks, {
    issuer,
    audience: clientId,
    algorithms: ['RS256'],
  })
  if (verified.protectedHeader.alg !== 'RS256' || !verified.payload.sub) throw new Error('统一身份凭证无效')
  if (verified.payload.nonce !== transaction.nonce) throw new Error('统一身份凭证 nonce 不匹配')
  if (verified.payload.azp && verified.payload.azp !== clientId) throw new Error('统一身份凭证客户端不匹配')
  return { subject: verified.payload.sub, claims: verified.payload }
}
