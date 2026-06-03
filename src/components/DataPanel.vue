<template>
  <div class="data-panel-container">
    <!-- 背景粒子效果 -->
    <div class="particles-bg">
      <div
        v-for="i in 50"
        :key="i"
        class="particle"
        :style="particleStyle(i)"
      ></div>
    </div>

    <!-- 网格背景 -->
    <div class="grid-bg"></div>

    <!-- 头部标题 -->
    <header class="panel-header">
      <div class="header-left">
        <div class="logo">
          <span class="logo-icon">🚄</span>
          <span class="logo-text">铁路信号机数字孪生监测与可视化分析平台V1.0</span>
        </div>
      </div>
      <div class="header-center">
        <h1 class="main-title">
          <span class="title-decorator">『</span>
          大数据可视化分析平台
          <span class="title-decorator">』</span>
        </h1>
        <div class="sub-title">RAILWAY SIGNAL INTELLIGENT MONITORING PLATFORM</div>
      </div>
      <div class="header-right">
        <div class="datetime">
          <div class="date">{{ currentDate }}</div>
          <div class="time">{{ currentTime }}</div>
        </div>
        <div class="weather-mini">
          <span class="weather-icon">🌤</span>
          <span class="weather-temp">{{ weather.temperature }}°C</span>
        </div>
        <button class="severe-weather-btn" :class="{ active: severeWeatherEnabled }" @click="toggleSevereWeather">
          {{ severeWeatherEnabled ? '⛈️ 停止恶劣天气' : '⛈️ 恶劣天气模拟' }}
        </button>
        <div class="anomaly-controls">
          <button class="anomaly-btn clear-btn" :disabled="!humidityAnomaly" @click="clearHumidityAnomaly">
            异常消除
          </button>
        </div>
      </div>
    </header>

    <div class="global-alerts">
      <transition name="alert-pop">
        <div v-if="showHumidityAlert" class="global-alert humidity" :class="humidityAlertClass">
          <div class="alert-title">{{ humidityAlertPayload.title }}</div>
          <div class="alert-desc">
            <div class="alert-target">{{ heroDeviceName }}</div>
            <div class="alert-hint">
              <div class="alert-line">告警内容：{{ humidityAlertPayload.content }}</div>
              <div class="alert-line">关联分析：{{ humidityAlertPayload.analysis }}</div>
              <div class="alert-line">建议处置：{{ humidityAlertPayload.suggestion }}</div>
            </div>
          </div>
          <div class="alert-chart">
            <div class="chart-caption">24小时湿度变化曲线</div>
            <svg viewBox="0 0 560 150" class="alert-chart-svg">
              <defs>
                <linearGradient id="humidityAlertGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#ff2f2f;stop-opacity:0.38" />
                  <stop offset="100%" style="stop-color:#ff2f2f;stop-opacity:0" />
                </linearGradient>
              </defs>
              <line x1="10" y1="30" x2="550" y2="30" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
              <line x1="10" y1="70" x2="550" y2="70" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
              <line x1="10" y1="110" x2="550" y2="110" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
              <polygon :points="humidityAlertAreaPoints" fill="url(#humidityAlertGradient)" />
              <polyline :points="humidityAlertLinePoints" fill="none" stroke="#ff2f2f" stroke-width="3" />
              <g v-for="(p, idx) in humidityAlertLabelPoints" :key="idx">
                <circle :cx="p.x" :cy="p.y" r="3.2" fill="#ffb0b0" />
                <text :x="p.x" :y="p.y - 8" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">
                  {{ p.value }}
                </text>
              </g>
            </svg>
          </div>
          <div class="alert-actions">
            <button class="alert-handle" :disabled="humidityAlertProcessing" @click="markHumidityAlertProcessing">
              {{ humidityAlertProcessing ? '处理中…' : '处理中' }}
            </button>
            <button class="alert-close" @click="dismissHumidityAlert">关闭弹框</button>
          </div>
        </div>
      </transition>

      <transition name="alert-pop">
        <div v-if="showHumidityObservation" class="global-alert observe">
          <div class="observe-left">
            <div class="observe-title">观察中</div>
            <div class="observe-desc">
              {{ heroDeviceName }}：盒内湿度回落中（当前 {{ currentHumidityText }}）
            </div>
          </div>
          <button class="observe-close" @click="dismissHumidityObservation">关闭</button>
        </div>
      </transition>
    </div>

    <!-- 主内容区 -->
    <main class="panel-main">
      <!-- 左侧面板 -->
      <aside class="left-aside">
        <LeftPanel
          :humidity-anomaly="humidityAnomaly"
          :temperature-anomaly="false"
        />
      </aside>

      <!-- 中间面板 -->
      <section class="center-section">
        <CenterPanel />
      </section>

      <!-- 右侧面板 -->
      <aside class="right-aside">
        <RightPanel />
      </aside>
    </main>

    <!-- 底部状态栏 -->
    <footer class="panel-footer">
      <div class="footer-left">
        <span class="status-item">
          <span class="status-dot online"></span>
          系统状态: 正常
        </span>
        <span class="status-item">
          <span class="status-dot online"></span>
          数据同步: 实时
        </span>
        <span class="status-item">
          数据点: {{ formatNumber(dataPoints) }}
        </span>
      </div>
      <div class="footer-center">
        <span class="version">v2.0.0</span>
        <span class="copyright">© 2024 铁路信号机数字孪生监测与可视化分析平台V1.0</span>
      </div>
      <div class="footer-right">
        <span class="update-time">数据更新: {{ lastUpdate }}</span>
        <span class="fps">FPS: {{ fps }}</span>
      </div>
    </footer>

    <!-- 装饰线条 -->
    <div class="decorations">
      <div class="corner corner-tl"></div>
      <div class="corner corner-tr"></div>
      <div class="corner corner-bl"></div>
      <div class="corner corner-br"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import LeftPanel from './datapanel/LeftPanel.vue'
