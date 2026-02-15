// API 服务 - 与后端通信
const API_BASE = import.meta.env.VITE_API_BASE || ''

// 通用请求函数
const request = async (url, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || '请求失败')
    }
    return data.data
  } catch (error) {
    console.error('API请求错误:', error)
    throw error
  }
}

// ==================== 信号灯 API ====================
export const getSignals = () => request('/api/signals')
export const getSignal = (id) => request(`/api/signals/${id}`)
export const createSignal = (data) => request('/api/signals', {
  method: 'POST',
  body: JSON.stringify(data)
})
export const updateSignal = (id, data) => request(`/api/signals/${id}`, {
  method: 'PUT',
  body: JSON.stringify(data)
})
export const deleteSignal = (id) => request(`/api/signals/${id}`, {
  method: 'DELETE'
})

// ==================== 地震数据 API ====================
export const getSeismicData = (range = '24h') => request(`/api/seismic?range=${range}`)
export const addSeismicData = (level, location) => request('/api/seismic', {
  method: 'POST',
  body: JSON.stringify({ level, location })
})

// ==================== 天气数据 API ====================
export const getWeatherData = (range = '24h') => request(`/api/weather?range=${range}`)
export const getCurrentWeather = () => request('/api/weather/current')

// ==================== 空气质量 API ====================
export const getAirQuality = () => request('/api/air-quality')

// ==================== 列车统计 API ====================
export const getTrainStats = () => request('/api/train-stats')
export const updateTrainStats = (data) => request('/api/train-stats', {
  method: 'PUT',
  body: JSON.stringify(data)
})

// ==================== 铁道信息 API ====================
export const getRailway = () => request('/api/railway')

// ==================== 参数历史 API ====================
export const getParamHistory = (type = 'temperature', range = '24h', signalId = 1) =>
  request(`/api/param-history?type=${type}&range=${range}&signal_id=${signalId}`)

// ==================== AI对话 API ====================
export const getAiConversations = (sessionId) => {
  const url = sessionId ? `/api/ai-conversations?session_id=${sessionId}` : '/api/ai-conversations'
  return request(url)
}
export const addAiConversation = (sessionId, role, content) => request('/api/ai-conversations', {
  method: 'POST',
  body: JSON.stringify({ session_id: sessionId, role, content })
})

// ==================== 系统日志 API ====================
export const getLogs = (type, limit = 100) => {
  const url = type ? `/api/logs?type=${type}&limit=${limit}` : `/api/logs?limit=${limit}`
  return request(url)
}
export const addLog = (logType, logLevel, message, details) => request('/api/logs', {
  method: 'POST',
  body: JSON.stringify({ log_type: logType, log_level: logLevel, message, details })
})

// ==================== 仪表盘汇总 API ====================
export const getDashboard = () => request('/api/dashboard')

export default {
  getSignals,
  getSignal,
  createSignal,
  updateSignal,
  deleteSignal,
  getSeismicData,
  addSeismicData,
  getWeatherData,
  getCurrentWeather,
  getAirQuality,
  getTrainStats,
  updateTrainStats,
  getRailway,
  getParamHistory,
  getAiConversations,
  addAiConversation,
  getLogs,
  addLog,
  getDashboard
}
