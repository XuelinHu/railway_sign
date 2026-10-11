// 公共服务：图形验证码、注册、登录、退出、当前用户、修改密码、找回/重置密码、个人资料。
// 这是面向所有用户的"用户全流程"接口，除 captcha/register/login/forgot/reset 外都需要登录。

import { get, run, tx, pageQuery, getConfig, setConfig } from '../lib/postgres.js'
import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  str,
  log,
} from '../lib/http.js'
import {
  hashPassword,
  verifyPassword,
  signToken,
  randomToken,
  isBuiltInDemoAccount,
} from '../lib/secure.js'
import {
  createCaptcha,
  verifyCaptcha,
  publicUser,
  getUserByUsername,
  getUserById,
  getRolePermissions,
  resolveUser,
  requireAuth,
  writeLoginLog,
  writeOpLog,
} from '../lib/auth.js'
import { beginOidc, exchangeOidcCode, oidcEnabled, takeOidcTransaction } from '../lib/oidc.js'

const ROLES = ['admin', 'operator', 'user']
const TOKEN_TTL_SECONDS = 7 * 24 * 3600

const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,19}$/
const PHONE_RE = /^1[3-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const assertUsername = (username) => {
  if (!USERNAME_RE.test(username)) {
    throw badRequest('用户名需以字母开头，由 4-20 位字母、数字或下划线组成')
  }
}

const assertPassword = (password) => {
  const value = String(password || '')
  if (value.length < 8 || value.length > 64) throw badRequest('密码长度需为 8-64 位')
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) throw badRequest('密码需同时包含字母和数字')
}

const assertConfirm = (password, confirmPassword) => {
  if (String(password) !== String(confirmPassword)) throw badRequest('两次输入的密码不一致')
}

const requireCaptcha = (body) => {
  const result = verifyCaptcha(body.captchaId, body.captchaCode)
  if (!result.ok) throw badRequest(result.message || '验证码校验失败')
}

const issueToken = (user) =>
  signToken({ uid: user.id, username: user.username, role: user.role }, TOKEN_TTL_SECONDS)

const oidcCookieKey = (req) => String(req.headers.cookie || '').split(';').map((part) => part.trim())
  .find((part) => part.startsWith('railway_sign_oidc='))?.slice('railway_sign_oidc='.length) || ''

const oidcConfig = async () => ({ enabled: oidcEnabled() })

const oidcStart = async (ctx) => {
  const mode = ctx.body?.mode === 'link' ? 'link' : 'login'
  if (mode === 'link') requireAuth(ctx)
  const result = await beginOidc({
    mode,
    userId: mode === 'link' ? ctx.user.id : null,
    redirectUri: String(ctx.body?.redirectUri || ''),
  })
  const secure = new URL(String(ctx.body.redirectUri)).protocol === 'https:'
  ctx.res.appendHeader('Set-Cookie', `railway_sign_oidc=${result.cookieKey}; HttpOnly; SameSite=Lax; Path=/api/auth/oidc; Max-Age=600${secure ? '; Secure' : ''}`)
  return { authorizationUrl: result.authorizationUrl }
}

const oidcCallback = async (ctx) => {
  const body = ctx.body || {}
  const transaction = takeOidcTransaction(oidcCookieKey(ctx.req), String(body.state || ''))
  ctx.res.appendHeader('Set-Cookie', `railway_sign_oidc=; HttpOnly; SameSite=Lax; Path=/api/auth/oidc; Max-Age=0${transaction?.redirectUri?.startsWith('https:') ? '; Secure' : ''}`)
  if (!transaction) throw unauthorized('统一登录状态已过期，请重新开始')
  if (transaction.mode === 'link' && Number(ctx.user?.id) !== Number(transaction.userId)) {
    throw unauthorized('绑定账号的登录状态已失效，请重新登录后重试')
  }
  const { subject } = await exchangeOidcCode(transaction, String(body.code || ''))
  if (transaction.mode === 'link') {
    await tx(async () => {
      const current = await get('SELECT id, oidc_subject FROM users WHERE id = :id AND status = \'active\' FOR UPDATE', { id: transaction.userId })
      if (!current) throw unauthorized('本地账号不存在或已停用')
      if (current.oidc_subject && current.oidc_subject !== subject) throw badRequest('该本地账号已绑定其他统一身份')
      const duplicate = await get('SELECT id FROM users WHERE oidc_subject = :subject AND id <> :id', { subject, id: transaction.userId })
      if (duplicate) throw badRequest('该统一身份已绑定其他 Railway Sign 账号')
      await run('UPDATE users SET oidc_subject = :subject, updated_at = :now WHERE id = :id', { subject, now: new Date().toISOString(), id: transaction.userId })
    })
    return { mode: 'link', linked: true }
  }
  const user = await get('SELECT * FROM users WHERE oidc_subject = :subject', { subject })
  if (!user || user.status !== 'active') throw unauthorized('该统一身份尚未绑定有效的 Railway Sign 账号，请先用本地账号登录并绑定')
  await run('UPDATE users SET login_count = login_count + 1, last_login_at = :now, updated_at = :now WHERE id = :id', { now: new Date().toISOString(), id: user.id })
  const fresh = await getUserById(user.id)
  await writeLoginLog({ user: fresh, username: fresh.username, req: ctx.req, success: true, message: '统一账号登录成功' })
  return { mode: 'login', token: issueToken(fresh), user: publicUser(fresh), permissions: await getRolePermissions(fresh.role) }
}

