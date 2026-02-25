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
          <span class="logo-text">铁路信号智能监控平台</span>
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
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="panel-main">
      <!-- 左侧面板 -->
      <aside class="left-aside">
        <LeftPanel />
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
        <span class="copyright">© 2024 铁路信号监控系统</span>
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
import { ref, onMounted, onUnmounted, computed } from 'vue'
import LeftPanel from './datapanel/LeftPanel.vue'
import CenterPanel from './datapanel/CenterPanel.vue'
import RightPanel from './datapanel/RightPanel.vue'
import { getWeatherData, getOverviewData } from '../services/mockDataService'

const currentDate = ref('')
const currentTime = ref('')
const weather = ref(getWeatherData())
const overview = ref(getOverviewData())
const lastUpdate = ref('')
const fps = ref(60)
const dataPoints = ref(12345678)

let timeTimer = null
let updateTimer = null

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

onMounted(() => {
  updateTime()
  timeTimer = setInterval(updateTime, 1000)
  updateTimer = setInterval(updateData, 5000)

  // 模拟 FPS
  setInterval(() => {
    fps.value = Math.floor(55 + Math.random() * 10)
  }, 1000)
})

onUnmounted(() => {
  if (timeTimer) clearInterval(timeTimer)
  if (updateTimer) clearInterval(updateTimer)
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

.datetime {
  text-align: right;
}

.date {
  font-size: 12px;
  color: #888;
}

.time {
  font-size: 18px;
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
  font-size: 14px;
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
  font-size: 11px;
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
  font-size: 10px;
  color: #666;
  padding: 2px 8px;
  background: rgba(0, 50, 100, 0.5);
  border-radius: 10px;
}

.copyright {
  font-size: 10px;
  color: #666;
}

.update-time, .fps {
  font-size: 11px;
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
