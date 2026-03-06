<template>
  <div class="left-panel">
    <!-- 气象监测 -->
    <div class="panel-section weather-section">
      <div class="section-header">
        <span class="section-icon">🌤</span>
        <span class="section-title">气象监测</span>
        <span class="section-badge">{{ weather.weatherType }}</span>
      </div>
      <div class="weather-grid">
        <div class="weather-item main">
          <div class="weather-icon">
            <span class="temp-display">{{ weather.temperature }}</span>
            <span class="temp-unit">°C</span>
          </div>
          <div class="weather-label">实时温度</div>
        </div>
        <div class="weather-item">
          <div class="weather-value">{{ weather.humidity }}<span class="unit">%</span></div>
          <div class="weather-label">湿度</div>
        </div>
        <div class="weather-item">
          <div class="weather-value">{{ weather.windSpeed }}<span class="unit">m/s</span></div>
          <div class="weather-label">{{ weather.windDirection }}风</div>
        </div>
        <div class="weather-item">
          <div class="weather-value">{{ weather.pressure }}<span class="unit">hPa</span></div>
          <div class="weather-label">气压</div>
        </div>
        <div class="weather-item">
          <div class="weather-value">{{ weather.visibility }}<span class="unit">km</span></div>
          <div class="weather-label">能见度</div>
        </div>
        <div class="weather-item">
          <div class="weather-value">{{ weather.precipitation }}<span class="unit">mm</span></div>
          <div class="weather-label">降水量</div>
        </div>
      </div>
      <!-- 趋势图（恶劣天气/湿度异常时切换为湿度趋势） -->
      <div class="trend-chart">
        <div class="chart-title">{{ trendTitle }}</div>
        <div class="chart-container">
          <svg viewBox="0 0 280 60" class="trend-svg">
            <defs>
              <linearGradient id="tempGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" :style="`stop-color:${trendColor};stop-opacity:0.3`" />
                <stop offset="100%" :style="`stop-color:${trendColor};stop-opacity:0`" />
              </linearGradient>
            </defs>
            <path :d="trendAreaPath" fill="url(#tempGradient)" />
            <path :d="trendLinePath" fill="none" :stroke="trendColor" stroke-width="2.5" />
            <circle v-for="(point, i) in trendPoints" :key="i"
              :cx="point.x" :cy="point.y" r="2" :fill="trendColor" class="chart-dot" />
          </svg>
          <div class="chart-labels">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>
      </div>
      <!-- 空气湿度 -->
      <div class="air-quality">
        <div class="air-quality-header">
          <span class="air-quality-title">空气湿度</span>
        </div>
        <div class="aqi-display">
          <span class="aqi-value" :style="{ color: aqiColor }">{{ humidityShown }}%</span>
          <span class="aqi-label">{{ aqiLabel }}</span>
        </div>
      </div>
    </div>

    <!-- 传感器状态 -->
    <div class="panel-section sensor-section">
      <div class="section-header">
        <span class="section-icon">📡</span>
        <span class="section-title">传感器监控</span>
        <span class="section-badge online">{{ onlineSensors }}/{{ processedSensors.length }} 在线</span>
      </div>
      <div class="sensor-list">
        <div
          v-for="sensor in displayedSensors"
          :key="sensor.id"
          :class="['sensor-item', sensor.status, { 'anomaly-flash': sensor.isAnomaly }]"
        >
          <div class="sensor-header">
            <span class="sensor-icon">{{ sensorIcon(sensor.icon) }}</span>
            <span class="sensor-name">{{ sensor.name }}</span>
            <span :class="['sensor-status', sensor.status]">{{ statusText(sensor.status) }}</span>
          </div>
          <div class="sensor-value-row">
            <span class="sensor-value" :class="{ abnormal: sensor.isAnomaly }">{{ sensor.value }}</span>
            <span class="sensor-unit">{{ sensor.unit }}</span>
          </div>
          <div class="sensor-meta">
            <span class="sensor-location">📍 {{ sensor.location }}</span>
            <span class="sensor-time">🕐 {{ sensor.updateTime }}</span>
          </div>
          <!-- 传感器迷你趋势图 -->
          <div class="sensor-mini-chart">
            <svg viewBox="0 0 80 20">
              <polyline
                :points="sensorHistoryPoints(sensor.history)"
                fill="none"
                :stroke="sensor.status === 'normal' ? '#00ff88' : sensor.status === 'warning' ? '#ffaa00' : '#ff6b6b'"
                stroke-width="1.5"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- 环境监测 -->
    <div class="panel-section env-section">
      <div class="section-header">
        <span class="section-icon">🔬</span>
        <span class="section-title">环境监测</span>
      </div>
      <div class="env-grid">
        <div class="env-item" v-for="item in envData" :key="item.label">
          <div class="env-gauge">
            <svg viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="5" />
              <circle
                cx="30" cy="30" r="25"
                fill="none"
                :stroke="item.color"
                stroke-width="5"
                stroke-linecap="round"
                :stroke-dasharray="157"
                :stroke-dashoffset="157 - (item.value / item.max * 157)"
                class="gauge-circle"
              />
              <text x="30" y="30" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="12">
                {{ item.value }}
              </text>
            </svg>
          </div>
          <div class="env-label">{{ item.label }}</div>
          <div class="env-unit">{{ item.unit }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getWeatherData, getSensorData } from '../../services/mockDataService'

