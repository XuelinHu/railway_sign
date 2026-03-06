<template>
  <div class="cesium-view">
    <!-- Cesium 容器 -->
    <div id="cesiumContainer" ref="cesiumContainer"></div>

    <!-- 控制按钮 -->
    <div class="control-buttons">
      <button class="reset-btn" @click="resetView">🎯 复位视角</button>
      <button class="toggle-btn" @click="toggleLeftPanel">
        {{ leftPanelVisible ? '◀ 隐藏左侧' : '▶ 显示左侧' }}
      </button>
      <button class="toggle-btn" @click="toggleRightPanel">
        {{ rightPanelVisible ? '隐藏右侧 ▶' : '◀ 显示右侧' }}
      </button>
      <button class="toggle-btn" :class="{ active: cameraCruiseEnabled }" @click="toggleCameraCruise">
        {{ cameraCruiseEnabled ? '🎥 停止巡航' : '🎥 自动巡航' }}
      </button>
      <button class="toggle-btn" :class="{ active: severeWeatherEnabled }" @click="toggleSevereWeather">
        {{ severeWeatherEnabled ? '⛈️ 停止恶劣天气' : '⛈️ 恶劣天气模拟' }}
      </button>
    </div>

    <!-- 左侧面板 - 地理信息与铁道数据 -->
    <transition name="slide-left">
      <div v-show="leftPanelVisible" class="side-panel left-panel">
        <!-- 地理震动监测 -->
        <div class="panel-card">
          <div class="panel-header">
            <span class="panel-title">📍 地理震动监测</span>
            <span class="panel-subtitle">SEISMIC MONITORING</span>
          </div>
          <div class="panel-content">
            <div class="seismic-display">
              <div class="seismic-gauge">
                <svg viewBox="0 0 120 80" class="gauge-svg">
                  <rect x="10" y="60" width="100" height="15" rx="3" fill="rgba(0,200,255,0.1)" />
                  <rect x="10" y="60" :width="seismicLevel * 10" height="15" rx="3" :fill="seismicColor" />
                  <line x1="35" y1="55" x2="35" y2="80" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
                  <line x1="60" y1="55" x2="60" y2="80" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
                  <line x1="85" y1="55" x2="85" y2="80" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
                </svg>
              </div>
              <div class="seismic-info">
                <div class="seismic-value">
                  <span class="value-label">震动等级</span>
                  <span class="value-num" :style="{ color: seismicColor }">{{ seismicLevel.toFixed(1) }}</span>
                </div>
                <div class="seismic-status" :class="seismicStatusClass">
                  {{ seismicStatus }}
                </div>
              </div>
            </div>
            <div class="vibration-history">
              <div class="history-header">
                <span class="history-label">震动曲线</span>
                <select v-model="seismicTimeRange" class="time-select" @change="onSeismicTimeChange">
                  <option value="24h">近24小时</option>
                  <option value="week">近一周</option>
                  <option value="month">近一个月</option>
                </select>
              </div>
              <svg viewBox="0 0 280 60" class="history-svg">
                <defs>
                  <linearGradient id="seismicGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:#00d4ff;stop-opacity:0" />
                  </linearGradient>
                </defs>
                <polygon :points="seismicAreaPoints" fill="url(#seismicGradient)" />
                <polyline :points="seismicLinePoints" fill="none" stroke="#00d4ff" stroke-width="2" />
                <circle v-for="(point, idx) in seismicChartPoints" :key="idx"
                  :cx="point.x" :cy="point.y" r="3" fill="#00d4ff"
                  @mouseenter="hoveredSeismicPoint = idx"
                  @mouseleave="hoveredSeismicPoint = null" />
              </svg>
              <div v-if="hoveredSeismicPoint !== null" class="chart-tooltip">
                {{ seismicTimeLabels[hoveredSeismicPoint] }}: {{ currentSeismicData[hoveredSeismicPoint]?.toFixed(1) }}
              </div>
            </div>
          </div>
        </div>

        <!-- 当前位置信息 -->
        <div class="panel-card">
          <div class="panel-header">
            <span class="panel-title">🗺️ 当前位置</span>
            <span class="panel-subtitle">CURRENT POSITION</span>
          </div>
          <div class="panel-content">
            <div class="position-grid">
              <div class="pos-item">
                <span class="pos-icon">🌐</span>
                <span class="pos-label">经度</span>
                <span class="pos-value">{{ currentPosition.lon }}°E</span>
              </div>
              <div class="pos-item">
                <span class="pos-icon">🌐</span>
                <span class="pos-label">纬度</span>
                <span class="pos-value">{{ currentPosition.lat }}°N</span>
              </div>
              <div class="pos-item">
                <span class="pos-icon">⛰️</span>
                <span class="pos-label">海拔</span>
                <span class="pos-value">{{ currentPosition.altitude }}m</span>
              </div>
              <div class="pos-item">
                <span class="pos-icon">🧭</span>
                <span class="pos-label">方位角</span>
                <span class="pos-value">{{ currentPosition.heading }}°</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 地理信息（脱敏） -->
        <div class="panel-card">
          <div class="panel-header">
            <span class="panel-title">🛰️ 地理信息</span>
            <span class="panel-subtitle">GEO STATUS</span>
          </div>
          <div class="panel-content">
            <div class="railway-detail">
              <div class="detail-item">
                <span class="detail-label">场景模式</span>
                <span class="detail-val">3D</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">影像图层</span>
                <span class="detail-val">World Imagery</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">地形图层</span>
                <span class="detail-val">World Terrain</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">地形夸张</span>
                <span class="detail-val">{{ geoStats.terrainExaggeration }}x</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">信标数量</span>
                <span class="detail-val">{{ geoStats.beaconCount }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">雾效密度</span>
                <span class="detail-val">{{ geoStats.fogDensity }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 铁道信息 -->
        <div class="panel-card">
          <div class="panel-header">
            <span class="panel-title">🚂 铁道信息</span>
            <span class="panel-subtitle">RAILWAY INFO</span>
          </div>
          <div class="panel-content">
            <div class="railway-info">
              <div class="railway-detail">
                <div class="detail-item">
                  <span class="detail-label">起点</span>
                  <span class="detail-val">{{ currentRailway.start }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">终点</span>
                  <span class="detail-val">{{ currentRailway.end }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">全程</span>
                  <span class="detail-val">{{ currentRailway.length }}km</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </transition>

    <!-- 右侧面板 - 天气与AI -->
    <transition name="slide-right">
      <div v-show="rightPanelVisible" class="side-panel right-panel">
        <!-- 天气指数 -->
        <div class="panel-card weather-card">
          <div class="panel-header">
            <span class="panel-title">🌤️ 天气指数</span>
            <span class="panel-subtitle">WEATHER INFO</span>
          </div>
          <div class="panel-content">
            <div class="weather-compact">
              <div class="weather-left">
                <div class="weather-icon-small">{{ maskedWeather.icon }}</div>
                <div class="weather-info-compact">
                  <div class="weather-temp-compact">
                    <span class="temp-value-small">{{ maskedWeather.temp }}</span>
                    <span class="temp-unit-small">°C</span>
                  </div>
                  <div class="weather-desc-small">{{ maskedWeather.description }}</div>
                  <div class="weather-location-small">{{ maskedWeather.location }}</div>
                </div>
              </div>
              <div class="weather-right">
                <div class="w-item-compact" v-for="item in weatherCompactItems" :key="item.label">
                  <span class="w-icon-small">{{ item.icon }}</span>
                  <span class="w-info">
                    <span class="w-label-small">{{ item.label }}</span>
                    <span class="w-value-small">{{ item.value }}</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- 天气曲线图 -->
            <div class="weather-chart-section">
              <div class="history-header">
                <span class="history-label">{{ weatherTrendTitle }}</span>
                <select v-model="weatherTimeRange" class="time-select" @change="onWeatherTimeChange">
                  <option value="24h">近24小时</option>
                  <option value="week">近一周</option>
                  <option value="month">近一个月</option>
                </select>
              </div>
              <svg viewBox="0 0 280 70" class="history-svg">
                <defs>
                  <linearGradient id="weatherGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" :style="`stop-color:${weatherTrendColor};stop-opacity:0.4`" />
                    <stop offset="100%" :style="`stop-color:${weatherTrendColor};stop-opacity:0`" />
                  </linearGradient>
                </defs>
                <!-- 网格线 -->
                <line x1="10" y1="15" x2="270" y2="15" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                <line x1="10" y1="35" x2="270" y2="35" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                <line x1="10" y1="55" x2="270" y2="55" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                <polygon :points="weatherAreaPoints" fill="url(#weatherGradient)" />
                <polyline :points="weatherLinePoints" fill="none" :stroke="weatherTrendColor" stroke-width="2" />
                <circle v-for="(point, idx) in weatherChartPoints" :key="idx"
                  :cx="point.x" :cy="point.y" r="3" :fill="weatherTrendColor"
                  @mouseenter="hoveredWeatherPoint = idx"
                  @mouseleave="hoveredWeatherPoint = null" />
              </svg>
              <div v-if="hoveredWeatherPoint !== null" class="chart-tooltip weather-tooltip">
                {{ weatherTimeLabels[hoveredWeatherPoint] }}: {{ currentWeatherData[hoveredWeatherPoint] }}{{ weatherTrendUnit }}
              </div>
            </div>

            <button class="refresh-btn" @click="refreshWeather" :disabled="weatherLoading">
              {{ weatherLoading ? '刷新中...' : '🔄 刷新天气' }}
            </button>
          </div>
        </div>

        <!-- 今日列车统计 -->
        <div class="panel-card">
          <div class="panel-header">
            <span class="panel-title">📊 今日列车统计</span>
            <span class="panel-subtitle">TODAY'S TRAINS</span>
          </div>
          <div class="panel-content">
            <div class="train-stats">
              <div class="stat-circle">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(0,200,255,0.2)" stroke-width="6" />
                  <circle cx="40" cy="40" r="35" fill="none" stroke="#00d4ff" stroke-width="6"
                    stroke-dasharray="220" :stroke-dashoffset="220 - (trainStats.passed / trainStats.total) * 220"
                    transform="rotate(-90 40 40)" />
                </svg>
                <div class="stat-num">{{ trainStats.passed }}</div>
                <div class="stat-label">已通过</div>
              </div>
              <div class="stat-details">
                <div class="stat-row">
                  <span class="stat-label">计划总数</span>
                  <span class="stat-val">{{ trainStats.total }}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">准点率</span>
                  <span class="stat-val green">{{ trainStats.onTime }}%</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">下一班</span>
                  <span class="stat-val">{{ trainStats.nextTrain }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 空气湿度 -->
        <div class="panel-card aqi-card" :class="{ 'aqi-flash': airQualitySevereWarning }">
          <div class="panel-header">
            <span class="panel-title">空气湿度</span>
            <span class="panel-subtitle">AIR HUMIDITY</span>
          </div>
          <div class="panel-content">
            <div v-if="airQualitySevereWarning" class="aqi-severe-warning">
              红色告警：空气湿度过高，请注意防潮
            </div>
            <div class="aqi-summary">
              <div class="aqi-value" :class="humidityClass" :style="{ color: airQualityColor }">{{ airHumidity }}</div>
              <div class="aqi-level">{{ airHumidityLevel }}</div>
              <div class="aqi-unit">%</div>
            </div>
            <div class="history-header">
              <span class="history-label">空气湿度趋势</span>
              <select v-model="airQualityTimeRange" class="time-select" @change="onAirQualityTimeChange">
                <option value="day">天</option>
                <option value="week">周</option>
              </select>
            </div>
            <svg viewBox="0 0 280 70" class="history-svg aqi-chart">
              <defs>
                <linearGradient id="aqiGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" :style="`stop-color:${airQualityColor};stop-opacity:0.35`" />
                  <stop offset="100%" :style="`stop-color:${airQualityColor};stop-opacity:0`" />
                </linearGradient>
              </defs>
              <line x1="10" y1="15" x2="270" y2="15" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
              <line x1="10" y1="35" x2="270" y2="35" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
              <line x1="10" y1="55" x2="270" y2="55" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
              <polygon :points="airQualityAreaPoints" fill="url(#aqiGradient)" />
              <polyline :points="airQualityLinePoints" fill="none" :stroke="airQualityColor" stroke-width="2" />
              <circle v-for="(point, idx) in airQualityChartPoints" :key="idx"
                :cx="point.x" :cy="point.y" r="3" :fill="airQualityColor"
                @mouseenter="hoveredAirQualityPoint = idx"
                @mouseleave="hoveredAirQualityPoint = null" />
            </svg>
            <div v-if="hoveredAirQualityPoint !== null" class="chart-tooltip aqi-tooltip">
              {{ airQualityTimeLabels[hoveredAirQualityPoint] }}: {{ currentAirQualityData[hoveredAirQualityPoint] }}
            </div>
          </div>
        </div>

        <!-- 地理态势（脱敏） -->
        <div class="panel-card">
          <div class="panel-header">
            <span class="panel-title">🗺️ 地理态势</span>
            <span class="panel-subtitle">MAP SITUATION</span>
          </div>
          <div class="panel-content">
            <div class="railway-detail">
              <div class="detail-item">
                <span class="detail-label">巡航状态</span>
                <span class="detail-val">{{ cameraCruiseEnabled ? '开启' : '关闭' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">视角俯仰</span>
                <span class="detail-val">{{ geoStats.pitchDeg }}°</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">视角翻滚</span>
                <span class="detail-val">{{ geoStats.rollDeg }}°</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">可视范围</span>
                <span class="detail-val">X km</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">区域名称</span>
                <span class="detail-val">XX区域</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">更新频率</span>
                <span class="detail-val">{{ geoStats.refreshHz }}Hz</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import api from '../services/api.js'
import { severeWeatherEnabled, setSevereWeatherEnabled } from '../services/simulationState.js'
import { DEMO_SCENARIO } from '../config/demoScenario.js'
import { getWeatherData as getMockWeatherData } from '../services/mockDataService.js'

// Cesium Ion（用于 World Imagery / Terrain 等）。优先使用环境变量，未设置则回退到内置 token（便于开箱即用）。
Cesium.Ion.defaultAccessToken =
  import.meta.env.VITE_CESIUM_ION_TOKEN ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1MGE2NjE5OC05YmU5LTRiMTctODYxOC1hZWE0YTU0NDJmM2UiLCJpZCI6Mzg5Mzg5LCJpYXQiOjE3NzA3NzE2MjR9.XlfsTRYLQkmlFzS3Z-rGNLnchNdPlNqZUfzdX4SHtWU'

// 响应式变量
const cesiumContainer = ref(null)
const leftPanelVisible = ref(true)
const rightPanelVisible = ref(true)

let viewer = null
let beaconPoints = []
let beaconPopups = []
let selectedBeacon = null
let globalBreathStage = null
let globalBreathStartTime = Date.now()
let rainPostProcessStage = null
let updateDataTimer = null
const defaultFogDensity = 0.0001
let bgmAudio = null
let audioUnlockHandler = null
let cameraAngleChangedHandler = null
let cameraCruiseRafId = null
let cameraCruiseAutoPauseHandler = null
let cameraCruiseStartedAt = 0
let cameraCruiseTarget = null
let cameraCruiseBaseCenter = null
let cameraCruiseEnuToFixed = null
let cameraCruiseRange = 0

let severeWeatherEffectTimer = null
let severeWeatherHumidityTimer = null
let severeWeatherAqiTimer = null
const airQualitySevereWarning = ref(false)
const cameraCruiseEnabled = ref(true)

// ===== 地理震动数据 =====
const seismicLevel = ref(2.3)
const seismicTimeRange = ref('24h')
const hoveredSeismicPoint = ref(null)

// 地震历史数据 - 近24小时（每小时一个点）
const seismicData24h = ref([
  2.1, 1.8, 2.5, 3.1, 2.8, 2.2, 1.9, 2.4, 2.0, 2.3, 2.6, 2.1,
  1.7, 2.0, 2.4, 2.9, 3.2, 2.7, 2.3, 2.0, 1.8, 2.2, 2.5, 2.1
])

// 地震历史数据 - 近一周（每天一个点，7个点）
const seismicDataWeek = ref([2.3, 2.1, 2.8, 3.5, 2.9, 2.4, 2.2])

// 地震历史数据 - 近一个月（每天一个点，30个点）
const seismicDataMonth = ref([
  2.1, 2.3, 1.9, 2.5, 2.8, 3.1, 2.6, 2.2, 1.8, 2.4,
  2.7, 3.0, 2.5, 2.1, 1.7, 2.0, 2.3, 2.6, 2.9, 3.2,
  2.8, 2.4, 2.0, 1.8, 2.2, 2.5, 2.8, 3.1, 2.7, 2.3
])

// 时间标签
const seismicTimeLabels24h = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
const seismicTimeLabelsWeek = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const seismicTimeLabelsMonth = Array.from({ length: 30 }, (_, i) => `${i + 1}日`)

const currentSeismicData = computed(() => {
  switch (seismicTimeRange.value) {
    case 'week': return seismicDataWeek.value
    case 'month': return seismicDataMonth.value
    default: return seismicData24h.value
  }
})

const seismicTimeLabels = computed(() => {
  switch (seismicTimeRange.value) {
    case 'week': return seismicTimeLabelsWeek
    case 'month': return seismicTimeLabelsMonth
    default: return seismicTimeLabels24h
  }
})

const seismicChartPoints = computed(() => {
  const data = currentSeismicData.value
  const count = data.length
  const width = 260
  const height = 50
  const padding = 10

  return data.map((v, i) => ({
    x: padding + (i / (count - 1)) * width,
    y: padding + height - (v / 8) * height  // 假设最大值8
  }))
})

const seismicLinePoints = computed(() => {
  return seismicChartPoints.value.map(p => `${p.x},${p.y}`).join(' ')
})

const seismicAreaPoints = computed(() => {
  const points = seismicChartPoints.value
  if (points.length === 0) return ''
  const bottom = 60
  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ')
  const firstX = points[0].x
  const lastX = points[points.length - 1].x
  return `${firstX},${bottom} ${linePoints} ${lastX},${bottom}`
})

const onSeismicTimeChange = () => {
  hoveredSeismicPoint.value = null
}

const seismicColor = computed(() => {
  if (seismicLevel.value < 3) return '#00d4ff'
  if (seismicLevel.value < 5) return '#ffcc00'
  if (seismicLevel.value < 7) return '#ff9933'
  return '#ff3333'
})

const seismicStatus = computed(() => {
  if (seismicLevel.value < 3) return '稳定'
  if (seismicLevel.value < 5) return '轻微震动'
  if (seismicLevel.value < 7) return '中等震动'
  return '强震动'
})

const seismicStatusClass = computed(() => {
  if (seismicLevel.value < 3) return 'status-normal'
  if (seismicLevel.value < 5) return 'status-warning'
  return 'status-danger'
})

// ===== 当前位置 =====
const currentPosition = ref({
  lon: 'X',
  lat: 'Y',
  altitude: 'X',
  heading: 'X'
})

const geoStats = ref({
  terrainExaggeration: 'X',
  beaconCount: 0,
  fogDensity: 'X',
  pitchDeg: 'X',
  rollDeg: 'X',
  refreshHz: 30
})

// ===== 铁道信息 =====
const currentRailway = ref({
  name: DEMO_SCENARIO.railwayName,
  start: DEMO_SCENARIO.stationStart,
  end: DEMO_SCENARIO.stationEnd,
  length: '255'
})

// ===== 列车统计 =====
const trainStats = ref({
  passed: 42,
  total: 58,
  onTime: 100,
  nextTrain: 'G1502 14:35'
})

// ===== 天气数据 =====
const weather = ref({
  icon: '⛅',
  temp: 26,
  description: '多云',
  location: DEMO_SCENARIO.weatherLocation,
  windSpeed: '3.2m/s',
  humidity: '20%',
  visibility: '15km',
  pressure: '1013hPa'
})
const weatherLoading = ref(false)
const weatherTimeRange = ref('24h')
const hoveredWeatherPoint = ref(null)

const maskedWeather = computed(() => ({
  ...weather.value,
  temp: 'X',
  location: DEMO_SCENARIO.weatherLocation,
  windSpeed: 'X级',
  humidity: 'X%',
  visibility: 'Xkm',
  pressure: 'XhPa'
}))

// 天气紧凑显示项（脱敏展示）
const weatherCompactItems = computed(() => [
  { icon: '💨', label: '风速', value: maskedWeather.value.windSpeed },
  { icon: '💧', label: '湿度', value: maskedWeather.value.humidity },
  { icon: '🌫️', label: '能见度', value: maskedWeather.value.visibility },
  { icon: '🌡️', label: '气压', value: maskedWeather.value.pressure }
])

// 温度历史数据 - 近24小时
const weatherData24h = ref([
  22, 21, 20, 19, 18, 18, 19, 21, 23, 25, 27, 28,
  29, 30, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21
])

// 温度历史数据 - 近一周
const weatherDataWeek = ref([25, 27, 26, 28, 30, 29, 26])

// 温度历史数据 - 近一个月
const weatherDataMonth = ref([
  24, 25, 26, 27, 28, 27, 26, 25, 24, 26,
  28, 29, 30, 31, 30, 29, 28, 27, 26, 25,
  24, 25, 26, 27, 28, 29, 28, 27, 26, 26
])

// 湿度历史数据（用于恶劣天气模拟的上升折线）
const humidityData24h = ref([
  18, 18, 19, 19, 20, 20, 20, 21, 21, 20, 20, 19,
  19, 19, 20, 20, 21, 21, 22, 22, 21, 21, 20, 20
])
const humidityDataWeek = ref([19, 20, 20, 21, 21, 22, 20])
const humidityDataMonth = ref(Array.from({ length: 30 }, () => 20 + Math.round((Math.random() - 0.5) * 6)))

const weatherTrendMode = computed(() => (severeWeatherEnabled.value ? 'humidity' : 'temperature'))
const weatherTrendTitle = computed(() => (weatherTrendMode.value === 'humidity' ? '湿度趋势' : '温度趋势'))
const weatherTrendUnit = computed(() => (weatherTrendMode.value === 'humidity' ? '%' : '°C'))
const weatherTrendColor = computed(() => (weatherTrendMode.value === 'humidity' ? '#ff4040' : '#ff9900'))

const weatherTimeLabels24h = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
const weatherTimeLabelsWeek = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const weatherTimeLabelsMonth = Array.from({ length: 30 }, (_, i) => `${i + 1}日`)

const currentWeatherData = computed(() => {
  const byRange = (tempData, humidData) => {
    switch (weatherTimeRange.value) {
      case 'week': return weatherTrendMode.value === 'humidity' ? humidData.week : tempData.week
      case 'month': return weatherTrendMode.value === 'humidity' ? humidData.month : tempData.month
      default: return weatherTrendMode.value === 'humidity' ? humidData.h24 : tempData.h24
    }
  }

  return byRange(
    { h24: weatherData24h.value, week: weatherDataWeek.value, month: weatherDataMonth.value },
    { h24: humidityData24h.value, week: humidityDataWeek.value, month: humidityDataMonth.value }
  )
})

const weatherTimeLabels = computed(() => {
  switch (weatherTimeRange.value) {
    case 'week': return weatherTimeLabelsWeek
    case 'month': return weatherTimeLabelsMonth
    default: return weatherTimeLabels24h
  }
})

const weatherChartPoints = computed(() => {
  const data = currentWeatherData.value
  const count = data.length
  const width = 260
  const height = 50
  const padding = 10
  const minVal = weatherTrendMode.value === 'humidity' ? 0 : 15
  const maxVal = weatherTrendMode.value === 'humidity' ? 100 : 35
  const range = Math.max(1, maxVal - minVal)

  return data.map((v, i) => ({
    x: padding + (i / (count - 1)) * width,
    y: padding + height - ((v - minVal) / range) * height
  }))
})

const weatherLinePoints = computed(() => {
  return weatherChartPoints.value.map(p => `${p.x},${p.y}`).join(' ')
})

const weatherAreaPoints = computed(() => {
  const points = weatherChartPoints.value
  if (points.length === 0) return ''
  const bottom = 65
  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ')
  const firstX = points[0].x
  const lastX = points[points.length - 1].x
  return `${firstX},${bottom} ${linePoints} ${lastX},${bottom}`
})

const onWeatherTimeChange = () => {
  hoveredWeatherPoint.value = null
}

const syncWeatherFromMock = () => {
  const w = getMockWeatherData()
  if (!w) return

  // 当前天气（脱敏展示，保留趋势一致性）
  weather.value = {
    icon: w.weatherType === '暴雨' || w.weatherType === '大雨' ? '🌧️' : '⛅',
    temp: Math.round(Number(w.temperature) || 0),
    description: w.weatherType || '多云',
    location: DEMO_SCENARIO.weatherLocation,
    windSpeed: typeof w.windSpeed === 'number' ? `${w.windSpeed.toFixed(1)}m/s` : 'X级',
    humidity: Number.isFinite(Number(w.humidity)) ? `${Number(w.humidity).toFixed(1)}%` : 'X%',
    visibility: typeof w.visibility === 'number' ? `${Number(w.visibility).toFixed(0)}km` : 'Xkm',
    pressure: typeof w.pressure === 'number' ? `${Number(w.pressure).toFixed(0)}hPa` : 'XhPa'
  }

  // 趋势：优先对齐大数据平台湿度曲线（24h）
  if (Array.isArray(w.humidityTrend) && w.humidityTrend.length) {
    humidityData24h.value = w.humidityTrend.map((v) => Number(v))
    // 简单下采样得到周趋势（7点），避免与 24h 完全不同步
    humidityDataWeek.value = Array.from({ length: 7 }, (_, idx) => {
      const i = Math.round((idx / 6) * (humidityData24h.value.length - 1))
      return Number(humidityData24h.value[i] ?? humidityData24h.value[humidityData24h.value.length - 1] ?? 20)
    })
    // 月趋势：以当前湿度为中心的小幅波动（保持脱敏且不“突变”）
    const last = Number(humidityData24h.value[humidityData24h.value.length - 1] ?? 20)
    humidityDataMonth.value = Array.from({ length: 30 }, () => {
      const n = (Math.random() - 0.5) * 2.5
      return Math.max(0, Math.min(100, Number((last + n).toFixed(1))))
    })
  }
}

const refreshWeather = async () => {
  weatherLoading.value = true
  try {
    if (severeWeatherEnabled.value) {
      syncWeatherFromMock()
      return
    }
    // 从API获取当前天气
    const weatherData = await api.getCurrentWeather()
    if (weatherData) {
      weather.value = {
        icon: weatherData.icon || '⛅',
        temp: Math.round(weatherData.temperature),
        description: weatherData.description || '多云',
        location: weatherData.location || DEMO_SCENARIO.weatherLocation,
        windSpeed: weatherData.wind_speed || '3.2m/s',
        humidity: weatherData.humidity || '20%',
        visibility: weatherData.visibility || '15km',
        pressure: weatherData.pressure || '1013hPa'
      }
    }
  } catch (error) {
    console.error('获取天气失败:', error)
    // 使用备用模拟数据
    weather.value.temp = Math.floor(20 + Math.random() * 10)
    weather.value.humidity = Math.floor(18 + Math.random() * 6) + '%'
  } finally {
    weatherLoading.value = false
  }
}

// ===== 空气质量 =====
const airQuality = ref({
  aqi: 45,
  level: '优',
  pollutants: [
    { name: 'PM2.5', value: '23μg/m³' },
    { name: 'PM10', value: '45μg/m³' },
    { name: 'O3', value: '68μg/m³' },
    { name: 'NO2', value: '32μg/m³' }
  ]
})

const parsePercent = (val, fallback = 0) => {
  const num = Number(String(val).replace('%', '').trim())
  return Number.isFinite(num) ? num : fallback
}

const airHumidity = computed(() => {
  return Math.round(Math.max(0, Math.min(100, parsePercent(weather.value.humidity, 20))))
})

const airHumidityLevel = computed(() => {
  const h = airHumidity.value
  if (h >= 70) return '红色告警'
  if (h >= 60) return '橙色告警'
  return '正常'
})

const humidityClass = computed(() => {
  const h = airHumidity.value
  if (h >= 70) return 'aqi-bad'
  if (h >= 60) return 'aqi-moderate'
  return 'aqi-good'
})

const airQualityTimeRange = ref('day')
const hoveredAirQualityPoint = ref(null)

const airQualityTimeLabelsDay = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
const airQualityTimeLabelsWeek = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const currentAirQualityData = computed(() => {
  // 这里展示“空气湿度趋势”，不是污染程度
  return airQualityTimeRange.value === 'week'
    ? humidityDataWeek.value
    : humidityData24h.value
})

const airQualityTimeLabels = computed(() => {
  return airQualityTimeRange.value === 'week'
    ? airQualityTimeLabelsWeek
    : airQualityTimeLabelsDay
})

const airQualityColor = computed(() => {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
  const humidity = clamp(airHumidity.value, 0, 100)

  const hexToRgb = (hex) => {
    const h = String(hex).replace('#', '').trim()
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
    const intVal = parseInt(full, 16)
    return {
      r: (intVal >> 16) & 255,
      g: (intVal >> 8) & 255,
      b: intVal & 255
    }
  }

  const rgbToHex = ({ r, g, b }) => {
    const to2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
    return `#${to2(r)}${to2(g)}${to2(b)}`
  }

  const lerp = (a, b, t) => a + (b - a) * t
  const lerpColor = (a, b, t) => {
    const ca = hexToRgb(a)
    const cb = hexToRgb(b)
    return rgbToHex({
      r: lerp(ca.r, cb.r, t),
      g: lerp(ca.g, cb.g, t),
      b: lerp(ca.b, cb.b, t)
    })
  }

  // <60: 绿；60~70: 橙；>=70: 红（湿度告警）
  if (humidity < 60) return lerpColor('#22ff55', '#33ff33', humidity / 60)
  if (humidity < 70) return lerpColor('#ffcc00', '#ff9900', (humidity - 60) / 10)
  return lerpColor('#ff3333', '#ff3333', 1)
})

const airQualityChartPoints = computed(() => {
  const data = currentAirQualityData.value
  if (!data || data.length === 0) return []
  const count = data.length
  const width = 260
  const height = 50
  const padding = 10
  const min = 0
  const max = 100
  const range = Math.max(1, max - min)

  return data.map((v, i) => ({
    x: padding + (i / (count - 1)) * width,
    y: padding + height - ((v - min) / range) * height
  }))
})

const airQualityLinePoints = computed(() => {
  return airQualityChartPoints.value.map(p => `${p.x},${p.y}`).join(' ')
})

const airQualityAreaPoints = computed(() => {
  const points = airQualityChartPoints.value
  if (points.length === 0) return ''
  const bottom = 60
  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ')
  const firstX = points[0].x
  const lastX = points[points.length - 1].x
  return `${firstX},${bottom} ${linePoints} ${lastX},${bottom}`
})

const onAirQualityTimeChange = () => {
  hoveredAirQualityPoint.value = null
}

// ===== AI 对话 =====
const aiMessages = ref([
  { role: 'assistant', content: '您好！我是铁道监控AI助手，有什么可以帮助您的吗？' }
])
const aiInput = ref('')
const aiThinking = ref(false)
const aiMessagesRef = ref(null)

const sendAiMessage = async () => {
  if (!aiInput.value.trim() || aiThinking.value) return

  const userMessage = aiInput.value.trim()
  aiMessages.value.push({ role: 'user', content: userMessage })
  aiInput.value = ''
  aiThinking.value = true

  await nextTick()
  scrollToBottom()

  try {
    // 模拟AI响应
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))

    let response = '抱歉，我暂时无法回答这个问题。'
    if (userMessage.includes('铁道') || userMessage.includes('铁路')) {
      response = `当前您所在的位置是${currentRailway.value.name}，该线路从${currentRailway.value.start}到${currentRailway.value.end}，全程${currentRailway.value.length}公里。目前线路运行正常，今日已通过${trainStats.value.passed}趟列车。`
    } else if (userMessage.includes('天气')) {
      response = `当前${weather.value.location}天气${weather.value.description}，气温${weather.value.temp}°C，湿度${weather.value.humidity}，风速${weather.value.windSpeed}。整体天气条件良好，适合列车运行。`
    } else if (userMessage.includes('站点') || userMessage.includes('附近')) {
      response = `您附近3公里内有以下站点：${DEMO_SCENARIO.nearbyStations.main}（主站）、${DEMO_SCENARIO.nearbyStations.freight}（货运站）、${DEMO_SCENARIO.nearbyStations.hs}（高铁站）。最近的是${DEMO_SCENARIO.nearbyStations.main}，距离约X公里。`
    } else if (userMessage.includes('你好') || userMessage.includes('您好')) {
      response = '您好！我是铁道监控系统AI助手。我可以帮您查询铁道信息、天气状况、列车运行状态等。请问有什么需要帮助的吗？'
    }

    aiMessages.value.push({ role: 'assistant', content: response })
  } catch (error) {
    aiMessages.value.push({ role: 'assistant', content: '抱歉，发生了错误，请稍后重试。' })
  } finally {
    aiThinking.value = false
    await nextTick()
    scrollToBottom()
  }
}

const quickAsk = (question) => {
  aiInput.value = question
  sendAiMessage()
}

const scrollToBottom = () => {
  if (aiMessagesRef.value) {
    aiMessagesRef.value.scrollTop = aiMessagesRef.value.scrollHeight
  }
}

// ===== 面板控制 =====
const toggleLeftPanel = () => {
  leftPanelVisible.value = !leftPanelVisible.value
}

const toggleRightPanel = () => {
  rightPanelVisible.value = !rightPanelVisible.value
}

const startRainFogSimulation = () => {
  if (!viewer || rainPostProcessStage) return
  // 参考 Cesium 雨效常见实现：全屏后处理雨幕
  rainPostProcessStage = new Cesium.PostProcessStage({
    name: 'railway-rain-effect',
    fragmentShader: `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;

      float hash(float x) {
        return fract(sin(x * 133.3) * 13.13);
      }

      void main(void) {
        float time = czm_frameNumber / 60.0;
        vec2 resolution = czm_viewport.zw;
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        vec3 rainColor = vec3(0.62, 0.72, 0.82);

        float angle = -0.4;
        float si = sin(angle), co = cos(angle);
        uv *= mat2(co, -si, si, co);
        uv *= length(uv + vec2(0.0, 4.9)) * 0.3 + 1.0;

        float v = 1.0 - sin(hash(floor(uv.x * 100.0)) * 2.0);
        float b = clamp(abs(sin(20.0 * time * v + uv.y * (5.0 / (2.0 + v)))) - 0.95, 0.0, 1.0) * 20.0;
        rainColor *= v * b;

        vec4 color = texture(colorTexture, v_textureCoordinates);
        out_FragColor = mix(color, vec4(rainColor, 1.0), 0.35);
      }
    `
  })
  viewer.scene.postProcessStages.add(rainPostProcessStage)

  viewer.scene.fog.enabled = true
  viewer.scene.fog.density = 0.00028
  viewer.scene.fog.minimumBrightness = 0.5
}

const stopRainFogSimulation = () => {
  if (!viewer) return
  if (rainPostProcessStage) {
    viewer.scene.postProcessStages.remove(rainPostProcessStage)
    rainPostProcessStage = null
  }

  viewer.scene.fog.enabled = true
  viewer.scene.fog.density = defaultFogDensity
  viewer.scene.fog.minimumBrightness = 0.65
}

const startBackgroundMusic = () => {
  if (!bgmAudio) {
    bgmAudio = new Audio('/assets/bgm/dl.mp3')
    bgmAudio.preload = 'auto'
    bgmAudio.loop = true
    bgmAudio.volume = 0.8
    bgmAudio.muted = false
  }

  bgmAudio.muted = false
  return bgmAudio.play()
}

const stopBackgroundMusic = () => {
  if (!bgmAudio) return
  bgmAudio.pause()
  bgmAudio.currentTime = 0
}

const installAudioUnlockFallback = () => {
  if (audioUnlockHandler) return

  audioUnlockHandler = async () => {
    if (!severeWeatherEnabled.value) return
    try {
      await startBackgroundMusic()
    } catch (error) {
      console.warn('背景音乐仍未解锁:', error)
      return
    }

    window.removeEventListener('pointerdown', audioUnlockHandler, true)
    audioUnlockHandler = null
  }

  // 某些浏览器会阻止首次播放，下一次用户点击后重试
  window.addEventListener('pointerdown', audioUnlockHandler, true)
}

const toggleSevereWeather = async () => {
  setSevereWeatherEnabled(!severeWeatherEnabled.value)
}

const stopSevereWeatherUiEffects = () => {
  airQualitySevereWarning.value = false
  if (severeWeatherEffectTimer) {
    clearTimeout(severeWeatherEffectTimer)
    severeWeatherEffectTimer = null
  }
  if (severeWeatherHumidityTimer) {
    clearInterval(severeWeatherHumidityTimer)
    severeWeatherHumidityTimer = null
  }
  if (severeWeatherAqiTimer) {
    clearInterval(severeWeatherAqiTimer)
    severeWeatherAqiTimer = null
  }
}

const applySevereWeatherChange = async (enabled) => {
  if (!viewer) return

  stopSevereWeatherUiEffects()

  if (!enabled) {
    stopRainFogSimulation()
    stopBackgroundMusic()
    if (audioUnlockHandler) {
      window.removeEventListener('pointerdown', audioUnlockHandler, true)
      audioUnlockHandler = null
    }
    // 恢复空气质量为正常（避免一直红色）
    airQuality.value = {
      aqi: 45,
      level: '优',
      pollutants: [
        { name: 'PM2.5', value: '23μg/m³' },
        { name: 'PM10', value: '45μg/m³' },
        { name: 'O3', value: '68μg/m³' },
        { name: 'NO2', value: '32μg/m³' }
      ]
    }
    weather.value.humidity = '20%'
    return
  }

  startRainFogSimulation()
  try {
    await startBackgroundMusic()
  } catch (error) {
    console.warn('背景音乐播放失败:', error)
    installAudioUnlockFallback()
  }

  // 启动后 5 秒：空气湿度加速爬升（默认约20%），60%橙色告警，70%红色告警，最终在92~93%徘徊
  severeWeatherEffectTimer = setTimeout(() => {
    let phase = 'to60'
    let current = Math.max(18, Math.min(25, parsePercent(weather.value.humidity, 20)))

    const shown0 = Math.round(current)
    weather.value.humidity = `${shown0}%`
    humidityData24h.value.shift()
    humidityData24h.value.push(shown0)

    severeWeatherHumidityTimer = setInterval(() => {
      if (phase === 'to60') {
        current = Math.min(60, current + 2)
        if (current >= 60) phase = 'to70'
      } else if (phase === 'to70') {
        current = Math.min(70, current + 2)
        if (current >= 70) phase = 'to92'
      } else if (phase === 'to92') {
        current = Math.min(92, current + 3)
        if (current >= 92) phase = 'hover'
      } else {
        current = 92 + Math.random() * 1.2
      }

      const shown = Math.round(current)
      weather.value.humidity = `${shown}%`
      humidityData24h.value.shift()
      humidityData24h.value.push(shown)

      airQualitySevereWarning.value = shown >= 70
    }, 800)
  }, 5000)
}

// ===== Cesium 初始化 =====
const LIUZHOU_STATION = {
  lon: 109.38871,
  lat: 24.30755,
  height: 500
}

// ===== 相机自动巡航（缓慢前行、避免过低视角）=====
// 用日志角度做关键帧，但剔除“过低”（pitch 接近 0）导致贴地的段落，并补齐回到起点的过渡帧形成闭环
const CAMERA_CRUISE_KEYFRAMES = [
  // 以稳定的俯视（-45°）作为起点
  { heading: 0.0, pitch: -45.0 },
  { heading: 358.8, pitch: -40.5 },
  { heading: 357.8, pitch: -17.1 },
  { heading: 351.9, pitch: -10.1 },
  { heading: 350.9, pitch: -8.7 },
  // 过渡回到俯视，保证循环时不会突然“跳”
  { heading: 356.0, pitch: -14.0 },
  { heading: 0.0, pitch: -22.0 },
  { heading: 0.0, pitch: -32.0 },
  { heading: 0.0, pitch: -40.0 },
  { heading: 0.0, pitch: -45.0 }
]
const CAMERA_CRUISE_LOOP_MS = 45000
const CAMERA_CRUISE_MAX_PITCH_DEG = -8.0
const CAMERA_CRUISE_MIN_RANGE_M = 4500
const CAMERA_CRUISE_TARGET_HEIGHT_M = 180
const CAMERA_CRUISE_PATH_EAST_M = 2200
const CAMERA_CRUISE_PATH_NORTH_M = 700

const normalizeDeg360 = (deg) => {
  const v = deg % 360
  return v < 0 ? v + 360 : v
}

const lerp = (a, b, t) => a + (b - a) * t

const lerpAngleDeg = (a, b, t) => {
  const aN = normalizeDeg360(a)
  const bN = normalizeDeg360(b)
  let delta = bN - aN
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return normalizeDeg360(aN + delta * t)
}

const smoothstep = (t) => t * t * (3 - 2 * t)

const sampleCruiseOrientation = (u) => {
  const frames = CAMERA_CRUISE_KEYFRAMES
  const n = frames.length
  if (n === 0) return { heading: 0, pitch: -45 }
  if (n === 1) return frames[0]
  const clamped = Math.max(0, Math.min(1, u))
  const scaled = clamped * (n - 1)
  const idx = Math.min(n - 2, Math.max(0, Math.floor(scaled)))
  const localT = smoothstep(scaled - idx)
  const a = frames[idx]
  const b = frames[idx + 1]
  return {
    heading: lerpAngleDeg(a.heading, b.heading, localT),
    pitch: lerp(a.pitch, b.pitch, localT)
  }
}

const clampCruisePitchDeg = (pitchDeg) => {
  // pitch 为负数（向下），越接近 0 越“贴地”，这里限制最大值，避免太低
  return Math.min(pitchDeg, CAMERA_CRUISE_MAX_PITCH_DEG)
}

const cruiseTargetWithEnuOffset = (east, north, up = 0) => {
  if (!cameraCruiseEnuToFixed || !cameraCruiseBaseCenter) return cameraCruiseBaseCenter
  const local = new Cesium.Cartesian3(east, north, up)
  const out = new Cesium.Cartesian3()
  return Cesium.Matrix4.multiplyByPoint(cameraCruiseEnuToFixed, local, out)
}

const stopCameraCruise = () => {
  if (cameraCruiseRafId) {
    cancelAnimationFrame(cameraCruiseRafId)
    cameraCruiseRafId = null
  }
  cameraCruiseBaseCenter = null
  cameraCruiseEnuToFixed = null
  if (viewer) {
    try {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    } catch {
      // ignore
    }
  }
}

const startCameraCruise = () => {
  if (!viewer) return
  if (cameraCruiseRafId) return

  cameraCruiseBaseCenter = Cesium.Cartesian3.fromDegrees(
    LIUZHOU_STATION.lon,
    LIUZHOU_STATION.lat,
    CAMERA_CRUISE_TARGET_HEIGHT_M
  )
  cameraCruiseEnuToFixed = Cesium.Transforms.eastNorthUpToFixedFrame(cameraCruiseBaseCenter)
  cameraCruiseTarget = cameraCruiseBaseCenter
  cameraCruiseRange = Math.max(
    CAMERA_CRUISE_MIN_RANGE_M,
    Cesium.Cartesian3.distance(viewer.camera.positionWC, cameraCruiseBaseCenter)
  )
  cameraCruiseStartedAt = performance.now()

  const tick = (now) => {
    if (!viewer || !cameraCruiseEnabled.value) {
      stopCameraCruise()
      return
    }

    const elapsed = now - cameraCruiseStartedAt
    const phase = (elapsed % CAMERA_CRUISE_LOOP_MS) / CAMERA_CRUISE_LOOP_MS
    const o0 = sampleCruiseOrientation(phase)
    const o = { heading: o0.heading, pitch: clampCruisePitchDeg(o0.pitch) }

    // 缓慢“向前行进”：让观察点在站点周围沿椭圆轨迹平滑前行（连续闭环，无跳变）
    const theta = phase * Math.PI * 2
    const east = Math.cos(theta) * CAMERA_CRUISE_PATH_EAST_M
    const north = Math.sin(theta) * CAMERA_CRUISE_PATH_NORTH_M
    cameraCruiseTarget = cruiseTargetWithEnuOffset(east, north, 0)

    viewer.camera.lookAt(
      cameraCruiseTarget,
      new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(o.heading),
        Cesium.Math.toRadians(o.pitch),
        cameraCruiseRange
      )
    )
    viewer.scene.requestRender?.()
    cameraCruiseRafId = requestAnimationFrame(tick)
  }

  cameraCruiseRafId = requestAnimationFrame(tick)
}

const toggleCameraCruise = () => {
  cameraCruiseEnabled.value = !cameraCruiseEnabled.value
  if (cameraCruiseEnabled.value) startCameraCruise()
  else stopCameraCruise()
}

const installCameraCruiseAutoPause = () => {
  if (!viewer || cameraCruiseAutoPauseHandler) return
  // 仅当用户“拖动”相机时才暂停（避免单击就把巡航停掉）
  cameraCruiseAutoPauseHandler = (e) => {
    if (!cameraCruiseEnabled.value) return
    if (!e || (e.button !== 0 && e.pointerType !== 'touch')) return

    const startX = e.clientX
    const startY = e.clientY
    let moved = false

    const onMove = (ev) => {
      if (!cameraCruiseEnabled.value) return
      const dx = Math.abs(ev.clientX - startX)
      const dy = Math.abs(ev.clientY - startY)
      if (dx + dy >= 8) moved = true
      if (!moved) return
      cameraCruiseEnabled.value = false
      stopCameraCruise()
      cleanup()
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', cleanup, true)
      window.removeEventListener('pointercancel', cleanup, true)
    }

    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', cleanup, true)
    window.addEventListener('pointercancel', cleanup, true)
  }

  viewer.scene.canvas.addEventListener('pointerdown', cameraCruiseAutoPauseHandler, { passive: true })
}

const setupGlobalBreathingGlow = () => {
  if (!viewer) return
  if (globalBreathStage) {
    viewer.scene.postProcessStages.remove(globalBreathStage)
    globalBreathStage = null
  }

  globalBreathStartTime = Date.now()
  globalBreathStage = new Cesium.PostProcessStage({
    name: 'global-breathing-glow',
    fragmentShader: `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float u_time;
      uniform float u_strength;

      void main() {
        vec4 color = texture(colorTexture, v_textureCoordinates);
        vec2 centered = v_textureCoordinates - vec2(0.5, 0.5);
        float radius = length(centered);
        float radial = smoothstep(0.75, 0.0, radius);
        float breath = 0.55 + 0.45 * sin(u_time * 0.45);
        float lift = radial * breath * u_strength;

        vec3 glow = vec3(0.06, 0.22, 0.36) * lift;
        vec3 boosted = color.rgb + glow;
        boosted = mix(boosted, boosted * (1.0 + 0.08 * lift), 0.8);

        out_FragColor = vec4(boosted, color.a);
      }
    `,
    uniforms: {
      u_time: () => (Date.now() - globalBreathStartTime) * 0.001,
      u_strength: 0.9
    }
  })
  viewer.scene.postProcessStages.add(globalBreathStage)
}

const initCesium = async () => {
  try {
    console.log('正在初始化 Cesium...')

    const viewerOptions = {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      // 保持 3D 地形风格，避免使用工作地图风格底图
      baseLayer: false
    }

    viewer = new Cesium.Viewer('cesiumContainer', viewerOptions)
    if (viewer.cesiumWidget?.creditContainer) {
      viewer.cesiumWidget.creditContainer.style.display = 'none'
    }

    const addBaseLayers = async () => {
      // 恢复为 Cesium Ion 数据源（非国内底图）
      viewer.imageryLayers.removeAll(true)
      let hasSwitchedToOsm = false
      const switchToOsm = () => {
        if (!viewer) return
        if (hasSwitchedToOsm) return
        hasSwitchedToOsm = true
        viewer.imageryLayers.removeAll(true)
        const osm = new Cesium.UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          maximumLevel: 19,
          credit: '© OpenStreetMap contributors'
        })
        viewer.imageryLayers.addImageryProvider(osm)
        console.log('已切换底图：OpenStreetMap')
      }

      const installImageryErrorFallback = (provider, providerName) => {
        const ev = provider?.errorEvent
        if (!ev || typeof ev.addEventListener !== 'function') return

        let errCount = 0
        let windowStartedAt = 0
        ev.addEventListener((e) => {
          const now = Date.now()
          if (!windowStartedAt || now - windowStartedAt > 12000) {
            windowStartedAt = now
            errCount = 0
          }
          errCount += 1
          if (errCount >= 3) {
            console.warn(`${providerName} 瓦片连续加载失败，已自动切换为 OpenStreetMap:`, e)
            switchToOsm()
          }
        })
      }

      try {
        const worldImagery = await Cesium.createWorldImageryAsync({
          style: Cesium.IonWorldImageryStyle.AERIAL
        })
        viewer.imageryLayers.addImageryProvider(worldImagery)
        installImageryErrorFallback(worldImagery, 'Cesium World Imagery')
        console.log('已切换底图：Cesium World Imagery')
      } catch (e) {
        console.warn('Cesium World Imagery 初始化失败，切换为 OpenStreetMap:', e)
        switchToOsm()
      }
    }

    await addBaseLayers()

    try {
      // 地形依赖 Cesium Ion（国外网络可能不稳定），失败则使用椭球体地形（不依赖网络）
      viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
        requestVertexNormals: true,
        requestWaterMask: true
      })
    } catch (error) {
      console.warn('地形加载失败，已切换为默认椭球体地形:', error)
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
    }

    try {
      console.log('正在加载 3D 建筑图层...')
      const osmBuildings = await Cesium.createOsmBuildingsAsync({
        enableShowOutline: false,
        showOutline: false
      })
      viewer.scene.primitives.add(osmBuildings)
      console.log('3D 建筑图层加载完成')
    } catch (error) {
      console.warn('OSM Buildings 加载失败:', error)
    }

    viewer.scene.skyAtmosphere.show = true
    viewer.scene.fog.enabled = true
    viewer.scene.fog.density = defaultFogDensity
    viewer.scene.fog.minimumBrightness = 0.65
    viewer.scene.globe.enableLighting = true
    viewer.terrainExaggeration = 3.0
    viewer.scene.globe.depthTestAgainstTerrain = true
    viewer.scene.globe.alpha = 1.0
    // setupGlobalBreathingGlow() // 暂时去除光晕效果

    installCameraAngleLogger()
    await applySevereWeatherChange(severeWeatherEnabled.value)

    console.log('Cesium 初始化完成！')
    return viewer
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
    throw error
  }
}