import CenterPanel from './datapanel/CenterPanel.vue'
import RightPanel from './datapanel/RightPanel.vue'
import { getWeatherData, getOverviewData } from '../services/mockDataService'
import {
  severeWeatherEnabled,
  setSevereWeatherEnabled,
  markHumidityMitigationApplied,
  syncedHumidity,
  humidityAlertDismissed,
  humidityAlertSuppressed,
  humidityAlertProcessing,
  setHumidityAlertDismissed,
  setHumidityAlertSuppressed,
  setHumidityAlertProcessing
} from '../services/simulationState.js'
import { DEMO_SCENARIO } from '../config/demoScenario.js'

const currentDate = ref('')
const currentTime = ref('')
const weather = ref(getWeatherData())
const overview = ref(getOverviewData())
const lastUpdate = ref('')
const fps = ref(60)
const dataPoints = ref(12345678)
const humidityAnomaly = ref(false)
const showHumidityAlert = ref(false)
const showHumidityObservation = ref(false)
const heroDeviceName = ref(DEMO_SCENARIO.heroDeviceName)

const HUMIDITY_WARNING = 45
const HUMIDITY_ALARM = 75

let observationAutoHideTimer = null

let timeTimer = null
let updateTimer = null
let fpsTimer = null
let alarmAudio = null
let alarmLastPlayedAt = 0

const ensureAlarmAudio = () => {
  if (alarmAudio) return alarmAudio
  alarmAudio = new Audio('/assets/audio/alarm.wav')
  alarmAudio.preload = 'auto'
  alarmAudio.volume = 0.95
  return alarmAudio
}

const playAlarmOnce = async () => {
  const audio = ensureAlarmAudio()
  try {
    audio.currentTime = 0
    await audio.play()
  } catch (error) {
    // 可能被浏览器自动播放策略拦截：用户下一次交互后可再次触发
    console.warn('告警音频播放被拦截/失败:', error)
  }
}

const maybePlayAlarmOnEnterOrShow = async () => {
  if (!severeWeatherEnabled.value) return
  if (!showHumidityAlert.value) return
  if (humidityAlertDismissed.value) return
  if (humidityAlertProcessing.value) return

  const now = Date.now()
  if (now - alarmLastPlayedAt < 500) return
  alarmLastPlayedAt = now
  await playAlarmOnce()
}

