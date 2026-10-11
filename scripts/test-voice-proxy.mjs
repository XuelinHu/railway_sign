import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'railway-sign-voice-proxy-'))
const demoPassword = process.env.API_DEMO_PASSWORD || ''
const ttsAudio = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00')
let ttsCalls = 0
let asrBytes = 0
let api
if (!/_test$/i.test(process.env.PGDATABASE || '')) throw new Error('Voice proxy integration test requires a PGDATABASE ending in _test.')
if (!process.env.PGPASSWORD) throw new Error('Set PGPASSWORD for the isolated PostgreSQL test role.')
if (!demoPassword) throw new Error('Set API_DEMO_PASSWORD to the password used by the seeded test admin.')

const sidecar = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, asr: true, tts: true, voices: 1 }))
  }
  if (req.method === 'GET' && req.url === '/voices') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ voices: [{ name: 'fixture', label: '测试音色' }] }))
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (req.method === 'POST' && req.url === '/asr') {
    asrBytes = Buffer.concat(chunks).length
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ text: '轨道信号测试', duration_ms: 1200, elapsed_ms: 35, engine: 'fixture' }))
  }
  if (req.method === 'POST' && req.url === '/tts') {
    ttsCalls += 1
    if (JSON.parse(Buffer.concat(chunks).toString('utf8')).text === '超大音频测试') {
      const oversizedAudio = Buffer.alloc(33, 0x41)
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': oversizedAudio.length })
      return res.end(oversizedAudio)
    }
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': ttsAudio.length })
    return res.end(ttsAudio)
  }
  res.writeHead(404)
  res.end()
})

const listen = async (server) => {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return server.address().port
}