const installCameraAngleLogger = () => {
  if (!viewer) return
  if (cameraAngleChangedHandler) {
    viewer.camera.changed.removeEventListener(cameraAngleChangedHandler)
    cameraAngleChangedHandler = null
  }

  let lastLogAt = 0
  let last = { heading: null, pitch: null, roll: null }
  cameraAngleChangedHandler = () => {
    const now = Date.now()
    if (now - lastLogAt < 600) return

    const heading = Cesium.Math.toDegrees(viewer.camera.heading)
    const pitch = Cesium.Math.toDegrees(viewer.camera.pitch)
    const roll = Cesium.Math.toDegrees(viewer.camera.roll)

    const changedEnough =
      last.heading === null ||
      Math.abs(heading - last.heading) > 1 ||
      Math.abs(pitch - last.pitch) > 1 ||
      Math.abs(roll - last.roll) > 1

    if (!changedEnough) return

    lastLogAt = now
    last = { heading, pitch, roll }
    console.log(
      `[相机角度变化] heading=${heading.toFixed(1)}° pitch=${pitch.toFixed(1)}° roll=${roll.toFixed(1)}°`
    )
  }

  viewer.camera.changed.addEventListener(cameraAngleChangedHandler)
}

const flyToLiuZhou = () => {
  if (!viewer) return
  stopCameraCruise()
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      LIUZHOU_STATION.lon,
      LIUZHOU_STATION.lat,
      LIUZHOU_STATION.height
    ),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-45),
      roll: 0.0
    },
    duration: 3.0,
    complete: () => {
      if (cameraCruiseEnabled.value) startCameraCruise()
    }
  })
}

