import { ref } from 'vue'

// 全局模拟状态（用于跨页面共享）
export const severeWeatherEnabled = ref(false)
export const severeWeatherStartedAt = ref(null)
export const humidityMitigationAppliedAt = ref(null)
export const syncedHumidity = ref(20)

// 大数据面板：湿度异常告警弹窗的全局状态（用于跨页面切换保持一致）
export const humidityAlertDismissed = ref(false)
export const humidityAlertSuppressed = ref(false)
export const humidityAlertProcessing = ref(false)

let humiditySyncTimer = null

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const computeSyncedSevereHumidity = (nowMs = Date.now()) => {
  const startedAt = Number(severeWeatherStartedAt.value) || nowMs
  const now = Number(nowMs) || Date.now()

  const riseDurationMs = 60000
  const humidityAtTime = (elapsedMs) => Number((20 + 72 * clamp(elapsedMs / riseDurationMs, 0, 1)).toFixed(1))

  const mitigationAt = Number(humidityMitigationAppliedAt.value)
  const elapsed = Math.max(0, now - startedAt)

  if (Number.isFinite(mitigationAt) && mitigationAt >= startedAt) {
    const mitigationElapsed = Math.max(0, now - mitigationAt)
    const humidityAtMitigation = humidityAtTime(mitigationAt - startedAt)
    const fallDurationMs = 90000
    const fallT = clamp(mitigationElapsed / fallDurationMs, 0, 1)
    const target = 35
    const fallHumidity = humidityAtMitigation + (target - humidityAtMitigation) * fallT
    return Number(clamp(fallHumidity, 0, 100).toFixed(1))
  }

  return humidityAtTime(elapsed)
}

const tickSyncedHumidity = () => {
  if (!severeWeatherEnabled.value) return
  syncedHumidity.value = computeSyncedSevereHumidity(Date.now())
}

const startHumiditySync = () => {
  if (humiditySyncTimer) return
  tickSyncedHumidity()
  humiditySyncTimer = setInterval(tickSyncedHumidity, 800)
}

const stopHumiditySync = () => {
  if (!humiditySyncTimer) return
  clearInterval(humiditySyncTimer)
  humiditySyncTimer = null
}

export const markHumidityMitigationApplied = () => {
  humidityMitigationAppliedAt.value = Date.now()
  tickSyncedHumidity()
}

export const resetHumidityMitigation = () => {
  humidityMitigationAppliedAt.value = null
  tickSyncedHumidity()
}

export const setHumidityAlertDismissed = (dismissed) => {
  humidityAlertDismissed.value = Boolean(dismissed)
}

export const setHumidityAlertSuppressed = (suppressed) => {
  humidityAlertSuppressed.value = Boolean(suppressed)
}

export const setHumidityAlertProcessing = (processing) => {
  humidityAlertProcessing.value = Boolean(processing)
}

export const setSevereWeatherEnabled = (enabled) => {
  const next = Boolean(enabled)
  severeWeatherEnabled.value = next
  severeWeatherStartedAt.value = next ? Date.now() : null
  resetHumidityMitigation()
  setHumidityAlertDismissed(false)
  setHumidityAlertSuppressed(false)
  setHumidityAlertProcessing(false)
  if (next) {
    startHumiditySync()
    return
  }
  stopHumiditySync()
}
