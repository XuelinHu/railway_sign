import http from 'node:http'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.TELEMETRY_PORT || 8080)
const WS_PATH = process.env.TELEMETRY_WS_PATH || '/ws'
const UPLOAD_PATH = process.env.TELEMETRY_UPLOAD_PATH || '/upload'
const MAX_BODY_BYTES = Number(process.env.TELEMETRY_MAX_BODY_BYTES || 32 * 1024)

const now = () => new Date().toISOString()
const log = (msg) => console.log(`${now()} [telemetry] ${msg}`)

const writeCommonHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,*')
  res.setHeader('Cache-Control', 'no-store')
}

const safeJsonParse = (text) => {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

const normalizeTelemetry = (payload) => {
  const distanceCm = payload?.distance_cm
  const distanceCmNum = Number.isFinite(Number(distanceCm)) ? Number(distanceCm) : null
  const distanceM = distanceCmNum == null ? null : distanceCmNum / 100

  const waterActive = payload?.water_active
  const waterActiveNum = Number.isFinite(Number(waterActive)) ? Number(waterActive) : null

  return {
    type: payload?.type || 'telemetry',
    device: payload?.device || 'unknown',
    device_id: payload?.device_id || 'unknown',
    ts_ms: Number.isFinite(Number(payload?.ts_ms)) ? Number(payload.ts_ms) : Date.now(),
    uptime_ms: Number.isFinite(Number(payload?.uptime_ms)) ? Number(payload.uptime_ms) : null,
    wifi_ip: typeof payload?.wifi_ip === 'string' ? payload.wifi_ip : null,
    distance_cm: distanceCmNum == null ? null : Math.round(distanceCmNum * 10) / 10,
    distance_m: distanceM == null ? null : Math.round(distanceM * 100) / 100,
    water_active: waterActiveNum == null ? null : waterActiveNum,
    raw: payload
  }
}

let lastTelemetry = null

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400
    return res.end('Bad request')
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  if (req.method === 'OPTIONS') {
    writeCommonHeaders(res)
    res.statusCode = 204
    return res.end()
  }

  if (req.method === 'GET' && pathname === '/telemetry/health') {
    writeCommonHeaders(res)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(
      JSON.stringify({
        ok: true,
        port: PORT,
        ws_path: WS_PATH,
        upload_path: UPLOAD_PATH,
        clients: wss.clients.size,
        last: lastTelemetry
          ? { ts_ms: lastTelemetry.ts_ms, device: lastTelemetry.device, type: lastTelemetry.type }
          : null
      })
    )
  }

  if (req.method === 'POST' && pathname === UPLOAD_PATH) {
    const remote = req.socket?.remoteAddress || 'unknown'
    let body = ''
    let bodyBytes = 0

    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      bodyBytes += Buffer.byteLength(chunk, 'utf8')
      if (bodyBytes > MAX_BODY_BYTES) {
        log(`upload rejected: 413 too large bytes=${bodyBytes} from=${remote}`)
        writeCommonHeaders(res)
        res.statusCode = 413
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: 'payload too large' }))
        req.destroy()
        return
      }
      body += chunk
    })

    req.on('end', () => {
      const parsed = safeJsonParse(body || '{}')
      if (!parsed.ok) {
        log(`upload rejected: 400 invalid json from=${remote} detail=${parsed.error}`)
        writeCommonHeaders(res)
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: 'invalid json', detail: parsed.error }))
        return
      }

      const msg = normalizeTelemetry(parsed.value)
      lastTelemetry = msg

      log(
        `upload ok: device=${msg.device} id=${msg.device_id} type=${msg.type} distance_cm=${msg.distance_cm ?? 'null'} water=${msg.water_active ?? 'null'} clients=${wss.clients.size} from=${remote}`
      )

      const encoded = JSON.stringify({ topic: 'telemetry', data: msg })
      for (const client of wss.clients) {
        if (client.readyState === 1) client.send(encoded)
      }

      writeCommonHeaders(res)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: true }))
    })

    req.on('error', (err) => {
      writeCommonHeaders(res)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: err?.message || 'request error' }))
    })

    return
  }

  writeCommonHeaders(res)
  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ ok: false, error: 'Not Found' }))
})

const wss = new WebSocketServer({ server, path: WS_PATH })

wss.on('connection', (ws, req) => {
  log(`ws connected: ${req?.socket?.remoteAddress || 'unknown'} clients=${wss.clients.size}`)
  if (lastTelemetry) {
    ws.send(JSON.stringify({ topic: 'telemetry', data: lastTelemetry }))
  }

  ws.on('message', (data) => {
    // optional ping/pong or client subscriptions
    const text = typeof data === 'string' ? data : data.toString('utf8')
    if (text === 'ping') ws.send('pong')
  })

  ws.on('close', () => {
    log(`ws closed: clients=${wss.clients.size}`)
  })
})

server.listen(PORT, () => {
  log(`listening: http://localhost:${PORT}`)
  log(`upload: POST ${UPLOAD_PATH}`)
  log(`ws: ${WS_PATH}`)
})