const resetView = () => {
  if (!viewer) return
  stopCameraCruise()
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      LIUZHOU_STATION.lon,
      LIUZHOU_STATION.lat,
      LIUZHOU_STATION.height
    ),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-45),
      roll: 0.0
    },
    duration: 2.0,
    complete: () => {
      if (cameraCruiseEnabled.value) startCameraCruise()
    }
  })
}

const hidePopup = (beaconId) => {
  if (beaconPopups[beaconId]) {
    beaconPopups[beaconId].style.display = 'none'
  }
  selectedBeacon = null
}

const setupInteractions = () => {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

  handler.setInputAction(function(click) {
    const pickedObject = viewer.scene.pick(click.position, 0, 0)

    if (Cesium.defined(pickedObject)) {
      for (let i = 0; i < beaconPoints.length; i++) {
        const beacon = beaconPoints[i]
        // 检查是否点击了光柱相关的任何实体
        const isBeaconEntity =
          pickedObject.id === beacon.cylinder.id ||
          pickedObject.id === beacon.outerCylinder.id ||
          pickedObject.id === beacon.coreCylinder.id ||
          pickedObject.id === beacon.innerCylinder.id ||
          pickedObject.id === beacon.groundPoint.id ||
          pickedObject.id === beacon.groundHalo.id ||
          pickedObject.id === beacon.topBurst.id ||
          beacon.waves.some(w => pickedObject.id === w.main.id || w.trails.some(t => pickedObject.id === t.id))

        if (isBeaconEntity) {
          const popup = beaconPopups[i]
          if (selectedBeacon === i) {
            popup.style.display = 'none'
            selectedBeacon = null
          } else {
            beaconPopups.forEach((p, idx) => {
              if (idx !== i) p.style.display = 'none'
            })
            popup.style.display = 'block'
            selectedBeacon = i
          }
          break
        }
      }
    } else {
      beaconPopups.forEach(p => p.style.display = 'none')
      selectedBeacon = null
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  viewer.scene.postRender.addEventListener(() => {
    updatePositionDisplay()
    updatePopupPositions()
  })
}

const updatePositionDisplay = () => {
  if (!viewer) return
  const cameraPosition = viewer.camera.positionCartographic
  // 脱敏：不展示具体经纬度，仅保留与视图相关的非地点信息
  currentPosition.value.lon = 'X'
  currentPosition.value.lat = 'Y'
  currentPosition.value.altitude = Math.round(cameraPosition.height)
  currentPosition.value.heading = Math.round(Cesium.Math.toDegrees(viewer.camera.heading))

  geoStats.value.terrainExaggeration = viewer?.terrainExaggeration ?? 'X'
  geoStats.value.beaconCount = Array.isArray(beaconPoints) ? beaconPoints.length : 0
  geoStats.value.fogDensity = Number(viewer?.scene?.fog?.density ?? defaultFogDensity).toFixed(5)
  geoStats.value.pitchDeg = Math.round(Cesium.Math.toDegrees(viewer.camera.pitch))
  geoStats.value.rollDeg = Math.round(Cesium.Math.toDegrees(viewer.camera.roll))
}

const updatePopupPositions = () => {
  beaconPoints.forEach((beacon, index) => {
    const popup = beaconPopups[index]
    if (!popup || popup.style.display === 'none') return

    const position = Cesium.Cartesian3.fromDegrees(beacon.lon, beacon.lat, beacon.basePosition.height)
    const windowCoord = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, position)

    if (Cesium.defined(windowCoord)) {
      const x = windowCoord.x - popup.offsetWidth / 2
      const y = windowCoord.y - popup.offsetHeight - 50
      popup.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
    }
  })
}

const createBeaconPoints = () => {
  const nearCount = Math.floor(Math.random() * 3) + 6
  const horizonCount = 5
  const pointCount = nearCount + horizonCount

  for (let i = 0; i < pointCount; i++) {
    const isHorizon = i >= nearCount
    const spread = isHorizon ? 0.35 : 0.1
    const lon = LIUZHOU_STATION.lon + (Math.random() - 0.5) * spread
    const lat = LIUZHOU_STATION.lat + (Math.random() - 0.5) * spread
    const pillarHeight = isHorizon ? 2200 + Math.random() * 1000 : 1400 + Math.random() * 700
    const radiusScale = isHorizon ? 1.35 : 1
    const waveCount = isHorizon ? 3 : 4
    const maxWaveRadius = isHorizon ? 2200 : 1300
    const waveAlpha = isHorizon ? 0.32 : 0.45
    const wavePhases = Array.from({ length: waveCount }, (_, idx) => idx / waveCount)

    const eventTypes = ['设备正常', '温度异常', '维护中', '离线', '电压异常']
    const eventMessages = [
      '信号灯运行正常',
      '温度超过阈值',
      '设备正在维护',
      '设备离线',
      '电压异常'
    ]
    const randomEventIndex = Math.floor(Math.random() * eventTypes.length)
    const eventType = eventTypes[randomEventIndex]
    const eventMessage = eventMessages[randomEventIndex]

    const groundPosition = Cesium.Cartesian3.fromDegrees(lon, lat, 0)
    const basePosition = Cesium.Cartesian3.fromDegrees(lon, lat, pillarHeight / 2)
    const topPosition = Cesium.Cartesian3.fromDegrees(lon, lat, pillarHeight)

    const pillarAlphaBase = isHorizon ? 0.42 : 0.55
    const outerAlphaBase = isHorizon ? 0.18 : 0.24
    const coreAlphaBase = isHorizon ? 0.68 : 0.82
    const innerAlphaBase = isHorizon ? 0.78 : 0.9

    // 主光柱
    const cylinder = viewer.entities.add({
      position: basePosition,
      cylinder: {
        length: pillarHeight,
        topRadius: 26 * radiusScale,
        bottomRadius: 14 * radiusScale,
        material: Cesium.Color.fromCssColorString('#37d7ff').withAlpha(pillarAlphaBase),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.35),
        outlineWidth: 2
      }
    })

    // 外层体积光
    const outerCylinder = viewer.entities.add({
      position: basePosition,
      cylinder: {
        length: pillarHeight * 1.05,
        topRadius: 52 * radiusScale,
        bottomRadius: 36 * radiusScale,
        material: Cesium.Color.fromCssColorString('#1c8bff').withAlpha(outerAlphaBase),
        outline: false
      }
    })

    // 核心高亮光柱
    const coreCylinder = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, pillarHeight * 0.52),
      cylinder: {
        length: pillarHeight * 1.04,
        topRadius: 8 * radiusScale,
        bottomRadius: 4 * radiusScale,
        material: Cesium.Color.fromCssColorString('#8bffff').withAlpha(coreAlphaBase),
        outline: false
      }
    })

    // 内层亮芯
    const innerCylinder = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, pillarHeight * 0.45),
      cylinder: {
        length: pillarHeight * 0.92,
        topRadius: 5 * radiusScale,
        bottomRadius: 2 * radiusScale,
        material: Cesium.Color.fromCssColorString('#00ffff').withAlpha(innerAlphaBase),
        outline: false
      }
    })

    // 地面核心发光点
    const groundPoint = viewer.entities.add({
      position: groundPosition,
      point: {
        pixelSize: isHorizon ? 24 : 34,
        color: Cesium.Color.fromCssColorString('#00d4ff').withAlpha(0.9),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        scaleByDistance: new Cesium.NearFarScalar(500, 2, 5000, 1)
      }
    })

    // 地面常驻光晕
    const groundHalo = viewer.entities.add({
      position: groundPosition,
      ellipse: {
        semiMinorAxis: isHorizon ? 180 : 120,
        semiMajorAxis: isHorizon ? 180 : 120,
        height: 0,
        material: Cesium.Color.fromCssColorString('#00b7ff').withAlpha(isHorizon ? 0.18 : 0.25),
        outline: false
      }
    })

    // 顶部爆光层
    const topBurst = viewer.entities.add({
      position: topPosition,
      ellipse: {
        semiMinorAxis: isHorizon ? 95 : 70,
        semiMajorAxis: isHorizon ? 95 : 70,
        height: pillarHeight,
        material: Cesium.Color.fromCssColorString('#a7ffff').withAlpha(isHorizon ? 0.28 : 0.35),
        outline: false
      }
    })

    // 地表扩散冲击波
    const waves = []

    for (let w = 0; w < waveCount; w++) {
      const mainWave = viewer.entities.add({
        position: groundPosition,
        ellipse: {
          semiMinorAxis: 30 + w * 120,
          semiMajorAxis: 30 + w * 120,
          height: 0,
          material: Cesium.Color.fromCssColorString('#00d4ff').withAlpha(waveAlpha - w * 0.15),
          outline: true,
          outlineColor: Cesium.Color.CYAN.withAlpha(0.75 - w * 0.15),
          outlineWidth: 3
        }
      })
      const trails = Array.from({ length: 2 }, (_, trailIndex) => viewer.entities.add({
        position: groundPosition,
        ellipse: {
          semiMinorAxis: 30 + w * 120,
          semiMajorAxis: 30 + w * 120,
          height: 0,
          material: Cesium.Color.fromCssColorString('#00d4ff').withAlpha(0.0),
          outline: true,
          outlineColor: Cesium.Color.CYAN.withAlpha(0.0),
          outlineWidth: 2 - trailIndex * 0.5
        }
      }))

      waves.push({
        main: mainWave,
        trails
      })
    }

    beaconPoints.push({
      cylinder,
      outerCylinder,
      coreCylinder,
      innerCylinder,
      pillarAlphaBase,
      outerAlphaBase,
      coreAlphaBase,
      innerAlphaBase,
      groundPoint,
      groundHalo,
      topBurst,
      waves,
      basePosition: { lon, lat, height: pillarHeight },
      maxRadius: maxWaveRadius,
      waveSpeed: 0.18 + Math.random() * 0.1,
      waveAlpha,
      waveStartTime: Date.now() + i * 600,
      wavePhases,
      id: i, lon, lat,
      eventType, eventMessage
    })

    const popupDiv = document.createElement('div')
    popupDiv.className = 'beacon-popup'
    popupDiv.innerHTML = `
      <div class="popup-content">
        <div class="popup-title">🚨 信号灯 ${i + 1} - ${eventType}</div>
        <div class="popup-message">${eventMessage}</div>
        <div class="popup-coord">📍 ${lon.toFixed(4)}, ${lat.toFixed(4)}</div>
        <div class="popup-close" onclick="event.stopPropagation(); window.vueHidePopup(${i})">✕</div>
      </div>
    `
    popupDiv.style.cssText = 'position:absolute;left:0;top:0;display:none;z-index:1000;pointer-events:auto;'
    viewer.container.appendChild(popupDiv)
    beaconPopups.push(popupDiv)
  }

  const style = document.createElement('style')
  style.textContent = `
    .beacon-popup { background:rgba(0,20,40,0.95);border:2px solid rgba(0,200,255,0.6);border-radius:8px;padding:15px;min-width:200px;backdrop-filter:blur(10px); }
    .popup-content { color:#fff;font-size:13px; }
    .popup-title { color:#00d4ff;font-weight:bold;margin-bottom:8px; }
    .popup-close { position:absolute;top:5px;right:8px;cursor:pointer;color:#ff6666; }
  `
  document.head.appendChild(style)
}

