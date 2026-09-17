// 智能体接口：统一代理本机 Ollama，提供模型列表/下载、流式问答、会话落库与实时上下文。
//
// 前端只与本服务（8037）通信，不直连 11434；流式问答走 SSE，逐字回传。

import { all, get, run, tx, pageQuery, getConfig, setConfig } from '../lib/db.js'
import {
  badRequest,
  notFound,
  str,
  startSse,
  sseSend,
  sseComment,
  HANDLED,
  log,
} from '../lib/http.js'
import { requireAuth, requirePermission, writeOpLog } from '../lib/auth.js'

const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '')
const VOICE_HOST = (process.env.VOICE_HOST || 'http://127.0.0.1:8039').replace(/\/$/, '')

const ollamaFetch = async (path, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${OLLAMA_HOST}${path}`, { ...options, signal: options.signal || controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// 字节数转可读大小，前端下拉与模型管理表格直接展示
const sizeLabel = (bytes) => {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} GB`
  return `${Math.round(value / 1e6)} MB`
}

const safeOllamaJson = async (path) => {
  try {
    const response = await ollamaFetch(path)
    if (!response.ok) return null
    return await response.json()
  } catch (_) {
    return null
  }
}

// —— 健康检查：同时反映 Ollama 与语音服务的可用性 ——
const health = async () => {
  const [tags, voice] = await Promise.all([
    safeOllamaJson('/api/tags'),
    (async () => {
      try {
        const response = await fetch(`${VOICE_HOST}/health`, { signal: AbortSignal.timeout(2500) })
        return response.ok ? await response.json() : null
      } catch (_) {
        return null
      }
    })(),
  ])
  return {
    ollama: { online: Boolean(tags), host: OLLAMA_HOST, modelCount: tags?.models?.length || 0 },
    voice: voice
      ? { online: true, host: VOICE_HOST, asr: Boolean(voice.asr), tts: Boolean(voice.tts), voices: voice.voices || [] }
      : { online: false, host: VOICE_HOST, asr: false, tts: false, voices: [] },
  }
}

// —— 模型列表：Ollama 本地实际安装 + 目录元数据合并 ——
const modelList = async (ctx) => {
  requirePermission(ctx, 'ai:use')
  const tags = await safeOllamaJson('/api/tags')
  const installed = new Map()
  for (const model of tags?.models || []) {
    installed.set(model.name, model)
  }

  const catalog = all('SELECT * FROM ai_models ORDER BY is_default DESC, sort ASC, id ASC')
  const list = catalog.map((row) => {
    const local = installed.get(row.name)
    if (local) installed.delete(row.name)
    const sizeBytes = local?.size || row.size_bytes
    return {
      ...row,
      installed: Boolean(local),
      size_bytes: sizeBytes,
      size_label: sizeLabel(sizeBytes),
      modified_at: local?.modified_at || null,
      details: local?.details || null,
    }
  })

  // Ollama 里存在但目录里没登记的模型，也一并列出（例如手工 ollama pull 的）。
  for (const [name, model] of installed) {
    list.push({
      id: null,
      name,
      display_name: name,
      provider: 'ollama',
      family: model.details?.family || name.split(':')[0],
      parameter_size: model.details?.parameter_size || '',
      quantization: model.details?.quantization_level || '',
      size_bytes: model.size || 0,
      size_label: sizeLabel(model.size),
      description: '本机已安装但未登记的模型',
      tags: '本机',
      source: 'local',
      is_default: 0,
      sort: 999,
      installed: true,
      modified_at: model.modified_at,
      details: model.details || null,
    })
  }

  const defaultModel = getConfig('ai.default_model', '') || list.find((item) => item.is_default)?.name || list[0]?.name || ''
  return { list, total: list.length, defaultModel, ollamaOnline: Boolean(tags) }
}