// 格式化数字
const formatNumber = (num) => {
  if (num >= 10000000) return (num / 10000000).toFixed(1) + '千万'
  if (num >= 10000) return (num / 10000).toFixed(1) + '万'
  return num.toLocaleString()
}

// 粒子样式
const particleStyle = (index) => {
  const size = Math.random() * 3 + 1
  return {
    width: size + 'px',
    height: size + 'px',
    left: Math.random() * 100 + '%',
    top: Math.random() * 100 + '%',
    animationDelay: Math.random() * 5 + 's',
    animationDuration: (Math.random() * 10 + 10) + 's'
  }
}

// 更新时间
const updateTime = () => {
  const now = new Date()
  currentDate.value = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long'
  })
  currentTime.value = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 更新数据
const updateData = () => {
  weather.value = getWeatherData()
  overview.value = getOverviewData()
  lastUpdate.value = new Date().toLocaleTimeString('zh-CN')
  dataPoints.value += Math.floor(Math.random() * 1000)
}

const toggleSevereWeather = () => {
  setSevereWeatherEnabled(!severeWeatherEnabled.value)
}

const clearHumidityAnomaly = () => {
  humidityAnomaly.value = false
  showHumidityAlert.value = false
  setHumidityAlertDismissed(false)
  showHumidityObservation.value = true
  markHumidityMitigationApplied()
  // 恶劣天气仍在模拟时，允许手动“消除异常”并保持不自动反复弹出
  if (severeWeatherEnabled.value) {
    setHumidityAlertSuppressed(true)
  }
}

const dismissHumidityAlert = () => {
  showHumidityAlert.value = false
  setHumidityAlertDismissed(true)
}

const markHumidityAlertProcessing = () => {
  setHumidityAlertProcessing(true)
  if (alarmAudio) {
    alarmAudio.pause()
    alarmAudio.currentTime = 0
  }
}

const dismissHumidityObservation = () => {
  showHumidityObservation.value = false
}

const currentHumidityText = computed(() => {
  const h = Number(weather.value?.humidity)
  if (!Number.isFinite(h)) return '--'
  return `${h.toFixed(1)}%`
})

const getHumidityAlertPayload = () => ({
  title: '湿度异常告警',
  content: `盒内湿度持续升高（当前 ${currentHumidityText.value}）`,
  analysis: '疑似密封件胶套老化渗水',
  suggestion: '立即现场核查盒体密封状态、胶套老化情况及内部受潮情况。'
})

const humidityAlertPayload = computed(() => getHumidityAlertPayload())

const humidityStage = computed(() => {
  const h = Number(weather.value?.humidity)
  if (!Number.isFinite(h)) return 'normal'
  if (h >= HUMIDITY_ALARM) return 'alarm'
  if (h >= HUMIDITY_WARNING) return 'warning'
  return 'normal'
})

const humidityAlertClass = computed(() => {
  if (humidityStage.value === 'alarm') return 'alarm'
  if (humidityStage.value === 'warning') return 'warning'
  return 'normal'
})

watch(severeWeatherEnabled, (enabled) => {
  if (enabled) {
    if (!humidityAlertSuppressed.value) {
      humidityAnomaly.value = true
      if (!humidityAlertDismissed.value) {
        showHumidityAlert.value = true
      }
      showHumidityObservation.value = false
    }
    return
  }

  // 退出恶劣天气模拟：恢复默认状态
  humidityAnomaly.value = false
  showHumidityAlert.value = false
  showHumidityObservation.value = false
}, { immediate: true })

watch(
  showHumidityAlert,
  (visible, prev) => {
    if (visible && !prev) {
      maybePlayAlarmOnEnterOrShow()
    }
  },
  { immediate: false }
)

onMounted(() => {
  // 规则：恶劣天气时，进入大数据面板若弹窗未关闭且未“处理中”，每次切换进入都播放一次告警语音
  maybePlayAlarmOnEnterOrShow()
})

watch(
  syncedHumidity,
  (value) => {
    if (!severeWeatherEnabled.value) return
    const h = Number(value)
    if (!Number.isFinite(h)) return
    if (!weather.value) return
    weather.value.humidity = h
    if (Array.isArray(weather.value.humidityTrend) && weather.value.humidityTrend.length) {
      const next = [...weather.value.humidityTrend]
      next[next.length - 1] = h
      weather.value.humidityTrend = next
    }
  },
  { immediate: true }
)

