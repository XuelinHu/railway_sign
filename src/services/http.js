// 统一 HTTP 客户端：同源访问 /api（dev/preview 由 vite 代理到 8037）。
// 约定：所有接口返回 {ok, data} 或 {ok:false, error}；本模块把失败转成异常抛出。

const TOKEN_KEY = 'railway_sign_token'
const BASE = '/api'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch (_) {
    return ''
  }
}

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch (_) {
    /* 隐私模式下忽略 */
  }
}

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// 401 时通知上层（router 跳登录），避免 http.js 直接依赖 router 造成循环引用。
const listeners = new Set()
export const onUnauthorized = (handler) => {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export const buildQuery = (params = {}) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.append(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

const request = async (method, path, { body, params, raw, headers = {}, timeout = 30000 } = {}) => {
  const token = getToken()
  const init = {
    method,
    headers: { ...headers },
    signal: AbortSignal.timeout(timeout),
  }
  if (token) init.headers.Authorization = `Bearer ${token}`
  if (body instanceof FormData || raw) {
    init.body = body
    if (raw && headers['Content-Type']) init.headers['Content-Type'] = headers['Content-Type']
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${BASE}${path}${buildQuery(params)}`, init)
  } catch (error) {
    if (error?.name === 'TimeoutError') throw new ApiError('请求超时，请稍后重试', 0)
    throw new ApiError('网络异常，无法连接后台服务', 0)
  }

  if (response.status === 401) {
    setToken('')
    for (const handler of listeners) handler()
  }

  if (raw) {
    if (!response.ok) throw new ApiError(`请求失败（${response.status}）`, response.status)
    return response
  }

  // SSE 由 stream() 处理；这里只处理 JSON
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch (_) {
    throw new ApiError('后台返回了非 JSON 数据', response.status, text.slice(0, 200))
  }

  if (!response.ok || payload?.ok === false) {
    const message = payload?.error || `请求失败（${response.status}）`
    throw new ApiError(message, response.status, payload?.detail)
  }
  return payload?.data
}

export const http = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  del: (path, options) => request('DELETE', path, options),
}

/**
 * SSE 流式请求。后端事件形如：
 *   event: delta\ndata: {"content":"..."}\n\n
 * 返回一个可 await 的 Promise，onEvent(event, payload) 逐条回调。
 */
export const stream = async (path, { body, method = 'POST', onEvent, signal } = {}) => {
  const token = getToken()
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (response.status === 401) {
    setToken('')
    for (const handler of listeners) handler()
    throw new ApiError('登录状态已过期，请重新登录', 401)
  }
  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const payload = JSON.parse(await response.text())
      if (payload?.error) message = payload.error
    } catch (_) {
      /* 保持默认信息 */
    }
    throw new ApiError(message, response.status)
  }
  if (!response.body) throw new ApiError('浏览器不支持流式响应', 0)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      const eventName = /^event:\s*(.+)$/m.exec(block)?.[1]?.trim() || 'message'
      const dataText = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n')
      if (!dataText) continue
      let payload = null
      try {
        payload = JSON.parse(dataText)
      } catch (_) {
        payload = { raw: dataText }
      }
      onEvent?.(eventName, payload)
    }
  }
}

export default http