// —— 实时上下文：注入给模型的监测数据摘要 ——
const collectContext = () => {
  const signals = all(
    `SELECT code, name, status, temperature, humidity, voltage, current, online, kilometer
     FROM signals ORDER BY id LIMIT 12`
  )
  const alarms = all(
    `SELECT code, signal_code, level, title, status, occurred_at FROM alarms
     WHERE status IN ('pending', 'handling') ORDER BY occurred_at DESC LIMIT 8`
  )
  const telemetry = all(
    `SELECT device, device_id, distance_m, water_active, created_at FROM telemetry_records
     ORDER BY id DESC LIMIT 5`
  )
  const stats = {
    signalTotal: Number(get('SELECT COUNT(*) AS total FROM signals')?.total || 0),
    signalOffline: Number(get("SELECT COUNT(*) AS total FROM signals WHERE online = 0")?.total || 0),
    alarmPending: Number(get("SELECT COUNT(*) AS total FROM alarms WHERE status = 'pending'")?.total || 0),
    orderPending: Number(get("SELECT COUNT(*) AS total FROM work_orders WHERE status = 'pending'")?.total || 0),
  }
  return { signals, alarms, telemetry, stats, generatedAt: new Date().toISOString() }
}

const contextEndpoint = async (ctx) => {
  requirePermission(ctx, 'ai:use')
  return collectContext()
}

const formatContext = (context) => {
  const lines = []
  lines.push(`数据时间：${context.generatedAt}`)
  lines.push(
    `统计：信号机 ${context.stats.signalTotal} 台（离线 ${context.stats.signalOffline} 台），待处理告警 ${context.stats.alarmPending} 条，待处理工单 ${context.stats.orderPending} 条。`
  )
  if (context.signals.length) {
    lines.push('信号机实时状态：')
    for (const item of context.signals) {
      const statusMap = { red: '红灯', green: '绿灯', yellow: '黄灯', off: '灭灯' }
      lines.push(
        `- ${item.name}（${item.kilometer || '里程未知'}）状态 ${statusMap[item.status] || item.status}，` +
          `温度 ${item.temperature}℃，湿度 ${item.humidity}%，电压 ${item.voltage}V，电流 ${item.current}A，${item.online ? '在线' : '离线'}`
      )
    }
  }
  if (context.alarms.length) {
    lines.push('当前未闭环告警：')
    for (const item of context.alarms) {
      lines.push(`- [${item.level}] ${item.signal_code} ${item.title}（${item.code}，状态 ${item.status}）`)
    }
  } else {
    lines.push('当前没有未闭环告警。')
  }
  if (context.telemetry.length) {
    lines.push('最近遥测上报：')
    for (const item of context.telemetry) {
      lines.push(
        `- ${item.device}：距离 ${item.distance_m ?? '-'} m，${Number(item.water_active) === 1 ? '检测到积水' : '无积水'}，${item.created_at}`
      )
    }
  }
  return lines.join('\n')
}

const buildSystemPrompt = (contextEnabled) => {
  const base = getConfig(
    'ai.system_prompt',
    '你是铁路信号设备运维智能助手，回答要专业、简洁、面向现场作业。'
  )
  const rules = [
    '你是"铁路信号机数字孪生监测与可视化分析平台"内置的智能运维助手。',
    '请使用简体中文回答，条理清晰，涉及处置建议时按步骤给出。',
    '下面的实时监测数据可以用于回答"当前状态""哪台设备异常"这类问题，回答时请引用具体数值。',
    '如果问题超出铁路信号与本站监测范围，请直接说明并给出可行的排查方向，不要编造数据。',
  ].join('\n')
  if (!contextEnabled) return `${base}\n${rules}`
  return `${base}\n${rules}\n\n【实时监测上下文】\n${formatContext(collectContext())}`
}

// —— 会话 ——
const sessionList = async (ctx) => {
  const user = requireAuth(ctx)
  return pageQuery({
    from: 'FROM ai_sessions',
    where: 'WHERE user_id = :uid',
    params: { uid: user.id },
    orderBy: 'id DESC',
    page: ctx.pagination.page,
    pageSize: ctx.pagination.pageSize,
  })
}

