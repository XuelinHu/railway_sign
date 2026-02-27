import http from 'node:http'
import https from 'node:https'
import { spawn } from 'node:child_process'

const UPSTREAM_URL = process.env.STREAM_SOURCE_URL || 'http://192.168.1.11/stream'
const PORT = Number(process.env.STREAM_PROXY_PORT || 3001)
let requestSeq = 0

const upstream = new URL(UPSTREAM_URL)
const transport = upstream.protocol === 'https:' ? https : http
const CURL_BIN = process.platform === 'win32' ? 'curl.exe' : 'curl'

const now = () => new Date().toISOString()
const fmtBytes = (value) => {
  if (value < 1024) return `${value}B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`
  return `${(value / (1024 * 1024)).toFixed(2)}MB`
}
const log = (id, message) => {
  console.log(`${now()} [stream-proxy][${id}] ${message}`)
}

const writeCommonHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('X-Accel-Buffering', 'no')
}

const proxyStream = (req, res) => {
  const requestId = ++requestSeq
  const startedAt = Date.now()
  let totalBytes = 0
  let bytesInWindow = 0
  let closedByClient = false
  let errorText = ''

  log(requestId, `client connected: ${req.method} ${req.url}`)

  const statsTimer = setInterval(() => {
    log(requestId, `streaming... +${fmtBytes(bytesInWindow)}/3s total=${fmtBytes(totalBytes)}`)
    bytesInWindow = 0
  }, 3000)

  const stopStats = () => clearInterval(statsTimer)

  const curlProc = spawn(
    CURL_BIN,
    ['--silent', '--show-error', '--no-buffer', '--http1.1', UPSTREAM_URL],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )

  log(requestId, `upstream via curl: ${UPSTREAM_URL}`)

  curlProc.stdout.on('data', (chunk) => {
    if (!res.headersSent) {
      writeCommonHeaders(res)
      res.statusCode = 200
      res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
    }
    totalBytes += chunk.length
    bytesInWindow += chunk.length
    res.write(chunk)
  })

  curlProc.stderr.on('data', (chunk) => {
    const message = chunk.toString('utf8').trim()
    if (message) {
      errorText = message
      log(requestId, `curl stderr: ${message}`)
    }
  })

  curlProc.on('error', (error) => {
    log(requestId, `curl start error: ${error.message}`)
    if (!res.headersSent) {
      writeCommonHeaders(res)
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ message: 'stream proxy error', error: error.message }))
    } else {
      res.end()
    }
    stopStats()
  })

  curlProc.on('close', (code) => {
    const duration = ((Date.now() - startedAt) / 1000).toFixed(1)
    log(requestId, `curl closed: code=${code} duration=${duration}s total=${fmtBytes(totalBytes)}`)
    if (!res.headersSent) {
      writeCommonHeaders(res)
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ message: 'stream proxy error', error: errorText || `curl exited with code ${code}` }))
    } else {
      res.end()
    }
    stopStats()
  })

  req.on('close', () => {
    closedByClient = true
    const duration = ((Date.now() - startedAt) / 1000).toFixed(1)
    log(requestId, `client disconnected: duration=${duration}s total=${fmtBytes(totalBytes)}`)
    stopStats()
    curlProc.kill()
  })

  res.on('close', () => {
    if (!closedByClient) {
      const duration = ((Date.now() - startedAt) / 1000).toFixed(1)
      log(requestId, `response closed: duration=${duration}s total=${fmtBytes(totalBytes)}`)
      stopStats()
    }
  })

}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400
    return res.end('Bad request')
  }
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = requestUrl.pathname

  if (req.method === 'OPTIONS') {
    writeCommonHeaders(res)
    res.statusCode = 204
    return res.end()
  }

  if (pathname === '/stream-proxy/health') {
    writeCommonHeaders(res)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ ok: true, upstream: UPSTREAM_URL }))
  }

  if (
    req.method === 'GET' &&
    (pathname === '/stream-proxy/live' || pathname.startsWith('/stream-proxy/live/'))
  ) {
    return proxyStream(req, res)
  }

  writeCommonHeaders(res)
  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ message: 'Not Found' }))
})

server.listen(PORT, () => {
  console.log(`[stream-proxy] listening on http://localhost:${PORT}`)
  console.log(`[stream-proxy] upstream: ${UPSTREAM_URL}`)
})
