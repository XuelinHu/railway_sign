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
    })

    socket.addEventListener('close', () => {
      telemetryConnected.value = false
      scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      telemetryConnected.value = false
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

