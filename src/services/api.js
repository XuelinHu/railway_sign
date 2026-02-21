const nowIso = () => new Date().toISOString()

const wait = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms))

const memory = {
  signals: [
    {
      id: 1,
      name: '\u4e3b\u4fe1\u53f7\u706f',
      status: 'red',
      temperature: 35.2,
      humidity: 66.4,
      light_intensity: 920,
      voltage: 220.6,
      current: 2.41,
      signal_strength: -47,
    },
  ],
  trainStats: {
    passed_count: 42,
    total_count: 58,
    on_time_rate: 96.5,
    next_train: 'G1502 14:35',
  },
  railway: {
    name: '\u6e58\u6842\u94c1\u8def',
    start_station: '\u67f3\u5dde\u7ad9',
    end_station: '\u5357\u5b81\u7ad9',
    length_km: 255,
  },
  aiConversations: [
    {
      id: 1,
      session_id: 'default',
      role: 'assistant',
      content: '\u7cfb\u7edf\u5df2\u5207\u6362\u5230\u524d\u7aef\u672c\u5730\u6570\u636e\u6a21\u5f0f\u3002',
      created_at: nowIso(),
    },
  ],
  logs: [
    {
      id: 1,
      log_type: 'system',
      log_level: 'info',
      message: 'Frontend-only mode enabled',
      details: null,
      created_at: nowIso(),
    },
  ],
}

const randomFloat = (min, max, precision = 1) => {
  const factor = 10 ** precision
  return Math.round((min + Math.random() * (max - min)) * factor) / factor
}

const generateSeries = (length, min, max, mapValue) => {
  return Array.from({ length }, (_, index) => {
    const value = randomFloat(min, max, 2)
    return mapValue(value, index)
  })
}

const getSeriesLength = (range) => {
  if (range === 'week') return 7
  if (range === 'month') return 30
  return 24
}

const getSignals = async () => {
  await wait()
  return memory.signals.map((item) => ({ ...item }))
}

const getSignal = async (id) => {
  await wait()
  return memory.signals.find((item) => item.id === Number(id)) || null
}

const createSignal = async (data) => {
  await wait()
  const id = memory.signals.length ? Math.max(...memory.signals.map((item) => item.id)) + 1 : 1
  const created = { id, ...data }
  memory.signals.push(created)
  return created
}

const updateSignal = async (id, data) => {
  await wait()
  const index = memory.signals.findIndex((item) => item.id === Number(id))
  if (index === -1) return null
  memory.signals[index] = { ...memory.signals[index], ...data }
  return memory.signals[index]
}

const deleteSignal = async (id) => {
  await wait()
  const index = memory.signals.findIndex((item) => item.id === Number(id))
  if (index === -1) return { deleted: false }
  memory.signals.splice(index, 1)
  return { deleted: true }
}

const getSeismicData = async (range = '24h') => {
  await wait()
  return generateSeries(getSeriesLength(range), 1.2, 4.2, (value, index) => ({
    id: index + 1,
    level: value,
    location: '\u67f3\u5dde\u5c71\u533a',
    recorded_at: nowIso(),
  }))
}

const addSeismicData = async (level, location) => {
  await wait()
  return {
    id: Date.now(),
    level,
    location,
    recorded_at: nowIso(),
  }
}

const getWeatherData = async (range = '24h') => {
  await wait()
  return generateSeries(getSeriesLength(range), 16, 34, (value, index) => ({
    id: index + 1,
    temperature: value,
    humidity: Math.round(randomFloat(45, 90, 0)),
    wind_speed: `${randomFloat(1.2, 5.8, 1)}m/s`,
    visibility: `${Math.round(randomFloat(6, 18, 0))}km`,
    pressure: `${Math.round(randomFloat(1002, 1022, 0))}hPa`,
    recorded_at: nowIso(),
  }))
}

const getCurrentWeather = async () => {
  await wait()
  return {
    icon: '\u26c5',
    temperature: randomFloat(20, 33, 1),
    description: '\u591a\u4e91',
    location: '\u67f3\u5dde\u5e02',
    wind_speed: `${randomFloat(2.0, 4.5, 1)}m/s`,
    humidity: `${Math.round(randomFloat(55, 85, 0))}%`,
    visibility: `${Math.round(randomFloat(8, 16, 0))}km`,
    pressure: `${Math.round(randomFloat(1006, 1020, 0))}hPa`,
  }
}

const getAirQuality = async () => {
  await wait()
  const aqi = Math.round(randomFloat(35, 95, 0))
  return {
    aqi,
    level: aqi <= 50 ? '\u4f18' : '\u826f',
    pm25: Math.round(randomFloat(15, 45, 0)),
    pm10: Math.round(randomFloat(30, 80, 0)),
    o3: Math.round(randomFloat(40, 90, 0)),
    no2: Math.round(randomFloat(20, 50, 0)),
  }
}

const getTrainStats = async () => {
  await wait()
  return { ...memory.trainStats }
}

const updateTrainStats = async (data) => {
  await wait()
  memory.trainStats = { ...memory.trainStats, ...data }
  return { ...memory.trainStats }
}

const getRailway = async () => {
  await wait()
  return { ...memory.railway }
}

const getParamHistory = async (type = 'temperature', range = '24h', signalId = 1) => {
  await wait()
  const settings = {
    temperature: { min: 22, max: 45 },
    humidity: { min: 40, max: 90 },
    light: { min: 100, max: 1800 },
    voltage: { min: 205, max: 230 },
    current: { min: 1.4, max: 3.8 },
    signal: { min: -75, max: -40 },
  }
  const { min, max } = settings[type] || settings.temperature

  return generateSeries(getSeriesLength(range), min, max, (value, index) => ({
    id: index + 1,
    signal_id: signalId,
    param_type: type,
    param_value: value,
    created_at: nowIso(),
  }))
}

const getAiConversations = async (sessionId) => {
  await wait()
  if (!sessionId) return [...memory.aiConversations]
  return memory.aiConversations.filter((item) => item.session_id === sessionId)
}

const addAiConversation = async (sessionId, role, content) => {
  await wait()
  const created = {
    id: Date.now(),
    session_id: sessionId || 'default',
    role,
    content,
    created_at: nowIso(),
  }
  memory.aiConversations.push(created)
  return created
}

const getLogs = async (type, limit = 100) => {
  await wait()
  const source = type ? memory.logs.filter((item) => item.log_type === type) : memory.logs
  return source.slice(-Math.max(1, limit))
}

const addLog = async (logType, logLevel, message, details) => {
  await wait()
  const created = {
    id: Date.now(),
    log_type: logType,
    log_level: logLevel,
    message,
    details: details || null,
    created_at: nowIso(),
  }
  memory.logs.push(created)
  return created
}

const getDashboard = async () => {
  const [weather, airQuality, trainStats, railway, seismic] = await Promise.all([
    getCurrentWeather(),
    getAirQuality(),
    getTrainStats(),
    getRailway(),
    getSeismicData('24h'),
  ])

  return {
    weather,
    airQuality,
    trainStats,
    railway,
    seismic,
  }
}

export {
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
  getDashboard,
}

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
  getDashboard,
}
