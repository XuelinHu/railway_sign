// 管理台接口：每个菜单一个分页列表接口（统一 page/pageSize/keyword/筛选 + 统一返回结构）。
// 权限点与 roles 表里的 permissions 对应，超级管理员（permissions = ["*"]）自动放行。

import { all, get, run, tx, pageQuery, getConfig, setConfig } from '../lib/db.js'
import { badRequest, notFound, forbidden, str, likeParam, parseJsonColumn } from '../lib/http.js'
import { hashPassword } from '../lib/secure.js'
import { requirePermission, writeOpLog, getRolePermissions } from '../lib/auth.js'

const ROLES = ['admin', 'operator', 'user']
const USER_STATUS = ['active', 'disabled']

// 通用分页列表构造器：所有菜单共用，保证分页语义完全一致。
const buildList = ({ from, select = '*', searchFields = [], filters = [], dateColumn = '', orderBy = 'id DESC' }) => {
  return async (ctx) => {
    const conditions = []
    const params = {}

    const keyword = str(ctx.query.get('keyword'))
    if (keyword && searchFields.length) {
      conditions.push(`(${searchFields.map((field) => `${field} LIKE :kw ESCAPE '\\'`).join(' OR ')})`)
      params.kw = likeParam(keyword)
    }

    for (const filter of filters) {
      const name = filter.param || filter.column
      const value = str(ctx.query.get(name))
      if (!value || value === 'all') continue
      const operator = filter.operator || '='
      conditions.push(`${filter.column} ${operator} :${name}`)
      params[name] = value
    }

    if (dateColumn) {
      const dateFrom = str(ctx.query.get('dateFrom'))
      const dateTo = str(ctx.query.get('dateTo'))
      if (dateFrom) {
        conditions.push(`${dateColumn} >= :date_from`)
        params.date_from = `${dateFrom}T00:00:00.000Z`
      }
      if (dateTo) {
        conditions.push(`${dateColumn} <= :date_to`)
        params.date_to = `${dateTo}T23:59:59.999Z`
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    return pageQuery({
      select,
      from,
      where,
      params,
      orderBy,
      page: ctx.pagination.page,
      pageSize: ctx.pagination.pageSize,
    })
  }
}

const parseId = (ctx) => {
  const id = Number(ctx.params.id)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('无效的 ID')
  return id
}

const requireRecord = (table, id, label) => {
  const row = get(`SELECT * FROM ${table} WHERE id = :id`, { id })
  if (!row) throw notFound(`${label}不存在`)
  return row
}

const listOf = (rows, column) => all(`SELECT DISTINCT ${column} AS value FROM ${rows} WHERE ${column} <> '' ORDER BY ${column}`).map((row) => row.value)

// —— 概览 ——
const overview = async (ctx) => {
  requirePermission(ctx, 'dashboard:view')
  const count = (sql, params) => Number(get(sql, params)?.total || 0)
  const today = new Date().toISOString().slice(0, 10)

  const stats = {
    userTotal: count('SELECT COUNT(*) AS total FROM users'),
    userActive: count("SELECT COUNT(*) AS total FROM users WHERE status = 'active'"),
    userToday: count('SELECT COUNT(*) AS total FROM users WHERE substr(created_at, 1, 10) = :d', { d: today }),
    signalTotal: count('SELECT COUNT(*) AS total FROM signals'),
    signalOnline: count('SELECT COUNT(*) AS total FROM signals WHERE online = 1'),
    signalOffline: count('SELECT COUNT(*) AS total FROM signals WHERE online = 0'),
    alarmTotal: count('SELECT COUNT(*) AS total FROM alarms'),
    alarmPending: count("SELECT COUNT(*) AS total FROM alarms WHERE status = 'pending'"),
    alarmToday: count('SELECT COUNT(*) AS total FROM alarms WHERE substr(occurred_at, 1, 10) = :d', { d: today }),
    orderTotal: count('SELECT COUNT(*) AS total FROM work_orders'),
    orderPending: count("SELECT COUNT(*) AS total FROM work_orders WHERE status = 'pending'"),
    telemetryTotal: count('SELECT COUNT(*) AS total FROM telemetry_records'),
    aiSessionTotal: count('SELECT COUNT(*) AS total FROM ai_sessions'),
    aiMessageTotal: count('SELECT COUNT(*) AS total FROM ai_messages'),
    loginToday: count('SELECT COUNT(*) AS total FROM login_logs WHERE substr(created_at, 1, 10) = :d AND success = 1', { d: today }),
    loginFailedToday: count('SELECT COUNT(*) AS total FROM login_logs WHERE substr(created_at, 1, 10) = :d AND success = 0', { d: today }),
  }

  const alarmLevels = all('SELECT level, COUNT(*) AS total FROM alarms GROUP BY level')
  const alarmStatus = all('SELECT status, COUNT(*) AS total FROM alarms GROUP BY status')
  const deviceTypes = all('SELECT device_type, COUNT(*) AS total FROM alarms GROUP BY device_type')

  const alarmTrend = all(
    `SELECT substr(occurred_at, 1, 10) AS day, COUNT(*) AS total
     FROM alarms WHERE occurred_at >= :since GROUP BY day ORDER BY day`,
    { since: new Date(Date.now() - 13 * 864e5).toISOString() }
  )

  const loginTrend = all(
    `SELECT substr(created_at, 1, 10) AS day, SUM(success) AS success, COUNT(*) - SUM(success) AS failed
     FROM login_logs WHERE created_at >= :since GROUP BY day ORDER BY day`,
    { since: new Date(Date.now() - 13 * 864e5).toISOString() }
  )

  return {
    stats,
    alarmLevels,
    alarmStatus,
    deviceTypes,
    alarmTrend,
    loginTrend,
    recentAlarms: all('SELECT * FROM alarms ORDER BY occurred_at DESC LIMIT 6'),
    recentLogins: all('SELECT * FROM login_logs ORDER BY id DESC LIMIT 6'),
    recentSessions: all('SELECT * FROM ai_sessions ORDER BY id DESC LIMIT 5'),
    roleSummary: all('SELECT role, COUNT(*) AS total FROM users GROUP BY role'),
  }
}

// —— 用户管理 ——
const userList = buildList({
  from: 'FROM users',
  select: 'id, username, name, phone, email, role, status, avatar, remark, login_count, last_login_at, last_login_ip, created_at, updated_at',
  searchFields: ['username', 'name', 'phone', 'email'],
  filters: [{ column: 'role' }, { column: 'status' }],
  dateColumn: 'created_at',
})

const createUser = async (ctx) => {
  const admin = requirePermission(ctx, 'users:edit')
  const body = ctx.body || {}
  const username = str(body.username).toLowerCase()
  const name = str(body.name)
  const role = str(body.role, 'user')
  if (!/^[A-Za-z][A-Za-z0-9_]{3,19}$/.test(username)) throw badRequest('用户名需以字母开头，4-20 位字母数字下划线')
  if (name.length < 2) throw badRequest('姓名至少 2 个字符')
  if (!ROLES.includes(role)) throw badRequest('角色不合法')
  if (get('SELECT id FROM users WHERE username = :u', { u: username })) throw badRequest('用户名已存在')
  const password = String(body.password || 'Init@1234')
  if (password.length < 8) throw badRequest('密码至少 8 位')
  const { hash, salt } = await hashPassword(password)
  const now = new Date().toISOString()
  const inserted = run(
    `INSERT INTO users (username, password_hash, salt, name, phone, email, role, status, remark, created_at, updated_at)
     VALUES (:username, :hash, :salt, :name, :phone, :email, :role, 'active', :remark, :now, :now)`,
    {
      username,
      hash,
      salt,
      name,
      phone: str(body.phone),
      email: str(body.email),
      role,
      remark: str(body.remark),
      now,
    }
  )
  writeOpLog({ user: admin, req: ctx.req, action: '新增用户', targetType: 'user', targetId: inserted.lastInsertRowid, detail: `新增用户 ${username}` })
  return { id: Number(inserted.lastInsertRowid) }
}

const updateUser = async (ctx) => {
  const admin = requirePermission(ctx, 'users:edit')
  const id = parseId(ctx)
  const target = requireRecord('users', id, '用户')
  const body = ctx.body || {}
  const role = str(body.role, target.role)
  const status = str(body.status, target.status)
  if (!ROLES.includes(role)) throw badRequest('角色不合法')
  if (!USER_STATUS.includes(status)) throw badRequest('状态不合法')
  if (target.role === 'admin' && role !== 'admin' && Number(get("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")?.total) <= 1) {
    throw badRequest('系统至少保留一个管理员')
  }
  run(
    `UPDATE users SET name = :name, phone = :phone, email = :email, role = :role, status = :status,
       remark = :remark, updated_at = :now WHERE id = :id`,
    {
      name: str(body.name, target.name),
      phone: str(body.phone, target.phone),
      email: str(body.email, target.email),
      role,
      status,
      remark: str(body.remark, target.remark),
      now: new Date().toISOString(),
      id,
    }
  )
  writeOpLog({ user: admin, req: ctx.req, action: '修改用户', targetType: 'user', targetId: id, detail: `角色=${role} 状态=${status}` })
  return { updated: true }
}

const updateUserStatus = async (ctx) => {
  const admin = requirePermission(ctx, 'users:edit')
  const id = parseId(ctx)
  const target = requireRecord('users', id, '用户')
  const status = str(ctx.body?.status)
  if (!USER_STATUS.includes(status)) throw badRequest('状态不合法')
  if (target.id === admin.id && status === 'disabled') throw badRequest('不能禁用当前登录账号')
  run('UPDATE users SET status = :status, updated_at = :now WHERE id = :id', {
    status,
    now: new Date().toISOString(),
    id,
  })
  writeOpLog({ user: admin, req: ctx.req, action: status === 'active' ? '启用用户' : '禁用用户', targetType: 'user', targetId: id, detail: target.username })
  return { updated: true }
}

const updateUserRole = async (ctx) => {
  const admin = requirePermission(ctx, 'users:edit')
  const id = parseId(ctx)
  const target = requireRecord('users', id, '用户')
  const role = str(ctx.body?.role)
  if (!ROLES.includes(role)) throw badRequest('角色不合法')
  if (target.role === 'admin' && role !== 'admin' && Number(get("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")?.total) <= 1) {
    throw badRequest('系统至少保留一个管理员')
  }
  run('UPDATE users SET role = :role, updated_at = :now WHERE id = :id', { role, now: new Date().toISOString(), id })
  writeOpLog({ user: admin, req: ctx.req, action: '调整角色', targetType: 'user', targetId: id, detail: `${target.username} → ${role}` })
  return { updated: true }
}

const resetUserPassword = async (ctx) => {
  const admin = requirePermission(ctx, 'users:edit')
  const id = parseId(ctx)
  const target = requireRecord('users', id, '用户')
  const password = str(ctx.body?.password, 'Reset@1234')
  if (password.length < 8) throw badRequest('密码至少 8 位')
  const { hash, salt } = await hashPassword(password)
  run('UPDATE users SET password_hash = :hash, salt = :salt, updated_at = :now WHERE id = :id', {
    hash,
    salt,
    now: new Date().toISOString(),
    id,
  })
  writeOpLog({ user: admin, req: ctx.req, action: '重置密码', targetType: 'user', targetId: id, detail: target.username })
  return { updated: true, password }
}

const deleteUser = async (ctx) => {
  const admin = requirePermission(ctx, 'users:edit')
  const id = parseId(ctx)
  const target = requireRecord('users', id, '用户')
  if (target.id === admin.id) throw badRequest('不能删除当前登录账号')
  if (target.username === 'admin') throw badRequest('内置管理员账号不可删除')
  run('DELETE FROM users WHERE id = :id', { id })
  writeOpLog({ user: admin, req: ctx.req, action: '删除用户', targetType: 'user', targetId: id, detail: target.username })
  return { deleted: true }
}

// —— 角色权限 ——
const roleList = async (ctx) => {
  requirePermission(ctx, 'roles:view')
  const result = await buildList({
    from: 'FROM roles',
    searchFields: ['code', 'name', 'description'],
    orderBy: 'sort ASC, id ASC',
  })(ctx)
  result.list = result.list.map((row) => ({ ...row, permissionList: parseJsonColumn(row.permissions, []) }))
  return result
}

const saveRole = async (ctx) => {
  const admin = requirePermission(ctx, 'roles:edit')
  const body = ctx.body || {}
  const code = str(body.code).toLowerCase()
  const name = str(body.name)
  const permissions = Array.isArray(body.permissions) ? body.permissions : parseJsonColumn(body.permissions, [])
  if (!/^[a-z][a-z0-9_-]{1,19}$/.test(code)) throw badRequest('角色标识需为 2-20 位小写字母数字')
  if (!name) throw badRequest('请填写角色名称')
  const now = new Date().toISOString()
  const existing = get('SELECT * FROM roles WHERE code = :code', { code })
  if (existing) {
    if (Number(existing.built_in) === 1 && code === 'admin') throw badRequest('内置管理员角色不可修改权限')
    run(
      `UPDATE roles SET name = :name, description = :description, permissions = :permissions, sort = :sort, updated_at = :now
       WHERE code = :code`,
      { name, description: str(body.description), permissions: JSON.stringify(permissions), sort: Number(body.sort) || 99, now, code }
    )
    writeOpLog({ user: admin, req: ctx.req, action: '修改角色', targetType: 'role', targetId: code, detail: name })
    return { updated: true, code }
  }
  run(
    `INSERT INTO roles (code, name, description, permissions, built_in, sort, created_at, updated_at)
     VALUES (:code, :name, :description, :permissions, 0, :sort, :now, :now)`,
    { code, name, description: str(body.description), permissions: JSON.stringify(permissions), sort: Number(body.sort) || 99, now }
  )
  writeOpLog({ user: admin, req: ctx.req, action: '新增角色', targetType: 'role', targetId: code, detail: name })
  return { created: true, code }
}

const deleteRole = async (ctx) => {
  const admin = requirePermission(ctx, 'roles:edit')
  const code = str(ctx.params.code)
  const role = get('SELECT * FROM roles WHERE code = :code', { code })
  if (!role) throw notFound('角色不存在')
  if (Number(role.built_in) === 1) throw badRequest('内置角色不可删除')
  const used = Number(get('SELECT COUNT(*) AS total FROM users WHERE role = :code', { code })?.total || 0)
  if (used > 0) throw badRequest(`仍有 ${used} 个用户使用该角色，无法删除`)
  run('DELETE FROM roles WHERE code = :code', { code })
  writeOpLog({ user: admin, req: ctx.req, action: '删除角色', targetType: 'role', targetId: code })
  return { deleted: true }
}

const permissionCatalog = async (ctx) => {
  requirePermission(ctx, 'roles:view')
  return {
    permissions: [
      { code: 'dashboard:view', name: '查看概览' },
      { code: 'users:view', name: '查看用户' },
      { code: 'users:edit', name: '编辑用户' },
      { code: 'roles:view', name: '查看角色' },
      { code: 'roles:edit', name: '编辑角色' },
      { code: 'signals:view', name: '查看信号机' },
      { code: 'signals:edit', name: '编辑信号机' },
      { code: 'alarms:view', name: '查看告警' },
      { code: 'alarms:handle', name: '处理告警' },
      { code: 'work-orders:view', name: '查看工单' },
      { code: 'work-orders:edit', name: '编辑工单' },
      { code: 'telemetry:view', name: '查看遥测' },
      { code: 'logs:view', name: '查看日志' },
      { code: 'ai:view', name: '查看智能体会话' },
      { code: 'ai:manage', name: '管理模型' },
      { code: 'ai:use', name: '使用智能体' },
      { code: 'system:config', name: '系统设置' },
    ],
  }
}

// —— 信号机管理 ——
const signalList = buildList({
  from: 'FROM signals',
  searchFields: ['code', 'name', 'station', 'kilometer'],
  filters: [{ column: 'status' }, { column: 'station' }, { column: 'direction' }, { column: 'type' }],
  orderBy: 'id ASC',
})

const saveSignal = async (ctx) => {
  const admin = requirePermission(ctx, 'signals:edit')
  const body = ctx.body || {}
  const now = new Date().toISOString()
  if (ctx.params.id) {
    const id = parseId(ctx)
    const target = requireRecord('signals', id, '信号机')
    run(
      `UPDATE signals SET name = :name, station = :station, kilometer = :kilometer, direction = :direction,
         type = :type, status = :status, online = :online, remark = :remark, updated_at = :now WHERE id = :id`,
      {
        name: str(body.name, target.name),
        station: str(body.station, target.station),
        kilometer: str(body.kilometer, target.kilometer),
        direction: str(body.direction, target.direction),
        type: str(body.type, target.type),
        status: str(body.status, target.status),
        online: body.online === undefined ? target.online : body.online ? 1 : 0,
        remark: str(body.remark, target.remark),
        now,
        id,
      }
    )
    writeOpLog({ user: admin, req: ctx.req, action: '修改信号机', targetType: 'signal', targetId: id, detail: `${target.code}` })
    return { updated: true }
  }
  const code = str(body.code)
  if (!code) throw badRequest('请填写信号机编号')
  if (get('SELECT id FROM signals WHERE code = :code', { code })) throw badRequest('信号机编号已存在')
  const inserted = run(
    `INSERT INTO signals (code, name, station, kilometer, direction, type, status, online, remark, created_at, updated_at)
     VALUES (:code, :name, :station, :kilometer, :direction, :type, :status, :online, :remark, :now, :now)`,
    {
      code,
      name: str(body.name, `${code}信号机`),
      station: str(body.station),
      kilometer: str(body.kilometer),
      direction: str(body.direction, '上行'),
      type: str(body.type, '进站信号机'),
      status: str(body.status, 'green'),
      online: body.online === false ? 0 : 1,
      remark: str(body.remark),
      now,
    }
  )
  writeOpLog({ user: admin, req: ctx.req, action: '新增信号机', targetType: 'signal', targetId: inserted.lastInsertRowid, detail: code })
  return { id: Number(inserted.lastInsertRowid) }
}

const deleteSignal = async (ctx) => {
  const admin = requirePermission(ctx, 'signals:edit')
  const id = parseId(ctx)
  const target = requireRecord('signals', id, '信号机')
  run('DELETE FROM signals WHERE id = :id', { id })
  writeOpLog({ user: admin, req: ctx.req, action: '删除信号机', targetType: 'signal', targetId: id, detail: target.code })
  return { deleted: true }
}

// —— 告警记录 ——
const alarmList = buildList({
  from: 'FROM alarms',
  searchFields: ['code', 'signal_code', 'title', 'content'],
  filters: [{ column: 'level' }, { column: 'status' }, { column: 'device_type', param: 'deviceType' }],
  dateColumn: 'occurred_at',
  orderBy: 'occurred_at DESC',
})

const handleAlarm = async (ctx) => {
  const admin = requirePermission(ctx, 'alarms:handle')
  const id = parseId(ctx)
  const target = requireRecord('alarms', id, '告警')
  const status = str(ctx.body?.status, 'handling')
  if (!['pending', 'handling', 'resolved', 'closed'].includes(status)) throw badRequest('状态不合法')
  const now = new Date().toISOString()
  run(
    `UPDATE alarms SET status = :status, handled_by = :handled_by,
       handled_at = :handled_at, remark = :remark, updated_at = :now WHERE id = :id`,
    {
      status,
      handled_by: str(ctx.body?.handled_by, admin.name || admin.username),
      handled_at: status === 'pending' ? null : now,
      remark: str(ctx.body?.remark, target.remark),
      now,
      id,
    }
  )
  writeOpLog({ user: admin, req: ctx.req, action: '处理告警', targetType: 'alarm', targetId: id, detail: `${target.code} → ${status}` })
  return { updated: true }
}

// —— 工单管理 ——
const orderList = buildList({
  from: 'FROM work_orders',
  searchFields: ['code', 'title', 'assignee', 'station', 'alarm_code'],
  filters: [{ column: 'status' }, { column: 'priority' }, { column: 'type' }],
  dateColumn: 'created_at',
  orderBy: 'created_at DESC',
})

const saveOrder = async (ctx) => {
  const admin = requirePermission(ctx, 'work-orders:edit')
  const body = ctx.body || {}
  const now = new Date().toISOString()
  if (ctx.params.id) {
    const id = parseId(ctx)
    const target = requireRecord('work_orders', id, '工单')
    const status = str(body.status, target.status)
    run(
      `UPDATE work_orders SET title = :title, type = :type, priority = :priority, status = :status,
         assignee = :assignee, station = :station, description = :description, remark = :remark,
         finished_at = :finished_at, updated_at = :now WHERE id = :id`,
      {
        title: str(body.title, target.title),
        type: str(body.type, target.type),
        priority: str(body.priority, target.priority),
        status,
        assignee: str(body.assignee, target.assignee),
        station: str(body.station, target.station),
        description: str(body.description, target.description),
        remark: str(body.remark, target.remark),
        finished_at: status === 'finished' || status === 'closed' ? target.finished_at || now : null,
        now,
        id,
      }
    )
    writeOpLog({ user: admin, req: ctx.req, action: '修改工单', targetType: 'work_order', targetId: id, detail: target.code })
    return { updated: true }
  }
  const title = str(body.title)
  if (!title) throw badRequest('请填写工单标题')
  const code = str(body.code) || `WO${Date.now()}`
  const inserted = run(
    `INSERT INTO work_orders (code, title, type, priority, status, assignee, station, alarm_code,
       description, remark, created_at, updated_at, finished_at)
     VALUES (:code, :title, :type, :priority, :status, :assignee, :station, :alarm_code,
       :description, :remark, :now, :now, NULL)`,
    {
      code,
      title,
      type: str(body.type, '故障处理'),
      priority: str(body.priority, 'medium'),
      status: str(body.status, 'pending'),
      assignee: str(body.assignee),
      station: str(body.station),
      alarm_code: str(body.alarm_code),
      description: str(body.description),
      remark: str(body.remark),
      now,
    }
  )
  writeOpLog({ user: admin, req: ctx.req, action: '新增工单', targetType: 'work_order', targetId: inserted.lastInsertRowid, detail: code })
  return { id: Number(inserted.lastInsertRowid) }
}

const deleteOrder = async (ctx) => {
  const admin = requirePermission(ctx, 'work-orders:edit')
  const id = parseId(ctx)
  const target = requireRecord('work_orders', id, '工单')
  run('DELETE FROM work_orders WHERE id = :id', { id })
  writeOpLog({ user: admin, req: ctx.req, action: '删除工单', targetType: 'work_order', targetId: id, detail: target.code })
  return { deleted: true }
}

// —— 遥测记录 ——
const telemetryList = buildList({
  from: 'FROM telemetry_records',
  searchFields: ['device_id', 'device', 'wifi_ip'],
  filters: [{ column: 'device_id', param: 'deviceId' }, { column: 'water_active', param: 'waterActive' }],
  dateColumn: 'created_at',
  orderBy: 'created_at DESC',
})

const telemetryStats = async (ctx) => {
  requirePermission(ctx, 'telemetry:view')
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  return {
    total: Number(get('SELECT COUNT(*) AS total FROM telemetry_records')?.total || 0),
    last24h: Number(get('SELECT COUNT(*) AS total FROM telemetry_records WHERE created_at >= :since', { since })?.total || 0),
    waterAlerts: Number(get('SELECT COUNT(*) AS total FROM telemetry_records WHERE water_active = 1')?.total || 0),
    devices: all(
      `SELECT device_id, device, COUNT(*) AS total, MAX(created_at) AS last_at, MIN(distance_cm) AS min_distance
       FROM telemetry_records GROUP BY device_id ORDER BY device_id`
    ),
  }
}

// —— 日志 ——
const loginLogList = buildList({
  from: 'FROM login_logs',
  searchFields: ['username', 'ip', 'message'],
  filters: [{ column: 'success' }],
  dateColumn: 'created_at',
  orderBy: 'id DESC',
})

const opLogList = buildList({
  from: 'FROM op_logs',
  searchFields: ['username', 'action', 'detail', 'ip'],
  filters: [{ column: 'action' }, { column: 'target_type', param: 'targetType' }],
  dateColumn: 'created_at',
  orderBy: 'id DESC',
})

const logOptions = async (ctx) => {
  requirePermission(ctx, 'logs:view')
  return {
    actions: listOf('op_logs', 'action'),
    targetTypes: listOf('op_logs', 'target_type'),
  }
}

// —— 智能体会话 ——
const aiSessionList = buildList({
  from: 'FROM ai_sessions',
  searchFields: ['title', 'username', 'model'],
  filters: [{ column: 'model' }, { column: 'username' }],
  dateColumn: 'created_at',
  orderBy: 'id DESC',
})

const aiSessionMessages = async (ctx) => {
  requirePermission(ctx, 'ai:view')
  const id = parseId(ctx)
  const session = requireRecord('ai_sessions', id, '会话')
  const result = await pageQuery({
    from: 'FROM ai_messages',
    where: 'WHERE session_id = :id',
    params: { id },
    orderBy: 'id ASC',
    page: ctx.pagination.page,
    pageSize: ctx.pagination.pageSize,
  })
  return { ...result, session }
}

const deleteAiSession = async (ctx) => {
  const admin = requirePermission(ctx, 'ai:view')
  const id = parseId(ctx)
  const session = requireRecord('ai_sessions', id, '会话')
  tx(() => {
    run('DELETE FROM ai_messages WHERE session_id = :id', { id })
    run('DELETE FROM ai_sessions WHERE id = :id', { id })
  })
  writeOpLog({ user: admin, req: ctx.req, action: '删除会话', targetType: 'ai_session', targetId: id, detail: session.title })
  return { deleted: true }
}

// —— 模型管理（目录 + Ollama 实际状态由 /api/ai/models 提供） ——
const modelList = buildList({
  from: 'FROM ai_models',
  searchFields: ['name', 'display_name', 'family', 'tags'],
  filters: [{ column: 'source' }, { column: 'family' }],
  orderBy: 'is_default DESC, sort ASC, id ASC',
})

const saveModel = async (ctx) => {
  const admin = requirePermission(ctx, 'ai:manage')
  const body = ctx.body || {}
  const name = str(body.name)
  if (!name) throw badRequest('请填写模型名称')
  const now = new Date().toISOString()
  const existing = get('SELECT * FROM ai_models WHERE name = :name', { name })
  if (existing) {
    run(
      `UPDATE ai_models SET display_name = :display_name, description = :description, tags = :tags,
         size_bytes = :size_bytes, sort = :sort, updated_at = :now WHERE name = :name`,
      {
        display_name: str(body.display_name, existing.display_name),
        description: str(body.description, existing.description),
        tags: str(body.tags, existing.tags),
        size_bytes: Number(body.size_bytes) || existing.size_bytes,
        sort: Number(body.sort) || existing.sort,
        now,
        name,
      }
    )
    writeOpLog({ user: admin, req: ctx.req, action: '修改模型', targetType: 'ai_model', targetId: name })
    return { updated: true }
  }
  run(
    `INSERT INTO ai_models (name, display_name, provider, family, parameter_size, quantization, size_bytes,
       description, tags, source, is_default, sort, created_at, updated_at)
     VALUES (:name, :display_name, 'ollama', :family, :parameter_size, :quantization, :size_bytes,
       :description, :tags, 'custom', 0, :sort, :now, :now)`,
    {
      name,
      display_name: str(body.display_name, name),
      family: str(body.family, name.split(':')[0]),
      parameter_size: str(body.parameter_size),
      quantization: str(body.quantization),
      size_bytes: Number(body.size_bytes) || 0,
      description: str(body.description),
      tags: str(body.tags),
      sort: Number(body.sort) || 99,
      now,
    }
  )
  writeOpLog({ user: admin, req: ctx.req, action: '新增模型', targetType: 'ai_model', targetId: name })
  return { created: true }
}

const setDefaultModel = async (ctx) => {
  const admin = requirePermission(ctx, 'ai:manage')
  const name = str(ctx.params.name)
  if (!get('SELECT id FROM ai_models WHERE name = :name', { name })) throw notFound('模型不存在')
  tx(() => {
    run('UPDATE ai_models SET is_default = 0')
    run('UPDATE ai_models SET is_default = 1, updated_at = :now WHERE name = :name', { now: new Date().toISOString(), name })
    setConfig('ai.default_model', name, '智能体默认模型')
  })
  writeOpLog({ user: admin, req: ctx.req, action: '设置默认模型', targetType: 'ai_model', targetId: name })
  return { updated: true, defaultModel: name }
}

const deleteModel = async (ctx) => {
  const admin = requirePermission(ctx, 'ai:manage')
  const name = str(ctx.params.name)
  const model = get('SELECT * FROM ai_models WHERE name = :name', { name })
  if (!model) throw notFound('模型不存在')
  if (Number(model.is_default) === 1) throw badRequest('默认模型不可删除，请先切换默认模型')
  run('DELETE FROM ai_models WHERE name = :name', { name })
  writeOpLog({ user: admin, req: ctx.req, action: '删除模型', targetType: 'ai_model', targetId: name })
  return { deleted: true }
}

// —— 系统设置 ——
const configList = buildList({
  from: 'FROM system_configs',
  searchFields: ['key', 'value', 'description'],
  orderBy: 'key ASC',
})

const updateConfig = async (ctx) => {
  const admin = requirePermission(ctx, 'system:config')
  const key = str(ctx.params.key)
  if (!key) throw badRequest('缺少配置项')
  const value = str(ctx.body?.value)
  const existing = get('SELECT * FROM system_configs WHERE key = :key', { key })
  if (!existing) throw notFound('配置项不存在')
  setConfig(key, value, str(ctx.body?.description, existing.description))
  writeOpLog({ user: admin, req: ctx.req, action: '修改系统配置', targetType: 'config', targetId: key, detail: value })
  return { updated: true }
}

// —— 当前账号可访问的菜单（前端按权限渲染） ——
const myMenus = async (ctx) => {
  const user = ctx.user
  const permissions = getRolePermissions(user.role)
  return {
    role: user.role,
    permissions,
    isAdmin: permissions.includes('*') || user.role === 'admin',
  }
}

export const adminRoutes = [
  { method: 'GET', path: '/api/admin/overview', handler: overview, permission: 'dashboard:view' },
  { method: 'GET', path: '/api/admin/menus', handler: myMenus },

  { method: 'GET', path: '/api/admin/users', handler: userList, permission: 'users:view' },
  { method: 'POST', path: '/api/admin/users', handler: createUser, permission: 'users:edit' },
  { method: 'PUT', path: '/api/admin/users/:id', handler: updateUser, permission: 'users:edit' },
  { method: 'PUT', path: '/api/admin/users/:id/status', handler: updateUserStatus, permission: 'users:edit' },
  { method: 'PUT', path: '/api/admin/users/:id/role', handler: updateUserRole, permission: 'users:edit' },
  { method: 'POST', path: '/api/admin/users/:id/reset-password', handler: resetUserPassword, permission: 'users:edit' },
  { method: 'DELETE', path: '/api/admin/users/:id', handler: deleteUser, permission: 'users:edit' },

  { method: 'GET', path: '/api/admin/roles', handler: roleList, permission: 'roles:view' },
  { method: 'POST', path: '/api/admin/roles', handler: saveRole, permission: 'roles:edit' },
  { method: 'PUT', path: '/api/admin/roles/:code', handler: saveRole, permission: 'roles:edit' },
  { method: 'DELETE', path: '/api/admin/roles/:code', handler: deleteRole, permission: 'roles:edit' },
  { method: 'GET', path: '/api/admin/permissions', handler: permissionCatalog, permission: 'roles:view' },

  { method: 'GET', path: '/api/admin/signals', handler: signalList, permission: 'signals:view' },
  { method: 'POST', path: '/api/admin/signals', handler: saveSignal, permission: 'signals:edit' },
  { method: 'PUT', path: '/api/admin/signals/:id', handler: saveSignal, permission: 'signals:edit' },
  { method: 'DELETE', path: '/api/admin/signals/:id', handler: deleteSignal, permission: 'signals:edit' },

  { method: 'GET', path: '/api/admin/alarms', handler: alarmList, permission: 'alarms:view' },
  { method: 'PUT', path: '/api/admin/alarms/:id/handle', handler: handleAlarm, permission: 'alarms:handle' },

  { method: 'GET', path: '/api/admin/work-orders', handler: orderList, permission: 'work-orders:view' },
  { method: 'POST', path: '/api/admin/work-orders', handler: saveOrder, permission: 'work-orders:edit' },
  { method: 'PUT', path: '/api/admin/work-orders/:id', handler: saveOrder, permission: 'work-orders:edit' },
  { method: 'DELETE', path: '/api/admin/work-orders/:id', handler: deleteOrder, permission: 'work-orders:edit' },

  { method: 'GET', path: '/api/admin/telemetry', handler: telemetryList, permission: 'telemetry:view' },
  { method: 'GET', path: '/api/admin/telemetry/stats', handler: telemetryStats, permission: 'telemetry:view' },

  { method: 'GET', path: '/api/admin/login-logs', handler: loginLogList, permission: 'logs:view' },
  { method: 'GET', path: '/api/admin/op-logs', handler: opLogList, permission: 'logs:view' },
  { method: 'GET', path: '/api/admin/log-options', handler: logOptions, permission: 'logs:view' },

  { method: 'GET', path: '/api/admin/ai-sessions', handler: aiSessionList, permission: 'ai:view' },
  { method: 'GET', path: '/api/admin/ai-sessions/:id/messages', handler: aiSessionMessages, permission: 'ai:view' },
  { method: 'DELETE', path: '/api/admin/ai-sessions/:id', handler: deleteAiSession, permission: 'ai:view' },

  { method: 'GET', path: '/api/admin/models', handler: modelList, permission: 'ai:manage' },
  { method: 'POST', path: '/api/admin/models', handler: saveModel, permission: 'ai:manage' },
  { method: 'PUT', path: '/api/admin/models/:name/default', handler: setDefaultModel, permission: 'ai:manage' },
  { method: 'DELETE', path: '/api/admin/models/:name', handler: deleteModel, permission: 'ai:manage' },

  { method: 'GET', path: '/api/admin/configs', handler: configList, permission: 'system:config' },
  { method: 'PUT', path: '/api/admin/configs/:key', handler: updateConfig, permission: 'system:config' },
]

export { buildList, requirePermission, forbidden, getConfig }
export default adminRoutes