const updateWaveAnimation = () => {
  const currentTime = Date.now()

  beaconPoints.forEach((beacon) => {
    if (currentTime < beacon.waveStartTime) return

    const baseTime = (currentTime - beacon.waveStartTime) * 0.001

    beacon.waves.forEach((waveLayer, wIndex) => {
      const phase = beacon.wavePhases[wIndex] || 0
      const progress = ((baseTime * beacon.waveSpeed) + phase) % 1.0
      const minRadius = 40
      const currentRadius = minRadius + progress * (beacon.maxRadius - minRadius)

      waveLayer.main.ellipse.semiMinorAxis = currentRadius
      waveLayer.main.ellipse.semiMajorAxis = currentRadius

      const alpha = beacon.waveAlpha * (1 - progress * 0.92)
      waveLayer.main.ellipse.material = Cesium.Color.fromCssColorString('#00d4ff').withAlpha(alpha)

      const outlineAlpha = 0.75 * (1 - progress * 0.86)
      waveLayer.main.ellipse.outlineColor = Cesium.Color.CYAN.withAlpha(outlineAlpha)

      waveLayer.trails.forEach((trailWave, trailIndex) => {
        const trailOffset = (trailIndex + 1) * 0.11
        const trailProgress = progress - trailOffset
        if (trailProgress <= 0) {
          trailWave.ellipse.material = Cesium.Color.fromCssColorString('#00d4ff').withAlpha(0.0)
          trailWave.ellipse.outlineColor = Cesium.Color.CYAN.withAlpha(0.0)
          return
        }

        const trailRadius = minRadius + trailProgress * (beacon.maxRadius - minRadius)
        trailWave.ellipse.semiMinorAxis = trailRadius
        trailWave.ellipse.semiMajorAxis = trailRadius
        const trailAlpha = beacon.waveAlpha * 0.55 * (1 - trailProgress * 0.92) * (1 - trailIndex * 0.22)
        trailWave.ellipse.material = Cesium.Color.fromCssColorString('#00d4ff').withAlpha(Math.max(0, trailAlpha))
        trailWave.ellipse.outlineColor = Cesium.Color.CYAN.withAlpha(Math.max(0, trailAlpha * 0.9))
      })
    })

    const pulseTime = currentTime * 0.0022
    const pulseA = 0.5 + 0.5 * Math.sin(pulseTime + beacon.id * 0.7)
    const pulseB = 0.5 + 0.5 * Math.sin(pulseTime * 1.35 + beacon.id * 1.1)

    const groundPulseSize = 26 + pulseA * 16
    beacon.groundPoint.point.pixelSize = groundPulseSize

    beacon.cylinder.cylinder.material = Cesium.Color.fromCssColorString('#37d7ff')
      .withAlpha(beacon.pillarAlphaBase * (0.8 + pulseA * 0.3))
    beacon.outerCylinder.cylinder.material = Cesium.Color.fromCssColorString('#1c8bff')
      .withAlpha(beacon.outerAlphaBase * (0.7 + pulseB * 0.35))
    beacon.coreCylinder.cylinder.material = Cesium.Color.fromCssColorString('#9effff')
      .withAlpha(beacon.coreAlphaBase * (0.82 + pulseA * 0.25))
    beacon.innerCylinder.cylinder.material = Cesium.Color.fromCssColorString('#00ffff')
      .withAlpha(beacon.innerAlphaBase * (0.85 + pulseB * 0.2))

    const haloSize = 90 + pulseA * 120
    beacon.groundHalo.ellipse.semiMajorAxis = haloSize
    beacon.groundHalo.ellipse.semiMinorAxis = haloSize
    beacon.groundHalo.ellipse.material = Cesium.Color.fromCssColorString('#00b7ff')
      .withAlpha(0.14 + pulseB * 0.18)

    const burstSize = 56 + pulseB * 55
    beacon.topBurst.ellipse.semiMajorAxis = burstSize
    beacon.topBurst.ellipse.semiMinorAxis = burstSize
    beacon.topBurst.ellipse.material = Cesium.Color.fromCssColorString('#b9ffff')
      .withAlpha(0.2 + pulseA * 0.26)
  })
}

