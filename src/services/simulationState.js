import { ref } from 'vue'

// 全局模拟状态（用于跨页面共享）
export const severeWeatherEnabled = ref(false)
export const severeWeatherStartedAt = ref(null)
export const humidityMitigationAppliedAt = ref(null)

export const markHumidityMitigationApplied = () => {
  humidityMitigationAppliedAt.value = Date.now()
}

export const resetHumidityMitigation = () => {
  humidityMitigationAppliedAt.value = null
}

export const setSevereWeatherEnabled = (enabled) => {
  const next = Boolean(enabled)
  severeWeatherEnabled.value = next
  severeWeatherStartedAt.value = next ? Date.now() : null
  resetHumidityMitigation()
}
