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
      <!-- 温度趋势图 -->
      <div class="trend-chart">
        <div class="chart-title">24小时温度趋势</div>
        <div class="chart-container">
          <svg viewBox="0 0 280 60" class="trend-svg">
            <defs>
              <linearGradient id="tempGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:0.3" />
                <stop offset="100%" style="stop-color:#00d4ff;stop-opacity:0" />
              </linearGradient>
            </defs>
            <path :d="temperatureAreaPath" fill="url(#tempGradient)" />
            <path :d="temperatureLinePath" fill="none" stroke="#00d4ff" stroke-width="2" />
            <circle v-for="(point, i) in temperaturePoints" :key="i"
              :cx="point.x" :cy="point.y" r="2" fill="#00d4ff" class="chart-dot" />
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
      <!-- 空气质量 -->
      <div class="air-quality">
        <div class="aqi-display">
          <span class="aqi-value" :style="{ color: aqiColor }">{{ weather.airQuality }}</span>
          <span class="aqi-label">{{ aqiLabel }}</span>
        </div>
        <div class="pollutants">
          <div class="pollutant-item">
            <span class="pollutant-label">PM2.5</span>
            <div class="pollutant-bar">
              <div class="pollutant-fill" :style="{ width: (weather.pm25 / 150 * 100) + '%', background: '#ff6b6b' }"></div>
            </div>
            <span class="pollutant-value">{{ weather.pm25 }}</span>
          </div>
          <div class="pollutant-item">
            <span class="pollutant-label">PM10</span>
            <div class="pollutant-bar">
              <div class="pollutant-fill" :style="{ width: (weather.pm10 / 200 * 100) + '%', background: '#ffaa00' }"></div>
            </div>
            <span class="pollutant-value">{{ weather.pm10 }}</span>
          </div>
          <div class="pollutant-item">
            <span class="pollutant-label">SO₂</span>
            <div class="pollutant-bar">
              <div class="pollutant-fill" :style="{ width: (weather.so2 / 50 * 100) + '%', background: '#00d4ff' }"></div>
            </div>
            <span class="pollutant-value">{{ weather.so2 }}</span>
          </div>
          <div class="pollutant-item">
            <span class="pollutant-label">NO₂</span>
            <div class="pollutant-bar">
              <div class="pollutant-fill" :style="{ width: (weather.no2 / 100 * 100) + '%', background: '#00ff88' }"></div>
            </div>
            <span class="pollutant-value">{{ weather.no2 }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 传感器状态 -->
    <div class="panel-section sensor-section">
      <div class="section-header">
        <span class="section-icon">📡</span>
        <span class="section-title">传感器监控</span>
        <span class="section-badge online">{{ onlineSensors }}/{{ sensors.length }} 在线</span>
      </div>
      <div class="sensor-list">
        <div
          v-for="sensor in displayedSensors"
          :key="sensor.id"
          :class="['sensor-item', sensor.status]"
        >
          <div class="sensor-header">
            <span class="sensor-icon">{{ sensorIcon(sensor.icon) }}</span>
            <span class="sensor-name">{{ sensor.name }}</span>
            <span :class="['sensor-status', sensor.status]">{{ statusText(sensor.status) }}</span>
          </div>
          <div class="sensor-value-row">
            <span class="sensor-value">{{ sensor.value }}</span>
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

// 计算在线传感器数量
const onlineSensors = computed(() => {
  return sensors.value.filter(s => s.status === 'normal').length
})

// 显示前8个传感器
const displayedSensors = computed(() => sensors.value.slice(0, 8))

// 温度趋势图路径
const temperatureLinePath = computed(() => {
  const data = weather.value.temperatureTrend
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 280
    const y = 55 - ((v + 5) / 40) * 50
    return `${x},${y}`
  })
  return `M${points.join(' L')}`
})

const temperatureAreaPath = computed(() => {
  const data = weather.value.temperatureTrend
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 280
    const y = 55 - ((v + 5) / 40) * 50
    return `${x},${y}`
  })
  return `M0,60 L${points.join(' L')} L280,60 Z`
})

const temperaturePoints = computed(() => {
  const data = weather.value.temperatureTrend
  return data.filter((_, i) => i % 4 === 0).map((v, i) => ({
    x: (i * 4 / (data.length - 1)) * 280,
    y: 55 - ((v + 5) / 40) * 50
  }))
})

// AQI 颜色和标签
const aqiColor = computed(() => {
  const aqi = weather.value.airQuality
  if (aqi <= 50) return '#00ff88'
  if (aqi <= 100) return '#ffaa00'
  if (aqi <= 150) return '#ff9966'
  if (aqi <= 200) return '#ff6b6b'
  return '#aa00ff'
})

const aqiLabel = computed(() => {
  const aqi = weather.value.airQuality
  if (aqi <= 50) return '优'
  if (aqi <= 100) return '良'
  if (aqi <= 150) return '轻度污染'
  if (aqi <= 200) return '中度污染'
  return '重度污染'
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
  font-size: 48px;
  font-weight: bold;
  color: #00d4ff;
  text-shadow: 0 0 20px rgba(0, 200, 255, 0.5);
}

.temp-unit {
  font-size: 20px;
  color: #aaa;
  margin-left: 5px;
}

.weather-value {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.weather-value .unit {
  font-size: 12px;
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

/* 空气质量 */
.air-quality {
  display: flex;
  gap: 15px;
  align-items: center;
}

.aqi-display {
  text-align: center;
  min-width: 60px;
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