const weather = ref(getWeatherData())
const sensors = ref(getSensorData())
const updateTimer = ref(null)

const props = defineProps({
  humidityAnomaly: {
    type: Boolean,
    default: false
  },
  temperatureAnomaly: {
    type: Boolean,
    default: false
  }
})

const processedSensors = computed(() => {
  return sensors.value.map((sensor) => {
    const humidityAnomaly = props.humidityAnomaly && sensor.icon === 'droplet'
    const temperatureAnomaly = props.temperatureAnomaly && sensor.icon === 'thermometer'
    const isAnomaly = humidityAnomaly || temperatureAnomaly

    if (!isAnomaly) {
      return { ...sensor, isAnomaly: false }
    }

    return {
      ...sensor,
      status: 'error',
      isAnomaly: true
    }
  })
})

// 计算在线传感器数量
const onlineSensors = computed(() => {
  return processedSensors.value.filter(s => s.status === 'normal').length
})

// 显示前8个传感器
const displayedSensors = computed(() => processedSensors.value.slice(0, 8))

const trendMode = computed(() => (props.humidityAnomaly ? 'humidity' : 'temperature'))
const trendTitle = computed(() => (trendMode.value === 'humidity' ? '24小时湿度趋势' : '24小时温度趋势'))
const trendColor = computed(() => (trendMode.value === 'humidity' ? '#ff2f2f' : '#00d4ff'))

const trendData = computed(() => {
  return trendMode.value === 'humidity'
    ? (weather.value.humidityTrend || [])
    : (weather.value.temperatureTrend || [])
})

const trendPointY = (v) => {
  if (trendMode.value === 'humidity') {
    const vv = Math.max(0, Math.min(100, Number(v)))
    return 55 - (vv / 100) * 50
  }
  const vv = Number(v)
  return 55 - ((vv + 5) / 40) * 50
}

const trendLinePath = computed(() => {
  const data = trendData.value
  if (!data.length) return ''
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 280
    const y = trendPointY(v)
    return `${x},${y}`
  })
  return `M${points.join(' L')}`
})

const trendAreaPath = computed(() => {
  const data = trendData.value
  if (!data.length) return ''
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 280
    const y = trendPointY(v)
    return `${x},${y}`
  })
  return `M0,60 L${points.join(' L')} L280,60 Z`
})

const trendPoints = computed(() => {
  const data = trendData.value
  if (!data.length) return []
  // 取 6 个点用于 hover 显示（保持原来“稀疏点”效果）
  const step = Math.max(1, Math.floor(data.length / 6))
  return data.filter((_, i) => i % step === 0).map((v, i) => ({
    x: (i * step / (data.length - 1)) * 280,
    y: trendPointY(v)
  }))
})

