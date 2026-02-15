// 数据获取组合函数
import { ref } from 'vue'
import api from '../services/api.js'

// 获取仪表盘汇总数据
export const useDashboardData = () => {
  const loading = ref(false)
  const error = ref(null)
  const dashboardData = ref(null)

  const fetchData = async () => {
    loading.value = true
    error.value = null
    try {
      dashboardData.value = await api.getDashboard()
    } catch (e) {
      error.value = e.message
      console.error('获取仪表盘数据失败:', e)
    } finally {
      loading.value = false
    }
  }

  return { loading, error, dashboardData, fetchData }
}

// 获取信号灯数据
export const useSignalsData = () => {
  const loading = ref(false)
  const error = ref(null)
  const signals = ref([])

  const fetchSignals = async () => {
    loading.value = true
    error.value = null
    try {
      signals.value = await api.getSignals()
    } catch (e) {
      error.value = e.message
      console.error('获取信号灯数据失败:', e)
    } finally {
      loading.value = false
    }
  }

  return { loading, error, signals, fetchSignals }
}

// 获取地震数据
export const useSeismicData = () => {
  const loading = ref(false)
  const error = ref(null)
  const seismicData = ref([])

  const fetchSeismic = async (range = '24h') => {
    loading.value = true
    error.value = null
    try {
      seismicData.value = await api.getSeismicData(range)
    } catch (e) {
      error.value = e.message
      console.error('获取地震数据失败:', e)
    } finally {
      loading.value = false
    }
  }

  return { loading, error, seismicData, fetchSeismic }
}

// 获取天气数据
export const useWeatherData = () => {
  const loading = ref(false)
  const error = ref(null)
  const weatherData = ref([])
  const currentWeather = ref(null)

  const fetchWeather = async (range = '24h') => {
    loading.value = true
    error.value = null
    try {
      weatherData.value = await api.getWeatherData(range)
    } catch (e) {
      error.value = e.message
      console.error('获取天气数据失败:', e)
    } finally {
      loading.value = false
    }
  }

  const fetchCurrentWeather = async () => {
    loading.value = true
    error.value = null
    try {
      currentWeather.value = await api.getCurrentWeather()
    } catch (e) {
      error.value = e.message
      console.error('获取当前天气失败:', e)
    } finally {
      loading.value = false
    }
  }

  return { loading, error, weatherData, currentWeather, fetchWeather, fetchCurrentWeather }
}

// 获取空气质量数据
export const useAirQualityData = () => {
  const loading = ref(false)
  const error = ref(null)
  const airQuality = ref(null)

  const fetchAirQuality = async () => {
    loading.value = true
    error.value = null
    try {
      airQuality.value = await api.getAirQuality()
    } catch (e) {
      error.value = e.message
      console.error('获取空气质量失败:', e)
    } finally {
      loading.value = false
    }
  }

  return { loading, error, airQuality, fetchAirQuality }
}

// 获取列车统计数据
export const useTrainStatsData = () => {
  const loading = ref(false)
  const error = ref(null)
  const trainStats = ref(null)

  const fetchTrainStats = async () => {
    loading.value = true
    error.value = null
    try {
      trainStats.value = await api.getTrainStats()
    } catch (e) {
      error.value = e.message
      console.error('获取列车统计失败:', e)
    } finally {
      loading.value = false
    }
  }

  return { loading, error, trainStats, fetchTrainStats }
}

// 获取铁道信息
export const useRailwayData = () => {
  const loading = ref(false)
  const error = ref(null)
  const railway = ref(null)

  const fetchRailway = async () => {
    loading.value = true
    error.value = null
    try {
      railway.value = await api.getRailway()
    } catch (e) {
      error.value = e.message
      console.error('获取铁道信息失败:', e)
    } finally {
      loading.value = false
    }
  }

  return { loading, error, railway, fetchRailway }
}

// 获取参数历史数据
export const useParamsHistory = () => {
  const loading = ref(false)
  const error = ref(null)
  const paramHistory = ref([])

  const fetchParamHistory = async (type = 'temperature', range = '24h', signalId = 1) => {
    loading.value = true
    error.value = null
    try {
      paramHistory.value = await api.getParamHistory(type, range, signalId)
    } catch (e) {
      error.value = e.message
      console.error('获取参数历史失败:', e)
    } finally {
      loading.value = false
    }
  }

  return { loading, error, paramHistory, fetchParamHistory }
}

// 获取AI对话数据
export const useAiConversations = () => {
  const loading = ref(false)
  const error = ref(null)
  const conversations = ref([])

  const fetchConversations = async (sessionId = null) => {
    loading.value = true
    error.value = null
    try {
      conversations.value = await api.getAiConversations(sessionId)
    } catch (e) {
      error.value = e.message
      console.error('获取AI对话失败:', e)
    } finally {
      loading.value = false
    }
  }

  const addConversation = async (sessionId, role, content) => {
    try {
      const newConv = await api.addAiConversation(sessionId, role, content)
      conversations.value.push(newConv)
      return newConv
    } catch (e) {
      console.error('添加AI对话失败:', e)
      throw e
    }
  }

  return { loading, error, conversations, fetchConversations, addConversation }
}

export default {
  useDashboardData,
  useSignalsData,
  useSeismicData,
  useWeatherData,
  useAirQualityData,
  useTrainStatsData,
  useRailwayData,
  useParamsHistory,
  useAiConversations
}