// 数据更新定时器
const updateData = () => {
  // 保持地理震动总体良好且波动平稳
  const target = 2.2 + (Math.random() - 0.5) * 0.08
  const smoothed = seismicLevel.value * 0.86 + target * 0.14
  seismicLevel.value = Math.max(1.8, Math.min(3.0, Number(smoothed.toFixed(2))))
  // 更新24小时数据
  seismicData24h.value.shift()
  seismicData24h.value.push(seismicLevel.value)

  // 模拟列车数据更新
  if (Math.random() > 0.95 && trainStats.value.passed < trainStats.value.total) {
    trainStats.value.passed++
  }

  // 恶劣天气：同步湿度趋势（与大数据平台保持一致）
  if (severeWeatherEnabled.value) {
    syncWeatherFromMock()
  }
}

// 从API加载仪表盘数据
const loadDashboardData = async () => {
  try {
    const data = await api.getDashboard()
    if (data) {
      // 更新天气数据
      if (data.weather) {
        weather.value = {
          icon: data.weather.icon || '⛅',
          temp: Math.round(data.weather.temperature),
          description: data.weather.description || '多云',
          location: data.weather.location || DEMO_SCENARIO.weatherLocation,
          windSpeed: data.weather.wind_speed || '3.2m/s',
          humidity: data.weather.humidity || '20%',
          visibility: data.weather.visibility || '15km',
          pressure: data.weather.pressure || '1013hPa'
        }
      }

      // 更新空气质量
      if (data.airQuality) {
        airQuality.value = {
          aqi: data.airQuality.aqi || 45,
          level: data.airQuality.level || '优',
          pollutants: [
            { name: 'PM2.5', value: `${data.airQuality.pm25 || 23}μg/m³` },
            { name: 'PM10', value: `${data.airQuality.pm10 || 45}μg/m³` },
            { name: 'O3', value: `${data.airQuality.o3 || 68}μg/m³` },
            { name: 'NO2', value: `${data.airQuality.no2 || 32}μg/m³` }
          ]
        }
      }

      // 更新列车统计
      if (data.trainStats) {
        trainStats.value = {
          passed: data.trainStats.passed_count || 42,
          total: data.trainStats.total_count || 58,
          onTime: 100,
          nextTrain: data.trainStats.next_train || 'G1502 14:35'
        }
      }

      // 更新铁道信息
      if (data.railway) {
        currentRailway.value = {
          name: data.railway.name || DEMO_SCENARIO.railwayName,
          start: DEMO_SCENARIO.stationStart,
          end: DEMO_SCENARIO.stationEnd,
          length: data.railway.length_km || '255'
        }
      }

      // 更新地震数据
      if (data.seismic && data.seismic.length > 0) {
        const latestSeismic = data.seismic[data.seismic.length - 1]
        const normalized = Math.max(1.8, Math.min(3.0, Number(latestSeismic.level) || 2.2))
        seismicLevel.value = Number((seismicLevel.value * 0.7 + normalized * 0.3).toFixed(2))
      }
    }
  } catch (error) {
    console.error('加载仪表盘数据失败:', error)
  }
}