const humidityShown = computed(() => Math.round(Number(weather.value.humidity) || 0))

// 湿度告警颜色和标签（<60 正常；60~70 橙；>=70 红）
const aqiColor = computed(() => {
  const h = humidityShown.value
  if (h < 60) return '#00ff88'
  if (h < 70) return '#ffaa00'
  return '#ff2f2f'
})

const aqiLabel = computed(() => {
  const h = humidityShown.value
  if (h < 60) return '正常'
  if (h < 70) return '橙色告警'
  return '红色告警'
})

// 传感器图标
const sensorIcon = (type) => {
  const icons = {
    thermometer: '🌡',
    droplet: '💧',
    gauge: '⏱',
    activity: '📈',
    zap: '⚡',
    bolt: '🔌',
    move: '↔️',
    flow: '🌊',
    rotate: '🔄',
    volume: '🔊',
    smoke: '💨',
    sun: '☀️'
  }
  return icons[type] || '📊'
}

// 状态文本
const statusText = (status) => {
  const texts = {
    normal: '正常',
    warning: '预警',
    error: '故障'
  }
  return texts[status] || status
}

// 传感器历史数据点
const sensorHistoryPoints = (history) => {
  return history.map((v, i) => {
    const x = (i / (history.length - 1)) * 80
    const min = Math.min(...history)
    const max = Math.max(...history)
    const range = max - min || 1
    const y = 18 - ((v - min) / range) * 16
    return `${x},${y}`
  }).join(' ')
}

// 环境监测数据
const envData = computed(() => [
  { label: '噪音', value: random(30, 80), unit: 'dB', max: 120, color: '#00d4ff' },
  { label: '光照', value: random(100, 800), unit: 'lux', max: 1000, color: '#ffaa00' },
  { label: 'CO₂', value: random(300, 600), unit: 'ppm', max: 1000, color: '#00ff88' },
  { label: '粉尘', value: random(0, 50), unit: 'mg/m³', max: 100, color: '#ff6b6b' }
])

const random = (min, max) => Math.floor(Math.random() * (max - min) + min)

// 定时更新数据
onMounted(() => {
  updateTimer.value = setInterval(() => {
    weather.value = getWeatherData()
    sensors.value = getSensorData()
  }, 5000)
})

onUnmounted(() => {
  if (updateTimer.value) {
    clearInterval(updateTimer.value)
  }
})
</script>

<style scoped>
.left-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  padding-right: 5px;
}

.left-panel::-webkit-scrollbar {
  width: 4px;
}

.left-panel::-webkit-scrollbar-thumb {
  background: rgba(0, 200, 255, 0.3);
  border-radius: 2px;
}

.panel-section {
  background: linear-gradient(135deg, rgba(0, 30, 60, 0.9) 0%, rgba(0, 50, 100, 0.6) 100%);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 10px;
  padding: 15px;
  backdrop-filter: blur(10px);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0, 200, 255, 0.2);
}

.section-icon {
  font-size: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  color: #00d4ff;
  flex: 1;
}

.section-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(0, 200, 255, 0.2);
  border: 1px solid rgba(0, 200, 255, 0.4);
  border-radius: 10px;
  color: #00d4ff;
}

.section-badge.online {
  background: rgba(0, 255, 136, 0.2);
  border-color: rgba(0, 255, 136, 0.4);
  color: #00ff88;
}

/* 气象区域 */
.weather-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 15px;
}

.weather-item {
  background: rgba(0, 50, 100, 0.3);
  border-radius: 8px;
  padding: 10px;
  text-align: center;
}

.weather-item.main {
  grid-column: span 3;
  background: linear-gradient(135deg, rgba(0, 100, 200, 0.3), rgba(0, 200, 255, 0.1));
  border: 1px solid rgba(0, 200, 255, 0.3);
}

.weather-icon {
  display: flex;
  align-items: baseline;
  justify-content: center;
}

.temp-display {
  font-size: 36px;
  font-weight: bold;
  color: #00d4ff;
  text-shadow: 0 0 20px rgba(0, 200, 255, 0.5);
}

