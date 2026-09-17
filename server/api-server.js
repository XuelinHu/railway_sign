// 统一后台服务：用户体系 + 管理台接口 + 智能体（Ollama 代理）+ 遥测入库 + 语音转发。
//
// 端口 8037（FRP 公网 18037），零第三方依赖：node:http + node:sqlite + node:crypto。
// 启动：npm run api

import http from 'node:http'
import { initDatabase, DB_FILE, getConfig } from './api/lib/db.js'
import {
  writeCommonHeaders,
  sendJson,
  ok,
  fail,
  HttpError,
  readJsonBody,
  parsePagination,
  clientIp,
  log,
  HANDLED,
} from './api/lib/http.js'
import { resolveUser, hasPermission } from './api/lib/auth.js'
import { authRoutes } from './api/routes/auth.js'
import { adminRoutes } from './api/routes/admin.js'
import { aiRoutes } from './api/routes/ai.js'
import { telemetryRoutes } from './api/routes/telemetry.js'
import { voiceRoutes } from './api/routes/voice.js'

const PORT = Number(process.env.API_PORT || 8037)
const HOST = process.env.API_HOST || '0.0.0.0'

const routes = [...authRoutes, ...adminRoutes, ...aiRoutes, ...telemetryRoutes, ...voiceRoutes]

// 把 /api/admin/users/:id/status 这类模板与真实路径做段匹配。
const matchPath = (template, pathname) => {
  const tParts = template.split('/').filter(Boolean)
  const pParts = pathname.split('/').filter(Boolean)
  if (tParts.length !== pParts.length) return null
  const params = {}
  for (let i = 0; i < tParts.length; i += 1) {
    const t = tParts[i]
    if (t.startsWith(':')) {
      params[t.slice(1)] = decodeURIComponent(pParts[i])
      continue
    }
    if (t !== pParts[i]) return null
  }
  return params
}

const findRoute = (method, pathname) => {
  for (const route of routes) {
    if (route.method !== method) continue
    const params = matchPath(route.path, pathname)
    if (params) return { route, params }
  }
  return null
}

const shouldReadBody = (method) => method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'

const server = http.createServer(async (req, res) => {
  writeCommonHeaders(res)

  if (!req.url) {
    res.statusCode = 400
    return res.end('Bad request')
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname
  const method = (req.method || 'GET').toUpperCase()

  if (method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  if (pathname === '/api/health' && method === 'GET') {
    return ok(res, {
      service: 'railway-sign-api',
      port: PORT,
      dbFile: DB_FILE,
      siteName: getConfig('system.site_name', ''),
      time: new Date().toISOString(),
    })
  }

  const matched = findRoute(method, pathname)
  if (!matched) {
    return fail(res, 404, 'Not Found', `${method} ${pathname}`)
  }

  try {
    const { route, params } = matched
    const user = resolveUser(req)
    const ctx = {
      req,
      res,
      url,
      method,
      pathname,
      params,
      query: url.searchParams,
      pagination: parsePagination(url, Number(getConfig('system.page_size', '10')) || 10),
      user,
      ip: clientIp(req),
      body: null,
    }

    if (!route.public && !user) throw new HttpError(401, '未登录或登录已过期')
    if (route.permission && !hasPermission(user, route.permission)) {
      throw new HttpError(403, `缺少权限：${route.permission}`)
    }

    if (shouldReadBody(method) && !route.raw) {
      const contentType = String(req.headers['content-type'] || '')
      if (!contentType || contentType.includes('application/json')) {
        ctx.body = await readJsonBody(req)
      } else {
        // 音频等原始字节流：不预读，交给处理器按需 readBody(req)
        ctx.contentType = contentType
      }
    }

    const result = await route.handler(ctx)
    if (result === HANDLED) return undefined
    return ok(res, result === undefined ? null : result)
  } catch (error) {
    if (error instanceof HttpError) {
      return fail(res, error.statusCode, error.message, error.detail)
    }
    log('api', `error ${method} ${pathname}: ${error?.message}`)
    if (error?.code === 'ERR_SQLITE_ERROR') {
      return fail(res, 500, '数据库操作失败', error.message)
    }
    return fail(res, 500, '服务器内部错误', error?.message)
  }
})

const bootstrap = async () => {
  const { dbFile } = await initDatabase()
  server.listen(PORT, HOST, () => {
    log('api', `listening: http://${HOST}:${PORT}  (db: ${dbFile})`)
    log('api', '默认账号：admin/Admin@123  operator/Operator@123  user/User@123')
  })
}

bootstrap().catch((error) => {
  console.error('后台启动失败:', error)
  process.exit(1)
})

export default server
