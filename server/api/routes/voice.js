// 语音接口：把浏览器的语音识别/播报请求转发给本地语音服务（8039，sherpa-onnx + edge-tts）。
// 前端只与本服务通信；语音服务不可用时返回明确错误，前端自动降级到浏览器/安卓原生能力。

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { readBody, badRequest, str, log, HttpError } from '../lib/http.js'
import { requireAuth } from '../lib/auth.js'
import { DATA_DIR } from '../lib/paths.js'

const VOICE_HOST = (process.env.VOICE_HOST || 'http://127.0.0.1:8039').replace(/\/$/, '')
const MAX_AUDIO_BYTES = Number(process.env.VOICE_MAX_AUDIO_BYTES || 12 * 1024 * 1024)
const MAX_TTS_AUDIO_BYTES = positiveInteger(process.env.VOICE_MAX_TTS_AUDIO_BYTES, 12 * 1024 * 1024)
const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache')
const TTS_CACHE_TTL_MS = positiveInteger(process.env.TTS_CACHE_TTL_MS, 7 * 24 * 60 * 60 * 1000)
const TTS_CACHE_MAX_BYTES = positiveInteger(process.env.TTS_CACHE_MAX_BYTES, 256 * 1024 * 1024)

function positiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function pruneTtsCache(now = Date.now()) {
  let files
  try {
    files = fs.readdirSync(TTS_CACHE_DIR, { withFileTypes: true })
  } catch (error) {
    if (error.code !== 'ENOENT') log('voice', `tts cache scan failed: ${error?.message}`)
    return
  }

  const entries = []
  for (const file of files) {
    if (!file.isFile() || path.extname(file.name) !== '.mp3') continue
    const filePath = path.join(TTS_CACHE_DIR, file.name)
    try {
      const stat = fs.statSync(filePath)
      if (now - stat.mtimeMs > TTS_CACHE_TTL_MS) {
        fs.unlinkSync(filePath)
      } else {
        entries.push({ path: filePath, size: stat.size, mtimeMs: stat.mtimeMs })
      }
    } catch (error) {
      if (error.code !== 'ENOENT') log('voice', `tts cache cleanup failed: ${error?.message}`)
    }
  }

  let totalBytes = entries.reduce((total, entry) => total + entry.size, 0)
  entries.sort((left, right) => left.mtimeMs - right.mtimeMs)
  while (totalBytes > TTS_CACHE_MAX_BYTES && entries.length) {
    const oldest = entries.shift()
    try {
      fs.unlinkSync(oldest.path)
      totalBytes -= oldest.size
    } catch (error) {
      if (error.code !== 'ENOENT') log('voice', `tts cache eviction failed: ${error?.message}`)
    }
  }
}

const voiceUnavailable = (detail) =>
  new HttpError(503, `本地语音服务不可用（${VOICE_HOST}）`, detail || '未启动或未安装依赖')

async function readTtsAudio(response) {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TTS_AUDIO_BYTES) {
    await response.body?.cancel().catch(() => {})
    throw new HttpError(502, '语音合成响应超过大小限制')
  }

  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > MAX_TTS_AUDIO_BYTES) {
      await reader.cancel().catch(() => {})
      throw new HttpError(502, '语音合成响应超过大小限制')
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, totalBytes)
}

// —— 语音识别：接收 16k 单声道 WAV 原始字节 ——
const asr = async (ctx) => {
  requireAuth(ctx)
  const audio = await readBody(ctx.req, MAX_AUDIO_BYTES)
  if (!audio.length) throw badRequest('没有收到音频数据')

  let response
  try {
    response = await fetch(`${VOICE_HOST}/asr`, {
      method: 'POST',
      headers: { 'Content-Type': ctx.contentType || 'audio/wav' },
      body: audio,
      signal: AbortSignal.timeout(60000),
    })
  } catch (error) {
    throw voiceUnavailable(error?.message)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`识别失败：${response.status} ${detail.slice(0, 200)}`)
  }
  const result = await response.json().catch(() => ({}))
  return {
    text: str(result.text),
    durationMs: result.duration_ms ?? null,
    elapsedMs: result.elapsed_ms ?? null,
    engine: result.engine || 'sherpa-onnx',
  }
}