const oidcStatus = async (ctx) => {
  const user = requireAuth(ctx)
  const row = await get('SELECT oidc_subject IS NOT NULL AS linked FROM users WHERE id = :id', { id: user.id })
  return { enabled: oidcEnabled(), linked: Boolean(row?.linked) }
}

// 图形验证码：返回 SVG（前端直接渲染，无需图片接口）。
const captcha = async () => {
  const { id, svg } = createCaptcha()
  return { id, svg }
}

// 注册
const register = async (ctx) => {
  const body = ctx.body || {}
  const username = str(body.username).toLowerCase()
  const password = String(body.password || '')
  const name = str(body.name)
  const phone = str(body.phone)
  const email = str(body.email)

  requireCaptcha(body)
  assertUsername(username)
  assertPassword(password)
  assertConfirm(password, body.confirmPassword)
  if (name.length < 2 || name.length > 20) throw badRequest('姓名长度需为 2-20 位')
  if (phone && !PHONE_RE.test(phone)) throw badRequest('手机号格式不正确')
  if (email && !EMAIL_RE.test(email)) throw badRequest('邮箱格式不正确')
  if (await getUserByUsername(username)) throw badRequest('该用户名已被注册')
  if (phone && await get('SELECT id FROM users WHERE phone = :phone', { phone })) {
    throw badRequest('该手机号已被注册')
  }

  const { hash, salt } = await hashPassword(password)
  const now = new Date().toISOString()
  const user = await tx(async () => {
    const inserted = await run(
      `INSERT INTO users (username, password_hash, salt, name, phone, email, role, status, remark, created_at, updated_at)
       VALUES (:username, :hash, :salt, :name, :phone, :email, 'user', 'active', :remark, :created_at, :updated_at)`,
      {
        username,
        hash,
        salt,
        name,
        phone,
        email,
        remark: '自助注册',
        created_at: now,
        updated_at: now,
      }
    )
    const createdUser = await getUserById(Number(inserted.lastInsertRowid))
    await writeLoginLog({ user: createdUser, username, req: ctx.req, success: true, message: '注册成功并自动登录' })
    await writeOpLog({ user: createdUser, req: ctx.req, action: '用户注册', targetType: 'user', targetId: createdUser.id, detail: `新用户 ${username} 注册` })
    return createdUser
  })
  log('auth', `register ${username}`)
  return { token: issueToken(user), user: publicUser(user), permissions: await getRolePermissions(user.role) }
}

