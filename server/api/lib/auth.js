// 鉴权中间件与审计：JWT 解析、角色/权限判定、登录日志与操作日志。

import crypto from 'node:crypto'
import { get, run, pageQuery } from './db.js'
import { unauthorized, forbidden, clientIp, parseJsonColumn } from './http.js'
import { verifyToken, createCaptchaSvg, randomCaptchaText } from './secure.js'

// —— 图形验证码（内存存储 + 定期清理）——
const captchaStore = new Map()
const CAPTCHA_TTL_MS = 5 * 60 * 1000

const cleanupCaptchas = () => {
  const now = Date.now()
  for (const [id, item] of captchaStore) {
    if (item.expiresAt <= now) captchaStore.delete(id)
  }
}
setInterval(cleanupCaptchas, 60 * 1000).unref?.()

export const createCaptcha = () => {
  cleanupCaptchas()
  const code = randomCaptchaText(4)
  const id = crypto.randomBytes(12).toString('hex')
  captchaStore.set(id, { code: code.toUpperCase(), expiresAt: Date.now() + CAPTCHA_TTL_MS })
  return { id, code, svg: createCaptchaSvg(code) }
}

export const verifyCaptcha = (id, code) => {
  const key = String(id || '')
  const item = captchaStore.get(key)
  if (!item) return { ok: false, message: '验证码不存在或已过期' }
  captchaStore.delete(key)
  if (item.expiresAt <= Date.now()) return { ok: false, message: '验证码已过期' }
  if (item.code !== String(code || '').trim().toUpperCase()) return { ok: false, message: '验证码不正确' }
  return { ok: true }
}

// —— 用户与权限 ——
export const publicUser = (row) => {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    phone: row.phone,
    email: row.email,
    role: row.role,
    status: row.status,
    avatar: row.avatar,
    remark: row.remark,
    login_count: row.login_count,
    last_login_at: row.last_login_at,
    last_login_ip: row.last_login_ip,
    created_at: row.created_at,
  }
}

export const getUserByUsername = (username) =>
  get('SELECT * FROM users WHERE username = :username', { username: String(username || '') })

export const getUserById = (id) => get('SELECT * FROM users WHERE id = :id', { id: Number(id) || 0 })

export const getRolePermissions = (roleCode) => {
  const role = get('SELECT * FROM roles WHERE code = :code', { code: roleCode || 'user' })
  if (!role) return []
  return parseJsonColumn(role.permissions, [])
}

export const hasPermission = (user, permission) => {
  if (!user) return false
  const permissions = getRolePermissions(user.role)
  if (permissions.includes('*')) return true
  return permissions.includes(permission)
}

export const extractToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7).trim()
  return ''
}

export const resolveUser = (req) => {
  const token = extractToken(req)
  if (!token) return null
  try {
    const payload = verifyToken(token)
    const user = getUserById(payload.uid)
    if (!user) return null
    if (user.status !== 'active') return null
    return user
  } catch (_) {
    return null
  }
}

export const requireAuth = (ctx) => {
  if (!ctx.user) throw unauthorized()
  return ctx.user
}

export const requirePermission = (ctx, permission) => {
  const user = requireAuth(ctx)
  if (!hasPermission(user, permission)) throw forbidden(`缺少权限：${permission}`)
  return user
}

export const requireAdmin = (ctx) => {
  const user = requireAuth(ctx)
  if (user.role !== 'admin') throw forbidden('仅管理员可访问')
  return user
}

// —— 审计日志 ——
export const writeLoginLog = ({ user, username, req, success, message }) => {
  run(
    `INSERT INTO login_logs (user_id, username, ip, user_agent, success, message, created_at)
     VALUES (:user_id, :username, :ip, :ua, :success, :message, :created_at)`,
    {
      user_id: user?.id || 0,
      username: username || user?.username || '',
      ip: clientIp(req),
      ua: String(req.headers['user-agent'] || '').slice(0, 240),
      success,
      message,
      created_at: new Date().toISOString(),
    }
  )
}

export const writeOpLog = ({ user, req, action, targetType = '', targetId = '', detail = '' }) => {
  run(
    `INSERT INTO op_logs (user_id, username, action, target_type, target_id, detail, ip, created_at)
     VALUES (:user_id, :username, :action, :target_type, :target_id, :detail, :ip, :created_at)`,
    {
      user_id: user?.id || 0,
      username: user?.username || '',
      action,
      target_type: targetType,
      target_id: String(targetId || ''),
      detail,
      ip: clientIp(req),
      created_at: new Date().toISOString(),
    }
  )
}

export { pageQuery }

export default {
  createCaptcha,
  verifyCaptcha,
  publicUser,
  getUserByUsername,
  getUserById,
  getRolePermissions,
  hasPermission,
  extractToken,
  resolveUser,
  requireAuth,
  requirePermission,
  requireAdmin,
  writeLoginLog,
  writeOpLog,
}
