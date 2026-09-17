// HTTP 工具：统一响应信封、请求体解析、分页参数、SSE、日志。
// 与 server/telemetry-bridge.js 保持同一风格：{ok, error, detail} + Access-Control-* 头。

const nowIso = () => new Date().toISOString()

export const log = (scope, message) => console.log(`${nowIso()} [${scope}] ${message}`)

export const writeCommonHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,*')
  res.setHeader('Access-Control-Max-Age', '600')
  res.setHeader('Cache-Control', 'no-store')
}

export const sendJson = (res, statusCode, payload) => {
  if (res.writableEnded) return
  const body = JSON.stringify(payload)
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(body)
}

export const ok = (res, data = null, extra = {}) => sendJson(res, 200, { ok: true, data, ...extra })

export const fail = (res, statusCode, error, detail) =>
  sendJson(res, statusCode, { ok: false, error, ...(detail ? { detail: String(detail) } : {}) })

// 处理器自行接管响应（例如 SSE 流）时返回该哨兵值，路由层不再写响应。
export const HANDLED = Symbol('handled')

export class HttpError extends Error {
  constructor(statusCode, message, detail) {
    super(message)
    this.statusCode = statusCode
    this.detail = detail
  }
}

export const badRequest = (message, detail) => new HttpError(400, message, detail)
export const unauthorized = (message = '未登录或登录已过期') => new HttpError(401, message)
export const forbidden = (message = '没有访问权限') => new HttpError(403, message)
export const notFound = (message = '资源不存在') => new HttpError(404, message)

const MAX_BODY_BYTES = Number(process.env.API_MAX_BODY_BYTES || 8 * 1024 * 1024)

export const readBody = (req, limit = MAX_BODY_BYTES) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new HttpError(413, '请求体过大', `超过 ${limit} 字节`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', (error) => reject(error))
  })

export const readJsonBody = async (req) => {
  const raw = await readBody(req)
  if (!raw.length) return {}
  try {
    return JSON.parse(raw.toString('utf8'))
  } catch (error) {
    throw badRequest('请求体不是合法 JSON', error.message)
  }
}

export const parsePagination = (url, defaultSize = 10) => {
  const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1)
  const rawSize = Number(url.searchParams.get('pageSize') || defaultSize) || defaultSize
  const pageSize = Math.min(200, Math.max(1, rawSize))
  return { page, pageSize }
}

export const str = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback
  return String(value).trim()
}

// 把用户输入转成安全的 LIKE 参数（转义 % 与 _，避免通配符滥用）。
export const likeParam = (value) => `%${str(value).replace(/[%_\\]/g, (m) => `\\${m}`)}%`

export const parseJsonColumn = (value, fallback) => {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

export const clientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress || ''
}

// —— SSE ——
// 必须 flushHeaders()，否则客户端要等到第一次 write 才拿到响应头。
export const startSse = (res) => {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
}

export const sseSend = (res, event, data) => {
  if (res.writableEnded) return false
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  res.write(`event: ${event}\ndata: ${payload}\n\n`)
  return true
}

export const sseComment = (res, text = 'ping') => {
  if (res.writableEnded) return
  res.write(`: ${text}\n\n`)
}

export default {
  log,
  writeCommonHeaders,
  sendJson,
  ok,
  fail,
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  readBody,
  readJsonBody,
  parsePagination,
  str,
  likeParam,
  parseJsonColumn,
  clientIp,
  startSse,
  sseSend,
  sseComment,
}