const sessionMessages = async (ctx) => {
  const user = requireAuth(ctx)
  const id = Number(ctx.params.id)
  const session = get('SELECT * FROM ai_sessions WHERE id = :id AND user_id = :uid', { id, uid: user.id })
  if (!session) throw notFound('会话不存在')
  return pageQuery({
    from: 'FROM ai_messages',
    where: 'WHERE session_id = :id',
    params: { id },
    orderBy: 'id ASC',
    page: ctx.pagination.page,
    pageSize: ctx.pagination.pageSize,
  })
}

const createSession = async (ctx) => {
  const user = requireAuth(ctx)
  const title = str(ctx.body?.title, '新会话').slice(0, 40)
  const model = str(ctx.body?.model, getConfig('ai.default_model', ''))
  const now = new Date().toISOString()
  const inserted = run(
    `INSERT INTO ai_sessions (user_id, username, title, model, message_count, source, created_at, updated_at)
     VALUES (:user_id, :username, :title, :model, 0, 'agent', :now, :now)`,
    { user_id: user.id, username: user.username, title, model, now }
  )
  return { id: Number(inserted.lastInsertRowid), title, model }
}

const deleteSession = async (ctx) => {
  const user = requireAuth(ctx)
  const id = Number(ctx.params.id)
  const session = get('SELECT * FROM ai_sessions WHERE id = :id AND user_id = :uid', { id, uid: user.id })
  if (!session) throw notFound('会话不存在')
  tx(() => {
    run('DELETE FROM ai_messages WHERE session_id = :id', { id })
    run('DELETE FROM ai_sessions WHERE id = :id', { id })
  })
  return { deleted: true }
}