const freePort = async () => {
  const server = net.createServer()
  const port = await listen(server)
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

const stopServer = async (server) => {
  if (!server?.listening) return
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}

const pass = (message) => console.log('ok   ' + message)

try {
  const sidecarPort = await listen(sidecar)
  const apiPort = await freePort()
  const base = 'http://127.0.0.1:' + apiPort
  api = spawn(process.execPath, ['server/api-server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      API_HOST: '127.0.0.1',
      API_PORT: String(apiPort),
      API_DATA_DIR: tempDir,
      API_JWT_SECRET: 'test-only-railway-sign-voice-proxy-secret',
      NODE_ENV: 'test',
      API_INGEST_URL: '',
      VOICE_HOST: 'http://127.0.0.1:' + sidecarPort,
      TTS_CACHE_TTL_MS: String(60 * 60 * 1000),
      TTS_CACHE_MAX_BYTES: String(ttsAudio.length),
      VOICE_MAX_TTS_AUDIO_BYTES: '32',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let apiOutput = ''
  api.stdout.setEncoding('utf8').on('data', (chunk) => { apiOutput = (apiOutput + chunk).slice(-4000) })
  api.stderr.setEncoding('utf8').on('data', (chunk) => { apiOutput = (apiOutput + chunk).slice(-4000) })

  let ready = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (api.exitCode !== null) throw new Error('API exited during startup:\n' + apiOutput)
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(500) })
      if (response.ok) { ready = true; break }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.equal(ready, true, 'API did not become ready:\n' + apiOutput)
  pass('隔离 PostgreSQL API 已启动')

  const captchaResponse = await fetch(base + '/api/auth/captcha')
  const captchaBody = await captchaResponse.json()
  const code = [...captchaBody.data.svg.matchAll(/>([A-Z0-9])<\/text>/g)].map((match) => match[1]).join('')
  assert.equal(code.length, 4, 'captcha must contain four characters')
  const loginResponse = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: demoPassword,
      captchaId: captchaBody.data.id,
      captchaCode: code,
    }),
  })
  const loginBody = await loginResponse.json()
  assert.equal(loginResponse.status, 200, 'test admin login failed: ' + JSON.stringify(loginBody))
  const token = loginBody.data.token
  const auth = { Authorization: 'Bearer ' + token }
  pass('隔离测试管理员通过验证码登录')

  const health = await fetch(base + '/api/voice/health').then((response) => response.json())
  assert.equal(health.data.asr, true)
  assert.equal(health.data.tts, true)
  pass('公开语音健康检查正常')

  const denied = await fetch(base + '/api/ai/asr', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: Buffer.from('RIFF'),
  })
  assert.equal(denied.status, 401)
  assert.equal(asrBytes, 0, 'unauthorized audio must not reach the sidecar')
  pass('未登录 ASR 请求返回 401 且未转发音频')

  const voices = await fetch(base + '/api/ai/tts/voices', { headers: auth }).then((response) => response.json())
  assert.equal(voices.data.online, true)
  assert.equal(voices.data.voices[0].name, 'fixture')
  pass('登录后获取语音列表')

  const wav = Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ')
  const asrResponse = await fetch(base + '/api/ai/asr', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'audio/wav' },
    body: wav,
  })
  const asr = await asrResponse.json()
  assert.equal(asrResponse.status, 200)
  assert.equal(asr.data.text, '轨道信号测试')
  assert.equal(asr.data.engine, 'fixture')
  assert.equal(asrBytes, wav.length, 'API must forward the exact WAV bytes')
  pass('WAV 字节经 API 转发并返回识别文本')

  globalThis.window = {}
  globalThis.localStorage = { getItem: (key) => key === 'railway_sign_token' ? token : null }
  const nativeFetch = globalThis.fetch
  globalThis.fetch = (input, options) => nativeFetch(new URL(input, base), options)
  const { listen: listenVoice } = await import('../src/services/voice.js')
  window.RailwayVoice = {
    isAvailable: () => true,
    startVoiceInput: () => queueMicrotask(() => window.__railwayVoiceStarted(null)),
    finishVoiceInput: () => queueMicrotask(() => window.__railwayVoiceAudio(wav.toString('base64'), null)),
    stopVoiceInput: () => {},
  }
  const androidSession = await listenVoice()
  const androidResult = await androidSession.finish()
  assert.equal(typeof androidResult.text, 'string')
  assert.equal(androidResult.text, '轨道信号测试')
  assert.equal(androidResult.source, 'server')
  globalThis.fetch = nativeFetch
  pass('Android 录音桥回调经认证 API 返回字符串识别结果')

  const requestTts = (text = '铁路信号测试') => fetch(base + '/api/ai/tts', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: 'fixture' }),
  })
  const oversizedTts = await requestTts('超大音频测试')
  assert.equal(oversizedTts.status, 502)
  assert.match((await oversizedTts.json()).error, /超过大小限制/)
  assert.equal(ttsCalls, 1, 'oversized audio must be rejected before it is cached')
  pass('超出配置上限的 TTS 音频返回 502 且不进入缓存')
  const ttsCallsAfterOversized = ttsCalls

  const firstTts = await requestTts()
  const firstAudio = Buffer.from(await firstTts.arrayBuffer())
  assert.equal(firstTts.status, 200)
  assert.match(firstTts.headers.get('content-type') || '', /audio\/mpeg/)
  assert.equal(firstTts.headers.get('x-tts-cache'), 'miss')
  assert.deepEqual(firstAudio, ttsAudio)
  const secondTts = await requestTts()
  const secondAudio = Buffer.from(await secondTts.arrayBuffer())
  assert.equal(secondTts.status, 200)
  assert.equal(secondTts.headers.get('x-tts-cache'), 'hit')
  assert.deepEqual(secondAudio, ttsAudio)
  assert.equal(ttsCalls, ttsCallsAfterOversized + 1, 'identical TTS request should be served from cache')
  pass('TTS 返回 MP3，重复请求命中磁盘缓存')

  const originalCacheFile = (await fs.readdir(path.join(tempDir, 'tts-cache')))[0]
  const otherTts = await requestTts('另一条用于容量检查的测试语音')
  assert.equal(otherTts.headers.get('x-tts-cache'), 'miss')
  assert.equal(ttsCalls, ttsCallsAfterOversized + 2)
  assert.equal((await fs.readdir(path.join(tempDir, 'tts-cache'))).length, 1, 'cache size cap should evict the least-recently-used entry')
  assert.equal(await fs.stat(path.join(tempDir, 'tts-cache', originalCacheFile)).then(() => true, () => false), false)
  pass('TTS 缓存达到容量上限时淘汰最久未使用的音频')

  const originalTts = await requestTts()
  assert.equal(originalTts.headers.get('x-tts-cache'), 'miss', 'evicted audio should be synthesized again')
  assert.equal(ttsCalls, ttsCallsAfterOversized + 3)
  const currentCacheFiles = await fs.readdir(path.join(tempDir, 'tts-cache'))
  const currentCacheFile = path.join(tempDir, 'tts-cache', currentCacheFiles[0])
  const expiredAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
  await fs.utimes(currentCacheFile, expiredAt, expiredAt)
  const refreshedTts = await requestTts()
  assert.equal(refreshedTts.headers.get('x-tts-cache'), 'miss', 'expired audio should be synthesized again')
  assert.equal(ttsCalls, ttsCallsAfterOversized + 4)
  pass('TTS 缓存超过空闲 TTL 后过期并重新合成')

  const ttsCallsBeforeInvalid = ttsCalls
  const invalidTts = await fetch(base + '/api/ai/tts', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: ' ' }),
  })
  assert.equal(invalidTts.status, 400)
  assert.equal(ttsCalls, ttsCallsBeforeInvalid, 'invalid TTS input must not reach the sidecar')
  pass('空白 TTS 输入返回 400 且不调用边车')
  console.log('\n语音代理集成测试全部通过（11 项）')
} finally {
  if (api && api.exitCode === null) {
    api.kill()
    await Promise.race([once(api, 'exit'), new Promise((resolve) => setTimeout(resolve, 2000))])
  }
  await stopServer(sidecar)
  await fs.rm(tempDir, { recursive: true, force: true })
}
