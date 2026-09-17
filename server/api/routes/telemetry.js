// 遥测接口：接收 8036 遥测桥转发上来的数据并落库，供管理台「遥测记录」分页查询。

import { get, run, pageQuery } from '../lib/db.js'
import { badRequest, notFound, unauthorized, str } from '../lib/http.js'
import { requirePermission } from '../lib/auth.js'

// 遥测桥与本服务同为内网服务，用一个共享令牌防止外部伪造上报。
const INGEST_TOKEN = process.env.API_INGEST_TOKEN || 'railway-sign-ingest'

const ingest = async (ctx) => {
  const token = str(ctx.req.headers['x-ingest-token'])
  const fromLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ctx.ip)
  if (token !== INGEST_TOKEN && !fromLoopback) throw unauthorized('遥测上报令牌无效')

  const payload = ctx.body || {}
  const deviceId = str(payload.device_id, 'unknown')
  const now = new Date().toISOString()
  const inserted = run(
    `INSERT INTO telemetry_records (device_id, device, distance_cm, distance_m, water_active,
       wifi_ip, uptime_ms, ts_ms, raw, created_at)
     VALUES (:device_id, :device, :distance_cm, :distance_m, :water_active,
       :wifi_ip, :uptime_ms, :ts_ms, :raw, :created_at)`,
    {
      device_id: deviceId,
      device: str(payload.device, deviceId),
      distance_cm: payload.distance_cm ?? null,
      distance_m: payload.distance_m ?? null,
      water_active: payload.water_active ?? null,
      wifi_ip: str(payload.wifi_ip),
      uptime_ms: payload.uptime_ms ?? null,
      ts_ms: payload.ts_ms ?? null,
      raw: JSON.stringify(payload).slice(0, 4000),
      created_at: now,
    }
  )
  return { id: Number(inserted.lastInsertRowid), createdAt: now }
}

const latest = async (ctx) => {
  requirePermission(ctx, 'telemetry:view')
  const row = get('SELECT * FROM telemetry_records ORDER BY id DESC LIMIT 1')
  return { record: row || null }
}

const list = async (ctx) => {
  requirePermission(ctx, 'telemetry:view')
  const keyword = str(ctx.query.get('keyword'))
  const deviceId = str(ctx.query.get('deviceId'))
  const conditions = []
  const params = {}
  if (keyword) {
    conditions.push("(device LIKE :kw ESCAPE '\\' OR device_id LIKE :kw ESCAPE '\\')")
    params.kw = `%${keyword}%`
  }
  if (deviceId && deviceId !== 'all') {
    conditions.push('device_id = :device_id')
    params.device_id = deviceId
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return pageQuery({
    from: 'FROM telemetry_records',
    where,
    params,
    orderBy: 'id DESC',
    page: ctx.pagination.page,
    pageSize: ctx.pagination.pageSize,
  })
}

const remove = async (ctx) => {
  requirePermission(ctx, 'telemetry:view')
  const id = Number(ctx.params.id)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('无效的 ID')
  const row = get('SELECT * FROM telemetry_records WHERE id = :id', { id })
  if (!row) throw notFound('记录不存在')
  run('DELETE FROM telemetry_records WHERE id = :id', { id })
  return { deleted: true }
}

export const telemetryRoutes = [
  // 供遥测桥（8036）服务端调用，不需要用户登录
  { method: 'POST', path: '/api/telemetry/ingest', handler: ingest, public: true },
  { method: 'GET', path: '/api/telemetry/latest', handler: latest, permission: 'telemetry:view' },
  { method: 'GET', path: '/api/telemetry/records', handler: list, permission: 'telemetry:view' },
  { method: 'DELETE', path: '/api/telemetry/records/:id', handler: remove, permission: 'telemetry:view' },
]

export { INGEST_TOKEN }
export default telemetryRoutes