// —— 流式问答（SSE） ——
const chat = async (ctx) => {
  const user = requirePermission(ctx, 'ai:use')
  const body = ctx.body || {}
  const message = str(body.message)
  if (!message) throw badRequest('请输入要提问的内容')

  const model = str(body.model) || getConfig('ai.default_model', '')
  if (!model) throw badRequest('未指定模型，请先在模型管理中选择')

  const res = ctx.res
  const abort = new AbortController()
  // res 的 close 才是客户端断开的可靠信号（req 在 POST 读完 body 后就会触发 close）。
  res.on('close', () => {
    if (!res.writableEnded) abort.abort(new Error('client closed'))
  })

  startSse(res)

  const now = new Date().toISOString()
  let sessionId = Number(body.sessionId) || 0
  let session = sessionId ? get('SELECT * FROM ai_sessions WHERE id = :id AND user_id = :uid', { id: sessionId, uid: user.id }) : null
  if (!session) {
    const inserted = run(
      `INSERT INTO ai_sessions (user_id, username, title, model, message_count, source, created_at, updated_at)
       VALUES (:user_id, :username, :title, :model, 0, 'agent', :now, :now)`,
      { user_id: user.id, username: user.username, title: message.slice(0, 30), model, now }
    )
    sessionId = Number(inserted.lastInsertRowid)
    session = get('SELECT * FROM ai_sessions WHERE id = :id', { id: sessionId })
  }

  const historyLimit = Number(getConfig('ai.max_history', '10')) || 10
  const history = all(
    'SELECT role, content FROM ai_messages WHERE session_id = :id ORDER BY id DESC LIMIT :limit',
    { id: sessionId, limit: historyLimit }
  ).reverse()

  const contextEnabled = getConfig('ai.context_enabled', '1') === '1'
  const messages = [
    { role: 'system', content: buildSystemPrompt(contextEnabled) },
    ...history
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({ role: item.role, content: item.content })),
    { role: 'user', content: message },
  ]

  run(
    `INSERT INTO ai_messages (session_id, role, content, model, tokens, latency_ms, created_at)
     VALUES (:session_id, 'user', :content, :model, 0, 0, :now)`,
    { session_id: sessionId, content: message, model, now }
  )

  sseSend(res, 'meta', {
    sessionId,
    model,
    title: session?.title || message.slice(0, 30),
    contextEnabled,
  })

  const keepalive = setInterval(() => sseComment(res, 'keepalive'), 15000)

  let answer = ''
  let thinking = ''
  let tokens = 0
  const startedAt = Date.now()

  try {
    const upstream = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abort.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        think: body.think === true,
        options: {
          temperature: Number(body.temperature) || 0.6,
          num_ctx: Number(body.num_ctx) || 4096,
        },
      }),
    })

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '')
      throw new Error(`Ollama 返回 ${upstream.status}${detail ? `：${detail.slice(0, 200)}` : ''}`)
    }

    // Ollama 返回 NDJSON（一行一个 JSON），需要按行缓冲后再解析。
    let buffer = ''
    const decoder = new TextDecoder()
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true })
      let index = buffer.indexOf('\n')
      while (index >= 0) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf('\n')
        if (!line) continue
        let payload = null
        try {
          payload = JSON.parse(line)
        } catch (_) {
          continue
        }
        if (payload.message?.thinking) {
          thinking += payload.message.thinking
          sseSend(res, 'thinking', { content: payload.message.thinking })
        }
        if (payload.message?.content) {
          answer += payload.message.content
          sseSend(res, 'delta', { content: payload.message.content })
        }
        if (payload.error) throw new Error(payload.error)
        if (payload.done) {
          tokens = payload.eval_count || 0
        }
      }
    }
  } catch (error) {
    const aborted = abort.signal.aborted
    const latencyMs = Date.now() - startedAt
    if (answer) {
      run(
        `INSERT INTO ai_messages (session_id, role, content, model, tokens, latency_ms, created_at)
         VALUES (:session_id, 'assistant', :content, :model, :tokens, :latency, :now)`,
        { session_id: sessionId, content: answer, model, tokens, latency: latencyMs, now: new Date().toISOString() }
      )
      run('UPDATE ai_sessions SET message_count = message_count + 2, updated_at = :now WHERE id = :id', {
        now: new Date().toISOString(),
        id: sessionId,
      })
    }
    if (!aborted) {
      log('ai', `chat error: ${error?.message}`)
      sseSend(res, 'error', { message: error?.message || '模型调用失败', sessionId })
    }
    clearInterval(keepalive)
    res.end()
    return HANDLED
  }

  clearInterval(keepalive)

  const latencyMs = Date.now() - startedAt
  const finishedAt = new Date().toISOString()
  const inserted = run(
    `INSERT INTO ai_messages (session_id, role, content, model, tokens, latency_ms, created_at)
     VALUES (:session_id, 'assistant', :content, :model, :tokens, :latency, :now)`,
    { session_id: sessionId, content: answer, model, tokens, latency: latencyMs, now: finishedAt }
  )
  run('UPDATE ai_sessions SET message_count = message_count + 2, model = :model, updated_at = :now WHERE id = :id', {
    model,
    now: finishedAt,
    id: sessionId,
  })

  sseSend(res, 'done', {
    sessionId,
    messageId: Number(inserted.lastInsertRowid),
    tokens,
    latencyMs,
    thinking: thinking ? thinking.length : 0,
  })
  res.end()
  return HANDLED
}