// 登录
const login = async (ctx) => {
  const body = ctx.body || {}
  const username = str(body.username).toLowerCase()
  const password = String(body.password || '')
  if (!username || !password) throw badRequest('请输入用户名和密码')
  requireCaptcha(body)

  const user = await getUserByUsername(username)
  if (!user) {
    await writeLoginLog({ username, req: ctx.req, success: false, message: '用户名不存在' })
    throw unauthorized('用户名或密码错误')
  }
  if (process.env.NODE_ENV === 'production' && isBuiltInDemoAccount(user)) {
    await writeLoginLog({ user, username, req: ctx.req, success: false, message: '演示账号尚未完成生产管理员引导' })
    throw unauthorized('系统内置演示账号已停用，请先完成管理员安全引导')
  }
  const valid = await verifyPassword(password, user.password_hash, user.salt)
  if (!valid) {
    await writeLoginLog({ user, username, req: ctx.req, success: false, message: '密码错误' })
    throw unauthorized('用户名或密码错误')
  }
  if (user.status !== 'active') {
    await writeLoginLog({ user, username, req: ctx.req, success: false, message: '账号已禁用' })
    throw forbidden('账号已被禁用，请联系管理员')
  }

  const ip = ctx.ip || ''
  await run(
    `UPDATE users SET login_count = login_count + 1, last_login_at = :now, last_login_ip = :ip, updated_at = :now
     WHERE id = :id`,
    { now: new Date().toISOString(), ip, id: user.id }
  )
  const fresh = await getUserById(user.id)
  await writeLoginLog({ user: fresh, username, req: ctx.req, success: true, message: '登录成功' })
  return { token: issueToken(fresh), user: publicUser(fresh), permissions: await getRolePermissions(fresh.role) }
}

const logout = async (ctx) => {
  const user = ctx.user
  if (user) await writeOpLog({ user, req: ctx.req, action: '退出登录', targetType: 'user', targetId: user.id })
  return { loggedOut: true }
}

const me = async (ctx) => {
  const user = requireAuth(ctx)
  return {
    user: publicUser(user),
    permissions: await getRolePermissions(user.role),
    config: {
      siteName: await getConfig('system.site_name', '铁路信号机数字孪生监测与可视化分析平台'),
      version: await getConfig('system.copyright', 'V1.0'),
      defaultModel: await getConfig('ai.default_model', ''),
      ttsVoice: await getConfig('voice.tts_voice', 'zh-CN-XiaoxiaoNeural'),
    },
  }
}

// 修改密码（登录后）
const changePassword = async (ctx) => {
  const user = requireAuth(ctx)
  const body = ctx.body || {}
  const oldPassword = String(body.oldPassword || '')
  const newPassword = String(body.newPassword || '')
  if (!oldPassword) throw badRequest('请输入原密码')
  assertPassword(newPassword)
  assertConfirm(newPassword, body.confirmPassword)
  if (oldPassword === newPassword) throw badRequest('新密码不能与原密码相同')

  const valid = await verifyPassword(oldPassword, user.password_hash, user.salt)
  if (!valid) throw badRequest('原密码不正确')

  const { hash, salt } = await hashPassword(newPassword)
  await run(
    `UPDATE users SET password_hash = :hash, salt = :salt, updated_at = :now WHERE id = :id`,
    { hash, salt, now: new Date().toISOString(), id: user.id }
  )
  await writeOpLog({ user, req: ctx.req, action: '修改密码', targetType: 'user', targetId: user.id })
  return { updated: true, message: '密码修改成功，请使用新密码重新登录' }
}

// 忘记密码：校验用户名 + 预留手机号，签发一次性重置令牌（演示模式直接回显）
const forgotPassword = async (ctx) => {
  const body = ctx.body || {}
  const username = str(body.username).toLowerCase()
  const phone = str(body.phone)
  if (!username) throw badRequest('请输入用户名')
  if (!phone) throw badRequest('请输入注册时预留的手机号')
  requireCaptcha(body)

  const user = await getUserByUsername(username)
  if (!user) throw notFound('该用户名不存在')
  if (!user.phone || user.phone !== phone) throw badRequest('手机号与注册信息不一致')
  if (user.status !== 'active') throw forbidden('账号已被禁用，请联系管理员')

  const token = randomToken(24)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await run('UPDATE password_resets SET used = 1 WHERE user_id = :uid AND used = 0', { uid: user.id })
  await run(
    `INSERT INTO password_resets (user_id, username, token, used, expires_at, created_at)
     VALUES (:user_id, :username, :token, 0, :expires_at, :created_at)`,
    { user_id: user.id, username: user.username, token, expires_at: expiresAt, created_at: new Date().toISOString() }
  )
  await writeOpLog({ user, req: ctx.req, action: '申请重置密码', targetType: 'user', targetId: user.id })
  const visible = await getConfig('system.reset_token_visible', '1') === '1'
  return {
    issued: true,
    expiresAt,
    // 演示环境没有短信网关，令牌直接回显便于走通流程；生产环境把该配置置 0。
    token: visible ? token : undefined,
    message: visible
      ? '重置令牌已生成（演示模式直接显示）'
      : '重置令牌已通过短信发送，请查收',
  }
}

