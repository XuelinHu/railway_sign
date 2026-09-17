// 口令哈希与令牌签发：全部基于 node:crypto，无第三方依赖。
//
// 口令使用 scrypt（N=2^15, r=8, p=1），异步实现避免阻塞事件循环；
// 令牌为手写 HS256 JWT，密钥优先取环境变量 API_JWT_SECRET，缺省时生成并持久化到 .data/secret。

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { DATA_DIR } from './paths.js'

const scrypt = promisify(crypto.scrypt)

const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEY_LEN = 64
const DEFAULT_TTL_SECONDS = 7 * 24 * 3600

let cachedSecret = null

export const getJwtSecret = () => {
  if (cachedSecret) return cachedSecret
  const fromEnv = process.env.API_JWT_SECRET
  if (typeof fromEnv === 'string' && fromEnv.trim().length >= 16) {
    cachedSecret = fromEnv.trim()
    return cachedSecret
  }
  const secretFile = path.join(DATA_DIR, 'secret')
  try {
    const existing = fs.readFileSync(secretFile, 'utf8').trim()
    if (existing.length >= 16) {
      cachedSecret = existing
      return cachedSecret
    }
  } catch (_) {
    // 文件不存在时继续生成
  }
  const generated = crypto.randomBytes(32).toString('hex')
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(secretFile, generated, { mode: 0o600 })
  cachedSecret = generated
  return cachedSecret
}

export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = await scrypt(String(password), salt, KEY_LEN, SCRYPT_PARAMS)
  return { hash: Buffer.from(derived).toString('hex'), salt }
}

export const verifyPassword = async (password, hash, salt) => {
  if (!hash || !salt) return false
  try {
    const derived = await scrypt(String(password), salt, KEY_LEN, SCRYPT_PARAMS)
    const expected = Buffer.from(String(hash), 'hex')
    const actual = Buffer.from(derived)
    if (expected.length !== actual.length) return false
    return crypto.timingSafeEqual(expected, actual)
  } catch (_) {
    return false
  }
}

const b64u = (input) => Buffer.from(input).toString('base64url')

export const signToken = (payload, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const now = Math.floor(Date.now() / 1000)
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64u(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }))
  const data = `${header}.${body}`
  const signature = crypto.createHmac('sha256', getJwtSecret()).update(data).digest('base64url')
  return `${data}.${signature}`
}

export const verifyToken = (token) => {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) throw new Error('令牌格式错误')
  const [header, body, signature] = parts
  const expected = crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('令牌签名校验失败')
  }
  const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))
  if (decodedHeader?.alg !== 'HS256') throw new Error('令牌算法不受支持')
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (typeof payload.exp === 'number' && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('令牌已过期')
  }
  return payload
}

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('hex')

// 图形验证码：随机 4 位字符 + 干扰线与噪点，直接输出 SVG。
const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXY3456789'

export const createCaptchaSvg = (text) => {
  const width = 132
  const height = 44
  const rng = crypto.randomBytes(text.length * 4)
  const chars = text
    .split('')
    .map((char, index) => {
      const x = 14 + index * 28 + (rng[index] % 5)
      const y = 30 + (rng[index + 1] % 6) - 3
      const rotate = (rng[index + 2] % 44) - 22
      const size = 22 + (rng[index + 3] % 5)
      return `<text x="${x}" y="${y}" font-size="${size}" font-family="Consolas,monospace" font-weight="700"
        fill="#0b7fa8" transform="rotate(${rotate} ${x} ${y})">${char}</text>`
    })
    .join('')
  const lines = Array.from({ length: 4 }, (_, i) => {
    const y1 = 6 + ((rng[i] * 7) % height)
    const y2 = 6 + ((rng[i + 1] * 11) % height)
    return `<path d="M0 ${y1} Q ${width / 2} ${y2} ${width} ${y1}" stroke="rgba(11,127,168,0.45)" fill="none" stroke-width="1.4"/>`
  }).join('')
  const dots = Array.from({ length: 28 }, (_, i) => {
    const x = (rng[i % rng.length] * (i + 3)) % width
    const y = (rng[(i + 2) % rng.length] * (i + 5)) % height
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1" fill="rgba(11,127,168,0.5)"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#eaf6fb"/>${lines}${dots}${chars}</svg>`
}

export const randomCaptchaText = (length = 4) => {
  const bytes = crypto.randomBytes(length)
  return Array.from(bytes, (byte) => CAPTCHA_CHARS[byte % CAPTCHA_CHARS.length]).join('')
}

export default {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  randomToken,
  createCaptchaSvg,
  randomCaptchaText,
  getJwtSecret,
}