.temp-unit {
  font-size: 16px;
  color: #aaa;
  margin-left: 3px;
}

.weather-value {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
}

.weather-value .unit {
  font-size: 10px;
  color: #888;
  margin-left: 2px;
}

.weather-label {
  font-size: 11px;
  color: #888;
  margin-top: 5px;
}

/* 趋势图 */
.trend-chart {
  margin-bottom: 15px;
}

.chart-title {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 8px;
}

.chart-container {
  position: relative;
}

.trend-svg {
  width: 100%;
  height: 60px;
}

.chart-dot {
  opacity: 0;
  transition: opacity 0.3s;
}

.trend-svg:hover .chart-dot {
  opacity: 1;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #666;
  margin-top: 5px;
}

/* 空气湿度 */
.air-quality {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.air-quality-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.air-quality-title {
  font-size: 12px;
  font-weight: bold;
  color: #00d4ff;
  letter-spacing: 1px;
}

.aqi-display {
  text-align: left;
  min-width: 0;
}

.aqi-value {
  font-size: 28px;
  font-weight: bold;
  display: block;
}

.aqi-label {
  font-size: 12px;
  color: #888;
}

.pollutants {
  flex: 1;
}

.pollutant-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.pollutant-label {
  font-size: 10px;
  color: #888;
  width: 35px;
}

.pollutant-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.pollutant-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

.pollutant-value {
  font-size: 10px;
  color: #aaa;
  width: 30px;
  text-align: right;
}

/* 传感器列表 */
.sensor-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.sensor-list::-webkit-scrollbar {
  width: 3px;
}

.sensor-list::-webkit-scrollbar-thumb {
  background: rgba(0, 200, 255, 0.3);
  border-radius: 2px;
}

.sensor-item {
  background: rgba(0, 50, 100, 0.2);
  border-radius: 8px;
  padding: 10px;
  border-left: 3px solid;
  transition: all 0.3s;
}

.sensor-item.normal {
  border-left-color: #00ff88;
}

.sensor-item.warning {
  border-left-color: #ffaa00;
  background: rgba(255, 170, 0, 0.1);
}

.sensor-item.error {
  border-left-color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
}

.sensor-item.anomaly-flash {
  border-left-color: #ff2424;
  background: rgba(255, 30, 30, 0.24);
  box-shadow: 0 0 18px rgba(255, 40, 40, 0.55), inset 0 0 12px rgba(255, 20, 20, 0.3);
  animation: anomalyFlash 0.95s infinite;
}

.sensor-value.abnormal {
  color: #ff4040;
  text-shadow: 0 0 10px rgba(255, 64, 64, 0.7);
}

@keyframes anomalyFlash {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.35); }
}

.sensor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.sensor-icon {
  font-size: 14px;
}

.sensor-name {
  font-size: 12px;
  color: #fff;
  flex: 1;
}

.sensor-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}

.sensor-status.normal {
  background: rgba(0, 255, 136, 0.2);
  color: #00ff88;
}

.sensor-status.warning {
  background: rgba(255, 170, 0, 0.2);
  color: #ffaa00;
}

.sensor-status.error {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
}

.sensor-value-row {
  margin-bottom: 5px;
}

.sensor-value {
  font-size: 18px;
  font-weight: bold;
  color: #00d4ff;
}

.sensor-unit {
  font-size: 11px;
  color: #888;
  margin-left: 4px;
}

.sensor-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #666;
  margin-bottom: 5px;
}

.sensor-mini-chart {
  height: 20px;
}

.sensor-mini-chart svg {
  width: 100%;
  height: 100%;
}

/* 环境监测 */
.env-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.env-item {
  text-align: center;
}

.env-gauge {
  width: 50px;
  height: 50px;
  margin: 0 auto 5px;
}

.gauge-circle {
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 1s ease;
}

.env-label {
  font-size: 10px;
  color: #aaa;
}

.env-unit {
  font-size: 9px;
  color: #666;
}
</style>