watch(
  () => weather.value?.humidity,
  (value) => {
    if (!showHumidityObservation.value) return
    const h = Number(value)
    if (!Number.isFinite(h)) return
    if (h >= HUMIDITY_WARNING) return

    if (observationAutoHideTimer) return
    observationAutoHideTimer = setTimeout(() => {
      observationAutoHideTimer = null
      const latest = Number(weather.value?.humidity)
      if (showHumidityObservation.value && Number.isFinite(latest) && latest < HUMIDITY_WARNING) {
        showHumidityObservation.value = false
      }
    }, 8000)
  }
)

const humidityAlertChartPoints = computed(() => {
  const data = weather.value?.humidityTrend || []
  if (!Array.isArray(data) || data.length === 0) return []
  const count = data.length
  const width = 540
  const height = 100
  const paddingLeft = 10
  const paddingTop = 20
  const min = 0
  const max = 100
  const range = Math.max(1, max - min)

  return data.map((v, i) => ({
    x: paddingLeft + (i / (count - 1)) * width,
    y: paddingTop + height - ((v - min) / range) * height
  }))
})

const humidityAlertLinePoints = computed(() => humidityAlertChartPoints.value.map(p => `${p.x},${p.y}`).join(' '))
const humidityAlertAreaPoints = computed(() => {
  const points = humidityAlertChartPoints.value
  if (points.length === 0) return ''
  const bottom = 130
  const firstX = points[0].x
  const lastX = points[points.length - 1].x
  const line = points.map(p => `${p.x},${p.y}`).join(' ')
  return `${firstX},${bottom} ${line} ${lastX},${bottom}`
})

const humidityAlertLabelPoints = computed(() => {
  const data = weather.value?.humidityTrend || []
  const points = humidityAlertChartPoints.value
  if (!Array.isArray(data) || !data.length || points.length !== data.length) return []

  // 每 3 个点标一个数值（24h -> 8 个标注），避免过密
  const step = 3
  const out = []
  for (let i = 0; i < data.length; i += step) {
    out.push({ ...points[i], value: data[i] })
  }
  // 末尾再补一个“最新值”
  const lastIdx = data.length - 1
  if (lastIdx % step !== 0) {
    out.push({ ...points[lastIdx], value: data[lastIdx] })
  }
  return out
})

onMounted(() => {
  updateTime()
  timeTimer = setInterval(updateTime, 1000)
  updateTimer = setInterval(updateData, 5000)

  // 模拟 FPS
  fpsTimer = setInterval(() => {
    fps.value = Math.floor(55 + Math.random() * 10)
  }, 1000)
})

onUnmounted(() => {
  if (timeTimer) clearInterval(timeTimer)
  if (updateTimer) clearInterval(updateTimer)
  if (fpsTimer) clearInterval(fpsTimer)
  if (observationAutoHideTimer) clearTimeout(observationAutoHideTimer)
  if (alarmAudio) {
    alarmAudio.pause()
    alarmAudio.currentTime = 0
    alarmAudio = null
  }
})
</script>