// 从API加载地震历史数据
const loadSeismicData = async (range = '24h') => {
  try {
    const data = await api.getSeismicData(range)
    if (data && data.length > 0) {
      const values = data.map((d) => Math.max(1.7, Math.min(3.2, Number(d.level) || 2.2)))
      if (range === '24h') {
        seismicData24h.value = values.slice(-24)
      } else if (range === 'week') {
        seismicDataWeek.value = values.slice(-7)
      } else if (range === 'month') {
        seismicDataMonth.value = values.slice(-30)
      }
    }
  } catch (error) {
    console.error('加载地震数据失败:', error)
  }
}

// 从API加载天气历史数据
const loadWeatherHistory = async (range = '24h') => {
  try {
    const data = await api.getWeatherData(range)
    if (data && data.length > 0) {
      const temps = data.map(d => Math.round(d.temperature))
      if (range === '24h') {
        weatherData24h.value = temps.slice(-24)
      } else if (range === 'week') {
        weatherDataWeek.value = temps.slice(-7)
      } else if (range === 'month') {
        weatherDataMonth.value = temps.slice(-30)
      }
    }
  } catch (error) {
    console.error('加载天气历史数据失败:', error)
  }
}

onMounted(async () => {
  try {
    // 从API加载数据
    await loadDashboardData()
    await loadSeismicData('24h')
    await loadWeatherHistory('24h')

    await initCesium()
    installCameraCruiseAutoPause()
    setTimeout(() => flyToLiuZhou(), 500)
    setupInteractions()
    updateDataTimer = setInterval(updateData, 2000)
  } catch (error) {
    console.error('初始化失败:', error)
  }
  window.vueHidePopup = hidePopup
})