// —— 语音播报：返回 mp3 音频流（带磁盘缓存，重复文本不再请求合成） ——
const tts = async (ctx) => {
  requireAuth(ctx)
  const text = str(ctx.body?.text)
  if (!text) throw badRequest('播报文本不能为空')
  if (text.length > 1000) throw badRequest('播报文本过长（最多 1000 字）')
  const voice = str(ctx.body?.voice, 'zh-CN-XiaoxiaoNeural')
  const rate = str(ctx.body?.rate, '+0%')

  const cacheKey = crypto.createHash('sha1').update(`${voice}|${rate}|${text}`).digest('hex')
  const cacheFile = path.join(TTS_CACHE_DIR, `${cacheKey}.mp3`)

  pruneTtsCache()
  if (fs.existsSync(cacheFile)) {
    const buffer = fs.readFileSync(cacheFile)
    const accessedAt = new Date()
    fs.utimesSync(cacheFile, accessedAt, accessedAt)
    ctx.res.statusCode = 200
    ctx.res.setHeader('Content-Type', 'audio/mpeg')
    ctx.res.setHeader('Content-Length', String(buffer.length))
    ctx.res.setHeader('X-TTS-Cache', 'hit')
    ctx.res.end(buffer)
    return undefined
  }

  let response
  try {
    response = await fetch(`${VOICE_HOST}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate }),
      signal: AbortSignal.timeout(60000),
    })
  } catch (error) {
    throw voiceUnavailable(error?.message)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    log('voice', `tts failed ${response.status}: ${detail.slice(0, 200)}`)
    throw new Error(`语音合成失败：${response.status}`)
  }

  const buffer = await readTtsAudio(response)
  try {
    fs.mkdirSync(TTS_CACHE_DIR, { recursive: true })
    fs.writeFileSync(cacheFile, buffer)
    pruneTtsCache()
  } catch (error) {
    log('voice', `tts cache write failed: ${error?.message}`)
  }

  ctx.res.statusCode = 200
  ctx.res.setHeader('Content-Type', 'audio/mpeg')
  ctx.res.setHeader('Content-Length', String(buffer.length))
  ctx.res.setHeader('X-TTS-Cache', 'miss')
  ctx.res.end(buffer)
  return undefined
}

// —— 可用音色列表 ——
const voices = async (ctx) => {
  requireAuth(ctx)
  try {
    const response = await fetch(`${VOICE_HOST}/voices`, { signal: AbortSignal.timeout(4000) })
    if (!response.ok) throw new Error(`status ${response.status}`)
    const data = await response.json()
    return { voices: data.voices || [], online: true }
  } catch (_) {
    // 语音服务未启动时给一份常用中文音色清单，前端仍可展示选择项
    return {
      online: false,
      voices: [
        { name: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女声·温柔）' },
        { name: 'zh-CN-YunxiNeural', label: '云希（男声·沉稳）' },
        { name: 'zh-CN-YunjianNeural', label: '云健（男声·浑厚）' },
        { name: 'zh-CN-XiaoyiNeural', label: '晓伊（女声·活泼）' },
        { name: 'zh-CN-liaoning-XiaobeiNeural', label: '晓北（东北女声）' },
        { name: 'zh-CN-shaanxi-XiaoniNeural', label: '晓妮（陕西女声）' },
      ],
    }
  }
}

const voiceHealth = async (ctx) => {
  try {
    const response = await fetch(`${VOICE_HOST}/health`, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) throw new Error(`status ${response.status}`)
    return await response.json()
  } catch (error) {
    return { ok: false, asr: false, tts: false, host: VOICE_HOST, error: error?.message || 'unreachable' }
  }
}

export const voiceRoutes = [
  { method: 'POST', path: '/api/ai/asr', handler: asr, raw: false },
  { method: 'POST', path: '/api/ai/tts', handler: tts },
  { method: 'GET', path: '/api/ai/tts/voices', handler: voices },
  { method: 'GET', path: '/api/voice/health', handler: voiceHealth, public: true },
]

export default voiceRoutes