<style scoped>
.data-panel-container {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 粒子背景 */
.particles-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.particle {
  position: absolute;
  background: #00d4ff;
  border-radius: 50%;
  opacity: 0.3;
  animation: particleFloat 15s infinite linear;
}

@keyframes particleFloat {
  0% {
    transform: translateY(100vh) translateX(0);
    opacity: 0;
  }
  10% {
    opacity: 0.3;
  }
  90% {
    opacity: 0.3;
  }
  100% {
    transform: translateY(-100vh) translateX(100px);
    opacity: 0;
  }
}

/* 网格背景 */
.grid-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(rgba(0, 200, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 200, 255, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;
}

/* 头部 */
.panel-header {
  height: 70px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background: linear-gradient(180deg, rgba(0, 50, 100, 0.8) 0%, transparent 100%);
  border-bottom: 1px solid rgba(0, 200, 255, 0.3);
  position: relative;
  z-index: 10;
}

.panel-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, #00d4ff, transparent);
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 250px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 14px;
  color: #00d4ff;
  font-weight: bold;
}

.header-center {
  text-align: center;
}

.main-title {
  font-size: 24px;
  color: #fff;
  font-weight: bold;
  text-shadow: 0 0 20px rgba(0, 200, 255, 0.5);
  letter-spacing: 8px;
  margin: 0;
}

.title-decorator {
  color: #00d4ff;
  margin: 0 10px;
}

.sub-title {
  font-size: 10px;
  color: rgba(0, 200, 255, 0.6);
  letter-spacing: 3px;
  margin-top: 5px;
}

.header-right {
  justify-content: flex-end;
}

.severe-weather-btn {
  padding: 6px 12px;
  border-radius: 14px;
  border: 1px solid rgba(0, 200, 255, 0.35);
  background: rgba(0, 40, 80, 0.35);
  color: #d6f6ff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
}

.severe-weather-btn:hover {
  border-color: rgba(0, 200, 255, 0.6);
  background: rgba(0, 60, 120, 0.45);
}

.severe-weather-btn.active {
  border-color: rgba(255, 80, 80, 1);
  background: rgba(255, 45, 45, 0.45);
  box-shadow: 0 0 18px rgba(255, 45, 45, 0.55);
  color: #fff;
}

.anomaly-controls {
  display: flex;
  gap: 8px;
}

.anomaly-btn {
  padding: 6px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 120, 120, 0.45);
  background: rgba(80, 20, 20, 0.35);
  color: #ffd5d5;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.anomaly-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: grayscale(0.4);
}

.anomaly-btn:hover {
  border-color: rgba(255, 140, 140, 0.7);
  background: rgba(120, 30, 30, 0.45);
}

.anomaly-btn.clear-btn {
  border-color: rgba(255, 120, 120, 0.65);
  background: rgba(120, 20, 20, 0.35);
  color: #fff;
}

.anomaly-btn.active {
  color: #fff;
  border-color: rgba(255, 80, 80, 1);
  background: rgba(255, 45, 45, 0.45);
  box-shadow: 0 0 18px rgba(255, 45, 45, 0.55);
}

.global-alerts {
  position: absolute;
  top: 84px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.global-alert {
  min-width: 860px;
  max-width: 980px;
  border-radius: 14px;
  border: 2px solid rgba(255, 185, 80, 0.95);
  background: linear-gradient(135deg, rgba(200, 40, 40, 0.96), rgba(210, 150, 30, 0.92));
  box-shadow:
    0 0 26px rgba(255, 60, 60, 0.55),
    0 0 22px rgba(255, 200, 90, 0.45);
  padding: 18px 22px;
  pointer-events: auto;
  animation: globalAlertFlash 0.9s ease-in-out infinite;
}

.global-alert.humidity.warning {
  border-color: rgba(255, 210, 90, 0.95);
  background: linear-gradient(135deg, rgba(180, 90, 20, 0.96), rgba(220, 170, 40, 0.92));
  box-shadow:
    0 0 22px rgba(255, 180, 60, 0.55),
    0 0 18px rgba(255, 230, 120, 0.35);
}

.global-alert.humidity.alarm {
  border-color: rgba(255, 90, 90, 0.98);
  background: linear-gradient(135deg, rgba(200, 25, 25, 0.96), rgba(210, 145, 30, 0.9));
  box-shadow:
    0 0 32px rgba(255, 35, 35, 0.72),
    0 0 18px rgba(255, 220, 110, 0.32);
}

.alert-line {
  margin-top: 6px;
  line-height: 1.5;
}

.global-alert.observe {
  min-width: 860px;
  max-width: 980px;
  border-radius: 14px;
  border: 1px solid rgba(255, 210, 90, 0.55);
  background: linear-gradient(135deg, rgba(40, 60, 90, 0.78), rgba(140, 95, 20, 0.55));
  box-shadow:
    0 0 18px rgba(255, 210, 90, 0.22),
    0 0 18px rgba(0, 212, 255, 0.18);
  padding: 12px 18px;
  animation: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.observe-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.observe-title {
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 1px;
  color: rgba(255, 230, 160, 0.98);
}

.observe-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.92);
}