// 重置密码
const resetPassword = async (ctx) => {
  const body = ctx.body || {}
  const username = str(body.username).toLowerCase()
  const token = str(body.token)
  const newPassword = String(body.newPassword || '')
  if (!username || !token) throw badRequest('缺少用户名或重置令牌')
  assertPassword(newPassword)
  assertConfirm(newPassword, body.confirmPassword)

  const record = await get(
    'SELECT * FROM password_resets WHERE token = :token AND username = :username ORDER BY id DESC LIMIT 1',
    { token, username }
  )
  if (!record) throw badRequest('重置令牌无效')
  if (Number(record.used) === 1) throw badRequest('重置令牌已使用')
  if (new Date(record.expires_at).getTime() < Date.now()) throw badRequest('重置令牌已过期，请重新申请')

  const user = await getUserById(record.user_id)
  if (!user) throw notFound('用户不存在')

  const { hash, salt } = await hashPassword(newPassword)
  await run(
    `UPDATE users SET password_hash = :hash, salt = :salt, updated_at = :now WHERE id = :id`,
    { hash, salt, now: new Date().toISOString(), id: user.id }
  )
  await run('UPDATE password_resets SET used = 1 WHERE id = :id', { id: record.id })
  await writeOpLog({ user, req: ctx.req, action: '重置密码', targetType: 'user', targetId: user.id })
  log('auth', `reset password for ${username}`)
  return { updated: true, message: '密码已重置，请使用新密码登录' }
}

// 个人资料
const updateProfile = async (ctx) => {
  const user = requireAuth(ctx)
  const body = ctx.body || {}
  const name = str(body.name, user.name)
  const phone = str(body.phone)
  const email = str(body.email)
  const avatar = str(body.avatar)
  if (name.length < 2 || name.length > 20) throw badRequest('姓名长度需为 2-20 位')
  if (phone && !PHONE_RE.test(phone)) throw badRequest('手机号格式不正确')
  if (email && !EMAIL_RE.test(email)) throw badRequest('邮箱格式不正确')
  if (phone) {
    const exists = await get('SELECT id FROM users WHERE phone = :phone AND id <> :id', { phone, id: user.id })
    if (exists) throw badRequest('该手机号已被其他账号使用')
  }
  await run(
    `UPDATE users SET name = :name, phone = :phone, email = :email, avatar = :avatar, updated_at = :now
     WHERE id = :id`,
    { name, phone, email, avatar, now: new Date().toISOString(), id: user.id }
  )
  const fresh = await getUserById(user.id)
  await writeOpLog({ user, req: ctx.req, action: '修改个人资料', targetType: 'user', targetId: user.id })
  return { user: publicUser(fresh) }
}

// 当前用户的登录记录（个人中心用，分页）
const myLoginLogs = async (ctx) => {
  const user = requireAuth(ctx)
  const { page, pageSize } = ctx.pagination
  return await pageQuery({
    from: 'FROM login_logs',
    where: 'WHERE user_id = :uid',
    params: { uid: user.id },
    orderBy: 'id DESC',
    page,
    pageSize,
  })
}

export const authRoutes = [
  { method: 'GET', path: '/api/auth/oidc/config', handler: oidcConfig, public: true },
  { method: 'POST', path: '/api/auth/oidc/start', handler: oidcStart, public: true },
  { method: 'POST', path: '/api/auth/oidc/callback', handler: oidcCallback, public: true },
  { method: 'GET', path: '/api/auth/oidc/status', handler: oidcStatus },
  { method: 'GET', path: '/api/auth/captcha', handler: captcha, public: true },
  { method: 'POST', path: '/api/auth/register', handler: register, public: true },
  { method: 'POST', path: '/api/auth/login', handler: login, public: true },
  { method: 'POST', path: '/api/auth/forgot-password', handler: forgotPassword, public: true },
  { method: 'POST', path: '/api/auth/reset-password', handler: resetPassword, public: true },
  { method: 'POST', path: '/api/auth/logout', handler: logout },
  { method: 'GET', path: '/api/auth/me', handler: me },
  { method: 'POST', path: '/api/auth/change-password', handler: changePassword },
  { method: 'POST', path: '/api/auth/profile', handler: updateProfile },
  { method: 'GET', path: '/api/auth/login-logs', handler: myLoginLogs },
]

export { resolveUser, setConfig, ROLES }
export default authRoutes
