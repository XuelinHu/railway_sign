// 智能体服务：会话管理、SSE 流式问答、模型列表与下载。
// 前端只与统一后台（8037）通信，由后台代理 Ollama。

import http, { stream } from './http.js'

export const health = () => http.get('/ai/health')

export const listModels = () => http.get('/ai/models')

export const listRunning = () => http.get('/ai/models/running')

export const getContext = () => http.get('/ai/context')

export const deleteLocalModel = (name) => http.del(`/ai/models/${encodeURIComponent(name)}`)

export const savePreferences = (payload) => http.post('/ai/preferences', payload)

export const listSessions = (params) => http.get('/ai/sessions', { params })

export const createSession = (payload = {}) => http.post('/ai/sessions', payload)

export const sessionMessages = (id, params) => http.get(`/ai/sessions/${id}/messages`, { params })

export const deleteSession = (id) => http.del(`/ai/sessions/${id}`)

/**
 * 流式问答。返回一个 Promise，通过回调逐字上屏。
 * 事件：meta / thinking / delta / done / error
 * 返回 { sessionId, answer, tokens, latencyMs, aborted }
 */
export const chat = async ({ message, model, sessionId, useContext = true, think = false, signal, onMeta, onThinking, onDelta, onDone }) => {
  let fullSessionId = sessionId || 0
  let answer = ''
  let tokens = 0
  let latencyMs = 0
  let errorMessage = ''

  await stream('/ai/chat', {
    signal,
    body: { message, model, sessionId, useContext, think },
    onEvent: (event, payload) => {
      if (event === 'meta') {
        fullSessionId = payload.sessionId
        onMeta?.(payload)
      } else if (event === 'thinking') {
        onThinking?.(payload.content || '')
      } else if (event === 'delta') {
        answer += payload.content || ''
        onDelta?.(payload.content || '')
      } else if (event === 'done') {
        fullSessionId = payload.sessionId || fullSessionId
        tokens = payload.tokens || 0
        latencyMs = payload.latencyMs || 0
        onDone?.(payload)
      } else if (event === 'error') {
        errorMessage = payload.message || '模型调用失败'
        throw new Error(errorMessage)
      }
    },
  })

  return { sessionId: fullSessionId, answer, tokens, latencyMs, aborted: Boolean(signal?.aborted) }
}

/**
 * 下载（拉取）模型，进度通过 onProgress 回调。
 * 事件：start / progress / done / error
 */
export const pullModel = async ({ name, signal, onProgress, onDone }) => {
  await stream('/ai/models/pull', {
    signal,
    body: { name },
    onEvent: (event, payload) => {
      if (event === 'progress') onProgress?.(payload)
      else if (event === 'done') onDone?.(payload)
      else if (event === 'error') throw new Error(payload.message || '模型下载失败')
    },
  })
}

export default { health, listModels, listRunning, getContext, chat, pullModel, listSessions, createSession, sessionMessages, deleteSession }