.observe-close {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.10);
  color: #fff;
  border-radius: 8px;
  font-size: 13px;
  padding: 6px 14px;
  cursor: pointer;
  white-space: nowrap;
}

.alert-title {
  font-size: 22px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.alert-desc {
  font-size: 16px;
  color: rgba(255, 235, 235, 0.95);
}

.alert-target {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
  text-shadow: 0 0 14px rgba(255, 70, 70, 0.6);
}

.alert-hint {
  font-size: 15px;
  color: rgba(255, 235, 235, 0.92);
}

.alert-close {
  margin-top: 14px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  padding: 6px 16px;
  cursor: pointer;
}

.alert-handle {
  margin-top: 14px;
  border: 1px solid rgba(0, 212, 255, 0.55);
  background: rgba(0, 212, 255, 0.14);
  color: rgba(235, 252, 255, 0.98);
  border-radius: 8px;
  font-size: 14px;
  padding: 6px 16px;
  cursor: pointer;
}

.alert-handle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alert-chart {
  margin-top: 14px;
}

.chart-caption {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
  margin-bottom: 8px;
  font-weight: bold;
  letter-spacing: 1px;
}

.alert-chart-svg {
  width: 100%;
  height: 150px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 110, 110, 0.35);
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.alert-pop-enter-active,
.alert-pop-leave-active {
  transition: all 0.25s ease;
}

.alert-pop-enter-from,
.alert-pop-leave-to {
  opacity: 0;
  transform: translateY(-14px) scale(0.96);
}

@keyframes globalAlertFlash {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.22); }
}

.datetime {
  text-align: right;
}

.date {
  font-size: 14px;
  color: #888;
}

.time {
  font-size: 22px;
  color: #00d4ff;
  font-weight: bold;
  font-family: monospace;
}

.weather-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 15px;
  background: rgba(0, 50, 100, 0.5);
  border-radius: 20px;
  border: 1px solid rgba(0, 200, 255, 0.3);
}

.weather-icon {
  font-size: 18px;
}

.weather-temp {
  font-size: 16px;
  color: #fff;
  font-weight: bold;
}

/* 主内容 */
.panel-main {
  flex: 1;
  display: flex;
  padding: 10px;
  gap: 10px;
  overflow: hidden;
  position: relative;
  z-index: 5;
}

.left-aside, .right-aside {
  width: 320px;
  flex-shrink: 0;
}

.center-section {
  flex: 1;
  min-width: 0;
}

/* 底部 */
.panel-footer {
  height: 35px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background: linear-gradient(0deg, rgba(0, 50, 100, 0.8) 0%, transparent 100%);
  border-top: 1px solid rgba(0, 200, 255, 0.2);
  position: relative;
  z-index: 10;
}

.footer-left, .footer-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #888;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: statusPulse 2s infinite;
}

.status-dot.online {
  background: #00ff88;
  box-shadow: 0 0 5px #00ff88;
}

@keyframes statusPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.footer-center {
  display: flex;
  align-items: center;
  gap: 15px;
}

.version {
  font-size: 12px;
  color: #666;
  padding: 2px 8px;
  background: rgba(0, 50, 100, 0.5);
  border-radius: 10px;
}

.copyright {
  font-size: 12px;
  color: #666;
}

.update-time, .fps {
  font-size: 13px;
  color: #888;
}

.fps {
  color: #00ff88;
  font-family: monospace;
}

/* 装饰 */
.decorations {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1;
}

.corner {
  position: absolute;
  width: 30px;
  height: 30px;
  border: 2px solid rgba(0, 200, 255, 0.5);
}

.corner-tl {
  top: 5px;
  left: 5px;
  border-right: none;
  border-bottom: none;
}

.corner-tr {
  top: 5px;
  right: 5px;
  border-left: none;
  border-bottom: none;
}

.corner-bl {
  bottom: 5px;
  left: 5px;
  border-right: none;
  border-top: none;
}

.corner-br {
  bottom: 5px;
  right: 5px;
  border-left: none;
  border-top: none;
}
</style>

