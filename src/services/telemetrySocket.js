import { ref } from 'vue'

const defaultUrl = () => {
  const envUrl = import.meta?.env?.VITE_TELEMETRY_WS_URL
  if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim()
  return 'ws://localhost:8080/ws'
}

export const telemetryConnected = ref(false)
export const lastTelemetry = ref(null)
export const lastTelemetryAt = ref(0)

let socket = null
let reconnectTimer = null
let reconnectAttempt = 0

const scheduleReconnect = () => {
  if (reconnectTimer) return
  const base = 600
  const max = 8000
  const delay = Math.min(max, base * Math.pow(1.6, reconnectAttempt++))
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectTelemetry()
  }, delay)
}

export const connectTelemetry = () => {
  const url = defaultUrl()
  try {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return socket
    }

    socket = new WebSocket(url)

    socket.addEventListener('open', () => {
      telemetryConnected.value = true
      reconnectAttempt = 0
      console.info('[telemetry] ws open', url)
    })

    socket.addEventListener('close', (ev) => {
      telemetryConnected.value = false
      console.warn('[telemetry] ws close', { code: ev?.code, reason: ev?.reason })
      scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      telemetryConnected.value = false
      console.warn('[telemetry] ws error')
      try {
        socket?.close()
      } catch (_) {
        // ignore
      }
    })

    socket.addEventListener('message', (ev) => {
      const text = typeof ev?.data === 'string' ? ev.data : ''
      if (!text) return

      try {
        const parsed = JSON.parse(text)
        if (parsed?.topic === 'telemetry' && parsed?.data) {
          lastTelemetry.value = parsed.data
          lastTelemetryAt.value = Date.now()
          const d = parsed.data
          console.debug('[telemetry] recv', {
            device: d?.device,
            device_id: d?.device_id,
            type: d?.type,
            ts_ms: d?.ts_ms,
            distance_m: d?.distance_m,
            distance_cm: d?.distance_cm,
            water_active: d?.water_active
          })
        }
      } catch (_) {
        // ignore non-json
      }
    })

    return socket
  } catch (_) {
    telemetryConnected.value = false
    scheduleReconnect()
    return null
  }
}

export const disconnectTelemetry = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectAttempt = 0
  telemetryConnected.value = false
  try {
    socket?.close()
  } catch (_) {
    // ignore
  } finally {
    socket = null
  }
}

export default {
  telemetryConnected,
  lastTelemetry,
  lastTelemetryAt,
  connectTelemetry,
  disconnectTelemetry
}