onBeforeUnmount(() => {
  if (updateDataTimer) {
    clearInterval(updateDataTimer)
    updateDataTimer = null
  }
  stopRainFogSimulation()
  if (bgmAudio) {
    bgmAudio.pause()
    bgmAudio.currentTime = 0
    bgmAudio = null
  }
  if (audioUnlockHandler) {
    window.removeEventListener('pointerdown', audioUnlockHandler, true)
    audioUnlockHandler = null
  }
  if (viewer && globalBreathStage) {
    viewer.scene.postProcessStages.remove(globalBreathStage)
    globalBreathStage = null
  }
  stopSevereWeatherUiEffects()
  stopCameraCruise()
  if (viewer && cameraCruiseAutoPauseHandler) {
    viewer.scene.canvas.removeEventListener('pointerdown', cameraCruiseAutoPauseHandler)
    cameraCruiseAutoPauseHandler = null
  }
  if (viewer && cameraAngleChangedHandler) {
    viewer.camera.changed.removeEventListener(cameraAngleChangedHandler)
    cameraAngleChangedHandler = null
  }
  if (viewer) viewer.destroy()
})

watch(severeWeatherEnabled, (enabled) => {
  // 允许从其它页面切换恶劣天气模拟后，同步到 Cesium 视图
  applySevereWeatherChange(enabled)
  if (enabled) {
    syncWeatherFromMock()
  }
})
</script>

<style scoped>
.cesium-view {
  width: 100%;
  height: 100%;
  position: relative;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
}

/* 控制按钮 */
.control-buttons {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  z-index: 100;
}

.reset-btn, .toggle-btn {
  padding: 7px 12px;
  background: rgba(0, 20, 40, 0.85);
  border: 2px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  color: #00d4ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
}

.reset-btn:hover, .toggle-btn:hover {
  background: rgba(0, 40, 80, 0.9);
  box-shadow: 0 0 15px rgba(0, 200, 255, 0.5);
}

.toggle-btn.active {
  border-color: rgba(120, 190, 255, 0.9);
  color: #d8e8ff;
  background: rgba(25, 70, 120, 0.9);
  box-shadow: 0 0 20px rgba(110, 180, 255, 0.45);
}