// —— 模型下载（转发 Ollama /api/pull，进度走 SSE） ——
const pullModel = async (ctx) => {
  const user = requirePermission(ctx, 'ai:manage')
  const name = str(ctx.body?.name || ctx.params.name)
  if (!name) throw badRequest('请指定要下载的模型')

  const res = ctx.res
  const abort = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) abort.abort(new Error('client closed'))
  })
  startSse(res)

  const keepalive = setInterval(() => sseComment(res, 'keepalive'), 15000)
  sseSend(res, 'start', { name })

  try {
    const upstream = await fetch(`${OLLAMA_HOST}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abort.signal,
      body: JSON.stringify({ name, stream: true }),
    })
    if (!upstream.ok || !upstream.body) throw new Error(`Ollama 返回 ${upstream.status}`)

    let buffer = ''
    const decoder = new TextDecoder()
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true })
      let index = buffer.indexOf('\n')
      while (index >= 0) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf('\n')
        if (!line) continue
        try {
          const payload = JSON.parse(line)
          if (payload.error) throw new Error(payload.error)
          sseSend(res, 'progress', {
            status: payload.status || '',
            completed: payload.completed || 0,
            total: payload.total || 0,
            percent: payload.total ? Math.round((payload.completed / payload.total) * 100) : 0,
          })
        } catch (error) {
          if (error?.message && !error.message.includes('Unexpected')) throw error
        }
      }
    }
    writeOpLog({ user, req: ctx.req, action: '下载模型', targetType: 'ai_model', targetId: name })
    sseSend(res, 'done', { name })
  } catch (error) {
    if (!abort.signal.aborted) {
      log('ai', `pull error: ${error?.message}`)
      sseSend(res, 'error', { message: error?.message || '模型下载失败' })
    }
  }
  clearInterval(keepalive)
  res.end()
  return HANDLED
}

// —— 删除本机模型（同时清掉目录登记） ——
const deleteLocalModel = async (ctx) => {
  const user = requirePermission(ctx, 'ai:manage')
  const name = str(ctx.params.name)
  const response = await ollamaFetch('/api/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }, 20000)
  if (!response.ok) {
    throw badRequest(`删除失败：Ollama 返回 ${response.status}`)
  }
  run('DELETE FROM ai_models WHERE name = :name AND source <> \'catalog\'', { name })
  writeOpLog({ user, req: ctx.req, action: '删除本机模型', targetType: 'ai_model', targetId: name })
  return { deleted: true }
}

// —— 运行中的模型 ——
const runningModels = async (ctx) => {
  requirePermission(ctx, 'ai:use')
  const data = await safeOllamaJson('/api/ps')
  return { list: data?.models || [] }
}

const updatePreferences = async (ctx) => {
  const user = requirePermission(ctx, 'ai:manage')
  const body = ctx.body || {}
  if (body.defaultModel) {
    const name = str(body.defaultModel)
    tx(() => {
      run('UPDATE ai_models SET is_default = 0')
      run('UPDATE ai_models SET is_default = 1, updated_at = :now WHERE name = :name', { now: new Date().toISOString(), name })
      setConfig('ai.default_model', name, '智能体默认模型')
    })
  }
  if (body.systemPrompt !== undefined) setConfig('ai.system_prompt', str(body.systemPrompt), '智能体系统提示词')
  if (body.contextEnabled !== undefined) setConfig('ai.context_enabled', body.contextEnabled ? '1' : '0', '是否向模型注入实时监测上下文')
  if (body.maxHistory !== undefined) setConfig('ai.max_history', String(Number(body.maxHistory) || 10), '发送给模型的历史消息条数')
  writeOpLog({ user, req: ctx.req, action: '更新智能体配置', targetType: 'ai', targetId: 'preferences' })
  return { updated: true }
}

export const aiRoutes = [
  { method: 'GET', path: '/api/ai/health', handler: health, public: true },
  { method: 'GET', path: '/api/ai/models', handler: modelList, permission: 'ai:use' },
  { method: 'GET', path: '/api/ai/models/running', handler: runningModels, permission: 'ai:use' },
  { method: 'POST', path: '/api/ai/models/pull', handler: pullModel, permission: 'ai:manage' },
  { method: 'DELETE', path: '/api/ai/models/:name', handler: deleteLocalModel, permission: 'ai:manage' },
  { method: 'POST', path: '/api/ai/preferences', handler: updatePreferences, permission: 'ai:manage' },
  { method: 'GET', path: '/api/ai/context', handler: contextEndpoint, permission: 'ai:use' },
  { method: 'POST', path: '/api/ai/chat', handler: chat, permission: 'ai:use' },
  { method: 'GET', path: '/api/ai/sessions', handler: sessionList },
  { method: 'POST', path: '/api/ai/sessions', handler: createSession },
  { method: 'GET', path: '/api/ai/sessions/:id/messages', handler: sessionMessages },
  { method: 'DELETE', path: '/api/ai/sessions/:id', handler: deleteSession },
]

export default aiRoutes