:deep(.cesium-viewer-toolbar),
:deep(.cesium-viewer-fullscreenContainer),
:deep(.cesium-viewer-animationContainer),
:deep(.cesium-viewer-timelineContainer),
:deep(.cesium-viewer-bottom) {
  display: none !important;
}

/* 侧边面板 */
.side-panel {
  position: absolute;
  top: 56px;
  width: 340px;
  max-height: calc(100% - 66px);
  overflow-y: auto;
  z-index: 50;
}

.left-panel { left: 15px; }
.right-panel { right: 15px; }

.side-panel::-webkit-scrollbar { width: 4px; }
.side-panel::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
.side-panel::-webkit-scrollbar-thumb { background: rgba(0,200,255,0.4); border-radius: 2px; }

/* 历史记录头部 */
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.time-select {
  background: rgba(0, 100, 150, 0.3);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 4px;
  color: #00d4ff;
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  outline: none;
}

.time-select:hover {
  background: rgba(0, 100, 150, 0.5);
}

.time-select option {
  background: rgba(0, 20, 40, 0.95);
  color: #fff;
}

/* 图表提示 */
.chart-tooltip {
  position: relative;
  display: inline-block;
  background: rgba(0, 40, 80, 0.95);
  border: 1px solid rgba(0, 200, 255, 0.5);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: #fff;
  margin-top: 4px;
}

.vibration-history {
  margin-top: 10px;
  position: relative;
}

.history-svg {
  width: 100%;
  height: 60px;
  cursor: crosshair;
}

/* 面板卡片 */
.panel-card {
  background: rgba(0, 20, 40, 0.85);
  border: 1px solid rgba(0, 200, 255, 0.25);
  border-radius: 10px;
  margin-bottom: 12px;
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.panel-header {
  padding: 12px 15px;
  border-bottom: 1px solid rgba(0, 200, 255, 0.2);
  background: rgba(0, 200, 255, 0.08);
}

.panel-title {
  font-size: 14px;
  font-weight: bold;
  color: #fff;
}

.panel-subtitle {
  font-size: 10px;
  color: #666;
  letter-spacing: 0.5px;
}

.panel-content {
  padding: 15px;
}

/* 震动监测 */
.seismic-display {
  display: flex;
  gap: 15px;
  margin-bottom: 12px;
}

.seismic-gauge { flex: 1; }
.gauge-svg { width: 100%; height: auto; }

.seismic-info { flex: 1; }
.seismic-value { margin-bottom: 8px; }
.value-label { font-size: 11px; color: #888; display: block; }
.value-num { font-size: 28px; font-weight: bold; }

.seismic-status {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.status-normal { background: rgba(0,200,255,0.2); color: #00d4ff; }
.status-warning { background: rgba(255,200,0,0.2); color: #ffcc00; }
.status-danger { background: rgba(255,50,50,0.2); color: #ff3333; }

.vibration-history { margin-top: 10px; }
.history-label { font-size: 11px; color: #888; display: block; margin-bottom: 5px; }
.history-svg { width: 100%; height: 50px; }

/* 位置信息 */
.position-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.pos-item {
  background: rgba(0, 200, 255, 0.08);
  padding: 10px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pos-icon { font-size: 18px; margin-bottom: 4px; }
.pos-label { font-size: 11px; color: #888; }
.pos-value { font-size: 14px; color: #00d4ff; font-weight: bold; margin-top: 2px; }

/* 铁道信息 */
.railway-name {
  background: rgba(0, 200, 255, 0.1);
  padding: 12px;
  border-radius: 6px;
  text-align: center;
  margin-bottom: 12px;
}

.rail-label { font-size: 11px; color: #888; display: block; }
.rail-value { font-size: 18px; color: #00d4ff; font-weight: bold; margin-top: 4px; }

.railway-detail { display: flex; flex-direction: column; gap: 8px; }
.detail-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.detail-label { color: #888; font-size: 12px; }
.detail-val { color: #fff; font-size: 12px; }

/* 列车统计 */
.train-stats {
  display: flex;
  gap: 20px;
  align-items: center;
}

.stat-circle {
  position: relative;
  width: 80px;
  height: 80px;
}

.stat-circle svg { width: 100%; height: 100%; }
.stat-circle .stat-num {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 20px;
  font-weight: bold;
  color: #00d4ff;
}
.stat-circle .stat-label {
  position: absolute;
  bottom: -9px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #888;
}

.stat-details { flex: 1; }
.stat-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
.stat-row .stat-label { color: #888; }
.stat-row .stat-val { color: #fff; }
.stat-row .stat-val.green { color: #33ff33; }

/* 天气紧凑布局 */
.weather-compact {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.weather-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.weather-icon-small {
  font-size: 36px;
}

.weather-info-compact {
  flex: 1;
}

.weather-temp-compact {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.temp-value-small {
  font-size: 28px;
  font-weight: bold;
  color: #fff;
}

.temp-unit-small {
  font-size: 14px;
  color: #888;
}

.weather-desc-small {
  font-size: 12px;
  color: #00d4ff;
}

.weather-location-small {
  font-size: 10px;
  color: #888;
  margin-top: 2px;
}

.weather-right {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  flex: 1;
}

.w-item-compact {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(255,255,255,0.03);
  border-radius: 4px;
}

.w-icon-small {
  font-size: 14px;
}

.w-info {
  display: flex;
  flex-direction: column;
}

.w-label-small {
  font-size: 9px;
  color: #888;
}

.w-value-small {
  font-size: 11px;
  color: #fff;
}

/* 天气曲线图区域 */
.weather-chart-section {
  margin-top: 10px;
}

.weather-tooltip {
  background: rgba(80, 40, 0, 0.95);
  border-color: rgba(255, 153, 0, 0.5);
}

/* 天气 - 保留原样式用于其他地方 */
.weather-main {
  text-align: center;
  padding: 15px;
  background: rgba(0, 200, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 12px;
}

.weather-icon { font-size: 48px; }
.weather-temp { margin: 8px 0; }
.temp-value { font-size: 36px; font-weight: bold; color: #fff; }
.temp-unit { font-size: 16px; color: #888; }
.weather-desc { font-size: 14px; color: #00d4ff; }
.weather-location { font-size: 12px; color: #888; margin-top: 4px; }

.weather-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.w-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
}

.w-icon { font-size: 16px; }
.w-label { flex: 1; font-size: 11px; color: #888; }
.w-value { font-size: 12px; color: #fff; }

.refresh-btn {
  width: 100%;
  margin-top: 12px;
  padding: 8px;
  background: rgba(0, 200, 255, 0.15);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 6px;
  color: #00d4ff;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s;
}

.refresh-btn:hover:not(:disabled) { background: rgba(0, 200, 255, 0.25); }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 空气质量 */
.aqi-severe-warning {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 60, 60, 0.85);
  background: linear-gradient(135deg, rgba(180, 20, 20, 0.85), rgba(110, 10, 10, 0.75));
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
  box-shadow: 0 0 18px rgba(255, 40, 40, 0.55);
  animation: aqiWarningPulse 0.95s ease-in-out infinite;
}

@keyframes aqiWarningPulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.22); }
}

.aqi-card.aqi-flash {
  animation: aqiCardFlash 0.85s ease-in-out infinite;
}

@keyframes aqiCardFlash {
  0%, 100% {
    box-shadow: 0 0 0 rgba(255, 40, 40, 0);
    border-color: rgba(255, 80, 80, 0.55);
  }
  50% {
    box-shadow: 0 0 26px rgba(255, 50, 50, 0.55);
    border-color: rgba(255, 60, 60, 0.95);
  }
}

.aqi-summary {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  padding: 4px 0 8px;
}
.aqi-unit { font-size: 11px; color: #888; }
.aqi-display { text-align: center; padding: 8px 0; }
.aqi-value { font-size: 32px; font-weight: bold; }
.aqi-value.aqi-good { color: #33ff33; }
.aqi-value.aqi-moderate { color: #ffcc00; }
.aqi-value.aqi-bad { color: #ff3333; }
.aqi-level { font-size: 14px; color: #888; margin-top: 4px; }

.aqi-bar {
  height: 8px;
  background: linear-gradient(90deg, #33ff33, #ffcc00, #ff9933, #ff3333);
  border-radius: 4px;
  margin: 10px 0;
  position: relative;
}

.aqi-indicator {
  position: absolute;
  top: -3px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  transform: translateX(-50%);
  box-shadow: 0 0 5px rgba(0,0,0,0.3);
}

.aqi-items { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.aqi-item { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; }
.item-name { color: #888; }
.item-value { color: #fff; }

.aqi-chart { height: 70px; }
.aqi-tooltip { background: rgba(0, 40, 80, 0.95); border-color: rgba(0, 200, 255, 0.5); }

/* AI 面板 */
.ai-panel .panel-content { padding: 12px; }

.ai-messages {
  height: 200px;
  overflow-y: auto;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
}

.ai-messages::-webkit-scrollbar { width: 4px; }
.ai-messages::-webkit-scrollbar-thumb { background: rgba(0,200,255,0.3); border-radius: 2px; }

.ai-msg {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.ai-msg.user { flex-direction: row-reverse; }

.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0,200,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.ai-msg.user .msg-avatar { background: rgba(255,200,0,0.2); }

.msg-content {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.5;
  background: rgba(0, 200, 255, 0.15);
  color: #fff;
}

.ai-msg.user .msg-content { background: rgba(255, 200, 0, 0.15); }

.ai-msg.thinking .msg-content { opacity: 0.6; }

.ai-input {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.ai-input-field {
  flex: 1;
  padding: 10px 12px;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  outline: none;
}

.ai-input-field:focus { border-color: #00d4ff; }
.ai-input-field::placeholder { color: #666; }

.ai-send-btn {
  padding: 10px 16px;
  background: rgba(0, 200, 255, 0.2);
  border: 1px solid rgba(0, 200, 255, 0.4);
  border-radius: 6px;
  color: #00d4ff;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s;
}

.ai-send-btn:hover:not(:disabled) { background: rgba(0, 200, 255, 0.3); }
.ai-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ai-quick-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.quick-btn {
  padding: 6px 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  color: #aaa;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.3s;
}

.quick-btn:hover {
  background: rgba(0, 200, 255, 0.15);
  border-color: rgba(0, 200, 255, 0.3);
  color: #00d4ff;
}

/* 过渡动画 */
.slide-left-enter-active, .slide-left-leave-active,
.slide-right-enter-active, .slide-right-leave-active {
  transition: all 0.3s ease;
}

.slide-left-enter-from, .slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-enter-from, .slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* 加载动画 */
.loading {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loading-content { text-align: center; }

.loading-spinner {
  width: 60px; height: 60px;
  border: 4px solid rgba(0, 200, 255, 0.3);
  border-top-color: #00d4ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-text { color: #00d4ff; font-size: 18px; }

</style>
