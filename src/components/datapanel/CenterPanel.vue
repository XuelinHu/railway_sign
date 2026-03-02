<template>
  <div class="center-panel">
    <!-- 顶部核心指标 -->
    <div class="top-metrics">
      <div class="metric-card" v-for="metric in keyMetrics" :key="metric.label">
        <div class="metric-icon">{{ metric.icon }}</div>
        <div class="metric-content">
          <div class="metric-value">
            <span class="value">{{ metric.value }}</span>
            <span class="unit">{{ metric.unit }}</span>
          </div>
          <div class="metric-label">{{ metric.label }}</div>
          <div class="metric-trend" :class="metric.trend >= 0 ? 'up' : 'down'">
            <span class="trend-icon">{{ metric.trend >= 0 ? '↑' : '↓' }}</span>
            <span class="trend-value">{{ Math.abs(metric.trend) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 中间信号调度图区域 -->
    <div class="main-visualization">
      <!-- 标题 -->
      <div class="viz-header">
        <h2 class="viz-title">信号线路调度实时监控</h2>
        <div class="viz-controls">
          <!-- 缩放控制 -->
          <div class="zoom-controls">
            <button class="zoom-btn" @click="zoomIn" title="放大">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
            <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
            <button class="zoom-btn" @click="zoomOut" title="缩小">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
              </svg>
            </button>
            <button class="zoom-btn reset-btn" @click="resetZoom" title="重置">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
            </button>
            <button class="zoom-btn fullscreen-btn" @click="toggleFullscreen" title="全屏">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="viz-time">{{ currentTime }}</div>
      </div>

      <!-- 信号调度图 - 可缩放画布 -->
      <div class="dispatch-container" ref="dispatchContainer"
        @wheel.prevent="handleWheel"
        @mousedown="startDrag"
        @mousemove="onDrag"
        @mouseup="endDrag"
        @mouseleave="endDrag">
        <div class="canvas-wrapper"
          :style="canvasStyle"
          ref="canvasWrapper">
          <svg :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`" class="dispatch-svg" ref="dispatchSvg">
          <defs>
            <!-- 信号灯发光效果 -->
            <filter id="glow-green">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="glow-red">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <!-- 列车动画 -->
            <linearGradient id="trainGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#00ff88;stop-opacity:1" />
            </linearGradient>
          </defs>

          <!-- 线路背景网格 -->
          <g class="grid-lines">
            <line v-for="i in 9" :key="'h'+i" :x1="50" :y1="i * 40 + 20" :x2="750" :y2="i * 40 + 20"
              stroke="rgba(0,200,255,0.1)" stroke-width="1" />
            <line v-for="i in 15" :key="'v'+i" :x1="i * 50" :y1="20" :x2="i * 50" :y2="380"
              stroke="rgba(0,200,255,0.1)" stroke-width="1" />
          </g>

          <!-- 线路 -->
          <g class="rail-lines">
            <!-- 京沪线 - 水平主线 -->
            <g class="line-group" v-for="(line, idx) in displayLines" :key="line.id">
              <line :x1="60" :y1="60 + idx * 70" :x2="740" :y2="60 + idx * 70"
                :stroke="line.color" stroke-width="4" stroke-linecap="round"
                :opacity="0.6" />
              <text :x="30" :y="65 + idx * 70" fill="#888" font-size="10">{{ line.shortName }}</text>
            </g>
          </g>

          <!-- 轨道区段 -->
          <g class="track-sections">
            <rect v-for="section in displaySections" :key="section.id"
              :x="section.x" :y="section.y" :width="section.width" :height="8"
              :fill="getSectionColor(section.state)" :opacity="0.8" rx="2"
              class="track-section" :class="section.state">
              <animate v-if="section.state === '占用'" attributeName="opacity"
                values="0.8;1;0.8" dur="1s" repeatCount="indefinite" />
            </rect>
          </g>

          <!-- 信号机 -->
          <g class="signals">
            <g v-for="signal in displaySignals" :key="signal.id"
              :transform="`translate(${signal.x}, ${signal.y})`"
              class="signal-group" @click="showSignalInfo(signal)">
              <!-- 信号机柱 -->
              <line x1="0" y1="0" x2="0" y2="-20" stroke="#555" stroke-width="2" />
              <!-- 信号灯 -->
              <circle cx="0" cy="-25" r="6" :fill="signal.color"
                :filter="signal.state === '开放' ? 'url(#glow-green)' : 'url(#glow-red)'">
                <animate v-if="signal.state === '开放'" attributeName="r"
                  values="6;7;6" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="0" cy="-38" r="4" :fill="signal.state === '开放' ? '#333' : '#ffaa00'" />
              <circle cx="0" cy="-48" r="4" :fill="signal.state === '关闭' ? '#ff6b6b' : '#333'" />
              <!-- 信号机编号 -->
              <text x="8" y="-30" fill="#888" font-size="8">{{ signal.id }}</text>
            </g>
          </g>

          <!-- 道岔 -->
          <g class="switches">
            <g v-for="sw in displaySwitches" :key="sw.id"
              :transform="`translate(${sw.x}, ${sw.y})`" class="switch-group">
              <!-- 道岔表示 -->
              <polygon v-if="sw.state === '定位'" points="-8,0 8,0 0,-12"
                :fill="sw.locked ? '#00ff88' : '#00d4ff'" />
              <polygon v-else-if="sw.state === '反位'" points="-8,0 8,0 8,-12"
                :fill="sw.locked ? '#00ff88' : '#ffaa00'" />
              <polygon v-else points="-8,0 8,0 0,-12" fill="#ff6b6b" />
              <circle cx="0" cy="4" r="3" :fill="sw.locked ? '#ffaa00' : '#555'" />
              <text x="10" y="0" fill="#888" font-size="7">{{ sw.id }}</text>
            </g>
          </g>

          <!-- 列车 -->
          <g class="trains">
            <g v-for="train in displayTrains" :key="train.id"
              :transform="`translate(${train.x}, ${train.y})`"
              class="train-group" :class="train.state">
              <!-- 列车车身 -->
              <rect x="-15" y="-8" width="30" height="16" rx="4"
                :fill="train.color" class="train-body">
                <animate attributeName="x" values="-15;-12;-15" dur="0.5s"
                  repeatCount="indefinite" v-if="train.state === '正常运行'" />
              </rect>
              <!-- 列车编号 -->
              <text x="0" y="3" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">
                {{ train.id }}
              </text>
              <!-- 状态指示灯 -->
              <circle cx="12" cy="-5" r="3" :fill="getTrainStatusColor(train.state)" />
              <!-- 运动轨迹 -->
              <line v-if="train.direction === '上行'" x1="-20" y1="0" x2="-30" y2="0"
                stroke="rgba(0,212,255,0.5)" stroke-width="2" stroke-dasharray="4,2">
                <animate attributeName="stroke-dashoffset" values="0;-6" dur="0.5s" repeatCount="indefinite" />
              </line>
            </g>
          </g>

          <!-- 进路线 -->
          <g class="routes">
            <line v-for="route in activeRoutes" :key="route.id"
              :x1="route.x1" :y1="route.y1" :x2="route.x2" :y2="route.y2"
              stroke="#00ff88" stroke-width="2" stroke-dasharray="8,4" opacity="0.6">
              <animate attributeName="stroke-dashoffset" values="0;-12" dur="1s" repeatCount="indefinite" />
            </line>
          </g>

          <!-- 图例 -->
          <g class="legend" transform="translate(620, 350)">
            <text x="0" y="0" fill="#888" font-size="10">图例:</text>
            <circle cx="10" cy="15" r="4" fill="#00ff88" />
            <text x="20" y="18" fill="#888" font-size="9">信号开放</text>
            <circle cx="70" cy="15" r="4" fill="#ff6b6b" />
            <text x="80" y="18" fill="#888" font-size="9">信号关闭</text>
            <rect x="5" y="28" width="20" height="6" fill="#00ff88" rx="2" />
            <text x="30" y="34" fill="#888" font-size="9">空闲</text>
            <rect x="60" y="28" width="20" height="6" fill="#ff6b6b" rx="2" />
            <text x="85" y="34" fill="#888" font-size="9">占用</text>
          </g>
        </svg>
        </div>

        <!-- 小地图导航 -->
        <div class="minimap">
          <svg viewBox="0 0 800 400" class="minimap-svg">
            <!-- 简化的线路 -->
            <g class="minimap-lines" opacity="0.5">
              <line v-for="(line, idx) in displayLines" :key="line.id"
                x1="60" :y1="60 + idx * 70" x2="740" :y2="60 + idx * 70"
                :stroke="line.color" stroke-width="2" />
            </g>
            <!-- 视口指示器 -->
            <rect class="viewport-indicator"
              :x="viewportX" :y="viewportY"
              :width="viewportWidth" :height="viewportHeight"
              fill="rgba(0, 200, 255, 0.2)"
              stroke="#00d4ff"
              stroke-width="2"
              @mousedown="startMinimapDrag" />
          </svg>
        </div>
      </div>

      <!-- 调度统计栏 -->
      <div class="dispatch-stats">
        <div class="stat-item" v-for="stat in dispatchStats" :key="stat.label">
          <span class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </div>

    <!-- 底部数据面板 -->
    <div class="bottom-panels">
      <!-- 饼图区域 -->
      <div class="bottom-panel pie-panel">
        <div class="panel-title">信号设备状态分布</div>
        <div class="pie-charts">
          <div class="pie-item" v-for="pie in pieData" :key="pie.title">
            <div class="pie-chart-wrapper">
              <svg viewBox="0 0 100 100" class="pie-svg">
                <!-- 背景圆 -->
                <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="15" />
                <!-- 数据扇形 -->
                <g class="pie-slices">
                  <circle v-for="(slice, i) in pie.data" :key="i"
                    cx="50" cy="50" r="35"
                    fill="none"
                    :stroke="slice.color"
                    stroke-width="15"
                    :stroke-dasharray="slice.dashArray"
                    :stroke-dashoffset="slice.offset"
                    class="pie-slice"
                  />
                </g>
                <!-- 中心数值 -->
                <text x="50" y="45" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">
                  {{ pie.total }}
                </text>
                <text x="50" y="60" text-anchor="middle" fill="#888" font-size="8">
                  {{ pie.unit }}
                </text>
              </svg>
            </div>
            <div class="pie-title">{{ pie.title }}</div>
            <div class="pie-legend">
              <div v-for="item in pie.data" :key="item.name" class="legend-row">
                <span class="legend-dot" :style="{ background: item.color }"></span>
                <span class="legend-name">{{ item.name }}</span>
                <span class="legend-value">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 调度命令 -->
      <div class="bottom-panel command-panel">
        <div class="panel-title">实时调度命令</div>
        <div class="command-list">
          <div v-for="cmd in dispatchCommands" :key="cmd.id"
            :class="['command-item', cmd.status]">
            <div class="cmd-header">
              <span class="cmd-type">{{ cmd.type }}</span>
              <span class="cmd-train">{{ cmd.trainId }}</span>
              <span :class="['cmd-status', cmd.status]">{{ cmd.status }}</span>
            </div>
            <div class="cmd-content">{{ cmd.content }}</div>
            <div class="cmd-meta">
              <span>{{ cmd.issuer }}</span>
              <span>{{ cmd.time }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 调度效率 -->
      <div class="bottom-panel efficiency-panel">
        <div class="panel-title">调度效率统计</div>
        <div class="efficiency-metrics">
          <div class="eff-item">
            <div class="eff-ring">
              <svg viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6" />
                <circle cx="30" cy="30" r="24" fill="none" stroke="#00ff88" stroke-width="6"
                  stroke-linecap="round" :stroke-dasharray="150.8"
                  :stroke-dashoffset="150.8 - (efficiency.successRate / 100 * 150.8)"
                  class="eff-circle" />
                <text x="30" y="28" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">
                  {{ efficiency.successRate }}
                </text>
                <text x="30" y="40" text-anchor="middle" fill="#888" font-size="8">%</text>
              </svg>
            </div>
            <div class="eff-label">调度成功率</div>
          </div>
          <div class="eff-item">
            <div class="eff-value">{{ efficiency.avgResponseTime }}<span class="unit">s</span></div>
            <div class="eff-label">平均响应时间</div>
          </div>
          <div class="eff-item">
            <div class="eff-value">{{ efficiency.avgRouteTime }}<span class="unit">s</span></div>
            <div class="eff-label">进路建立时间</div>
          </div>
          <div class="eff-item">
            <div class="eff-value">{{ efficiency.todayStats.totalCommands }}</div>
            <div class="eff-label">今日命令数</div>
          </div>
        </div>
        <!-- 趋势图 -->
        <div class="trend-chart">
          <div class="chart-title">近7日调度趋势</div>
          <div class="chart-bars">
            <div v-for="(day, i) in efficiency.weeklyTrend" :key="i" class="bar-group">
              <div class="bar" :style="{ height: (day.trains / 500 * 50) + 'px' }">
                <span class="bar-tooltip">{{ day.trains }}列</span>
              </div>
              <span class="bar-label">{{ day.date }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getSignalDispatchData, getSignalDistribution, getDispatchEfficiency } from '../../services/mockDataService'

const dispatchData = ref(getSignalDispatchData())
const signalDist = ref(getSignalDistribution())
const efficiency = ref(getDispatchEfficiency())
const currentTime = ref('')
const updateTimer = ref(null)

// 缩放和平移状态
const dispatchContainer = ref(null)
const canvasWrapper = ref(null)
const dispatchSvg = ref(null)
const canvasWidth = 800
const canvasHeight = 400

const zoomLevel = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const isMinimapDragging = ref(false)

const minZoom = 0.5
const maxZoom = 3
const zoomStep = 0.2

// 画布样式
const canvasStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoomLevel.value})`,
  transformOrigin: 'center center',
  transition: isDragging.value ? 'none' : 'transform 0.1s ease-out'
}))

// 小地图视口计算
const viewportWidth = computed(() => {
  if (!dispatchContainer.value) return 800
  return (dispatchContainer.value.clientWidth / zoomLevel.value) * (800 / canvasWidth)
})

const viewportHeight = computed(() => {
  if (!dispatchContainer.value) return 400
  return (dispatchContainer.value.clientHeight / zoomLevel.value) * (400 / canvasHeight)
})

const viewportX = computed(() => {
  return (-panX.value / zoomLevel.value) * (800 / canvasWidth) + 50
})

const viewportY = computed(() => {
  return (-panY.value / zoomLevel.value) * (400 / canvasHeight)
})

// 缩放控制
const zoomIn = () => {
  if (zoomLevel.value < maxZoom) {
    zoomLevel.value = Math.min(maxZoom, zoomLevel.value + zoomStep)
  }
}

const zoomOut = () => {
  if (zoomLevel.value > minZoom) {
    zoomLevel.value = Math.max(minZoom, zoomLevel.value - zoomStep)
  }
}

const resetZoom = () => {
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
}

// 鼠标滚轮缩放
const handleWheel = (e) => {
  const delta = e.deltaY > 0 ? -zoomStep : zoomStep
  const newZoom = Math.max(minZoom, Math.min(maxZoom, zoomLevel.value + delta))

  if (newZoom !== zoomLevel.value) {
    // 以鼠标位置为中心缩放
    const rect = dispatchContainer.value.getBoundingClientRect()
    const mouseX = e.clientX - rect.left - rect.width / 2
    const mouseY = e.clientY - rect.top - rect.height / 2

    const zoomRatio = newZoom / zoomLevel.value
    panX.value = mouseX - (mouseX - panX.value) * zoomRatio
    panY.value = mouseY - (mouseY - panY.value) * zoomRatio

    zoomLevel.value = newZoom
  }
}

// 拖拽平移
const startDrag = (e) => {
  if (e.target.closest('.minimap') || e.button !== 0) return
  isDragging.value = true
  dragStart.value = { x: e.clientX - panX.value, y: e.clientY - panY.value }
}

const onDrag = (e) => {
  if (!isDragging.value) return
  panX.value = e.clientX - dragStart.value.x
  panY.value = e.clientY - dragStart.value.y
}

const endDrag = () => {
  isDragging.value = false
  isMinimapDragging.value = false
}

// 小地图拖拽
const startMinimapDrag = (e) => {
  e.stopPropagation()
  isMinimapDragging.value = true
  updatePanFromMinimap(e)
}

const updatePanFromMinimap = (e) => {
  if (!isMinimapDragging.value || !dispatchContainer.value) return

  const minimap = e.target.closest('.minimap')
  if (!minimap) return

  const rect = minimap.getBoundingClientRect()
  const scaleX = 800 / rect.width
  const scaleY = 400 / rect.height

  const centerX = (e.clientX - rect.left) * scaleX - viewportWidth.value / 2
  const centerY = (e.clientY - rect.top) * scaleY - viewportHeight.value / 2

  panX.value = -centerX * zoomLevel.value * (canvasWidth / 800)
  panY.value = -centerY * zoomLevel.value * (canvasHeight / 400)
}

// 全屏切换
const toggleFullscreen = () => {
  const container = dispatchContainer.value?.parentElement
  if (!container) return

  if (!document.fullscreenElement) {
    container.requestFullscreen?.() || container.webkitRequestFullscreen?.()
  } else {
    document.exitFullscreen?.() || document.webkitExitFullscreen?.()
  }
}

// 核心指标
const keyMetrics = computed(() => [
  { label: '信号开放率', value: ((dispatchData.value.stats.openSignals / dispatchData.value.stats.totalSignals) * 100).toFixed(1), unit: '%', trend: 0.5, icon: '🚦' },
  { label: '列车运行数', value: dispatchData.value.stats.runningTrains, unit: '列', trend: 0.3, icon: '🚄' },
  { label: '进路激活数', value: dispatchData.value.stats.activeRoutes, unit: '条', trend: -0.2, icon: '🔀' },
  { label: '调度准点率', value: efficiency.value.todayStats.punctualityRate, unit: '%', trend: 0.1, icon: '⏱️' }
])

// 显示用的线路
const displayLines = computed(() => [
  { id: 'L1', shortName: '京沪', color: '#00d4ff' },
  { id: 'L2', shortName: '京广', color: '#00ff88' },
  { id: 'L3', shortName: '沪昆', color: '#ffaa00' },
  { id: 'L4', shortName: '陇海', color: '#ff6b6b' },
  { id: 'L5', shortName: '京哈', color: '#aa88ff' }
])

// 显示用的轨道区段
const displaySections = computed(() => {
  const sections = []
  for (let line = 0; line < 5; line++) {
    for (let i = 0; i < 10; i++) {
      const states = ['空闲', '空闲', '空闲', '占用', '锁闭']
      sections.push({
        id: `GJ-${line * 10 + i + 1}`.padStart(6, '0'),
        x: 80 + i * 65,
        y: 56 + line * 70,
        width: 55,
        state: states[Math.floor(Math.random() * states.length)]
      })
    }
  }
  return sections
})

// 显示用的信号机
const displaySignals = computed(() => {
  const signals = []
  for (let line = 0; line < 5; line++) {
    for (let i = 0; i < 6; i++) {
      const state = Math.random() > 0.15 ? '开放' : '关闭'
      signals.push({
        id: `XH${line * 6 + i + 1}`.padStart(5, '0'),
        x: 100 + i * 110,
        y: 60 + line * 70,
        state,
        color: state === '开放' ? '#00ff88' : '#ff6b6b'
      })
    }
  }
  return signals
})

// 显示用的道岔
const displaySwitches = computed(() => {
  const switches = []
  for (let line = 0; line < 5; line++) {
    for (let i = 0; i < 3; i++) {
      const states = ['定位', '定位', '定位', '反位', '四开']
      switches.push({
        id: `DC${line * 3 + i + 1}`.padStart(5, '0'),
        x: 200 + i * 180,
        y: 60 + line * 70,
        state: states[Math.floor(Math.random() * states.length)],
        locked: Math.random() > 0.3
      })
    }
  }
  return switches
})

// 显示用的列车
const displayTrains = computed(() => {
  return dispatchData.value.trainDispatch.slice(0, 12).map((train, i) => ({
    ...train,
    x: 100 + (i % 6) * 100 + Math.random() * 50,
    y: 60 + Math.floor(i / 6) * 2 * 70 + (i % 2) * 35
  }))
})

// 活跃进路
const activeRoutes = computed(() => {
  return [
    { id: 'R1', x1: 100, y1: 60, x2: 300, y2: 60 },
    { id: 'R2', x1: 400, y1: 130, x2: 600, y2: 130 },
    { id: 'R3', x1: 200, y1: 200, x2: 500, y2: 200 }
  ]
})

// 调度统计
const dispatchStats = computed(() => [
  { label: '信号机', value: `${dispatchData.value.stats.openSignals}/${dispatchData.value.stats.totalSignals}`, color: '#00ff88' },
  { label: '道岔', value: `${dispatchData.value.stats.normalSwitches}/${dispatchData.value.stats.totalSwitches}`, color: '#00d4ff' },
  { label: '占用区段', value: dispatchData.value.stats.occupiedSections, color: '#ff6b6b' },
  { label: '运行列车', value: dispatchData.value.stats.runningTrains, color: '#ffaa00' },
  { label: '晚点列车', value: dispatchData.value.stats.delayedTrains, color: '#ff6b6b' }
])

// 调度命令
const dispatchCommands = computed(() => dispatchData.value.dispatchCommands.slice(0, 4))

// 饼图数据
const pieData = computed(() => {
  const createPieData = (data, title, unit) => {
    const total = data.reduce((sum, d) => sum + d.value, 0)
    let offset = 0
    const slices = data.map(d => {
      const percent = d.value / total
      const dashArray = `${percent * 220} ${220 - percent * 220}`
      const slice = { ...d, dashArray, offset: -offset * 220 }
      offset += percent
      return slice
    })
    return { title, data: slices, total, unit }
  }

  return [
    createPieData(signalDist.value.signalStatus, '信号机状态', '台'),
    createPieData(signalDist.value.switchStatus, '道岔状态', '组'),
    createPieData(signalDist.value.trackStatus, '轨道区段', '段'),
    createPieData(signalDist.value.trainStatus, '列车状态', '列')
  ]
})

// 获取区段颜色
const getSectionColor = (state) => {
  const colors = {
    '空闲': '#00ff88',
    '占用': '#ff6b6b',
    '锁闭': '#ffaa00',
    '故障': '#aa88ff'
  }
  return colors[state] || '#555'
}

// 获取列车状态颜色
const getTrainStatusColor = (state) => {
  const colors = {
    '正常运行': '#00ff88',
    '等待信号': '#ffaa00',
    '减速运行': '#00d4ff',
    '临时停车': '#ff6b6b',
    '晚点运行': '#ff9966'
  }
  return colors[state] || '#888'
}

// 显示信号机信息
const showSignalInfo = (signal) => {
  console.log('Signal info:', signal)
}

// 更新时间
const updateTime = () => {
  currentTime.value = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

onMounted(() => {
  updateTime()
  setInterval(updateTime, 1000)

  updateTimer.value = setInterval(() => {
    dispatchData.value = getSignalDispatchData()
    signalDist.value = getSignalDistribution()
    efficiency.value = getDispatchEfficiency()
  }, 5000)

  // 全局鼠标移动和释放事件（用于小地图拖拽）
  window.addEventListener('mousemove', handleMinimapMove)
  window.addEventListener('mouseup', endDrag)
})

onUnmounted(() => {
  if (updateTimer.value) clearInterval(updateTimer.value)
  window.removeEventListener('mousemove', handleMinimapMove)
  window.removeEventListener('mouseup', endDrag)
})

// 小地图移动处理
const handleMinimapMove = (e) => {
  if (isMinimapDragging.value) {
    updatePanFromMinimap(e)
  }
}
</script>

<style scoped>
.center-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
}

/* 顶部指标 */
.top-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.metric-card {
  background: linear-gradient(135deg, rgba(0, 30, 60, 0.9) 0%, rgba(0, 50, 100, 0.6) 100%);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.metric-icon {
  font-size: 28px;
}

.metric-content {
  flex: 1;
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-value .value {
  font-size: 22px;
  font-weight: bold;
  color: #fff;
}

.metric-value .unit {
  font-size: 11px;
  color: #888;
}

.metric-label {
  font-size: 11px;
  color: #888;
  margin-top: 3px;
}

.metric-trend {
  font-size: 10px;
  margin-top: 3px;
}

.metric-trend.up { color: #00ff88; }
.metric-trend.down { color: #ff6b6b; }

/* 主可视化区域 */
.main-visualization {
  flex: 1;
  background: linear-gradient(135deg, rgba(0, 30, 60, 0.9) 0%, rgba(0, 50, 100, 0.6) 100%);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  min-height: 280px;
}

.viz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.viz-title {
  font-size: 14px;
  color: #00d4ff;
  font-weight: bold;
  margin: 0;
}

.viz-time {
  font-size: 12px;
  color: #fff;
  font-family: monospace;
}

.dispatch-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  cursor: grab;
  user-select: none;
}

.dispatch-container:active {
  cursor: grabbing;
}

.canvas-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 缩放控制 */
.viz-controls {
  display: flex;
  align-items: center;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 50, 100, 0.5);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(0, 200, 255, 0.3);
}

.zoom-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 100, 150, 0.3);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 4px;
  color: #00d4ff;
  cursor: pointer;
  transition: all 0.2s;
}

.zoom-btn:hover {
  background: rgba(0, 150, 200, 0.5);
  transform: scale(1.05);
}

.zoom-btn:active {
  transform: scale(0.95);
}

.zoom-level {
  font-size: 11px;
  color: #fff;
  min-width: 40px;
  text-align: center;
  font-family: monospace;
}

/* 小地图 */
.minimap {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 160px;
  height: 80px;
  background: rgba(0, 20, 40, 0.9);
  border: 1px solid rgba(0, 200, 255, 0.4);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.minimap-svg {
  width: 100%;
  height: 100%;
}

.viewport-indicator {
  cursor: move;
  transition: fill 0.2s;
}

.viewport-indicator:hover {
  fill: rgba(0, 200, 255, 0.3);
}

.dispatch-svg {
  width: 100%;
  height: 100%;
}

.signal-group, .switch-group, .train-group {
  cursor: pointer;
  transition: transform 0.2s;
}

.signal-group:hover, .switch-group:hover {
  transform: scale(1.2);
}

.track-section.占用 {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

.dispatch-stats {
  display: flex;
  justify-content: space-around;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 200, 255, 0.2);
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 16px;
  font-weight: bold;
  display: block;
}

.stat-label {
  font-size: 10px;
  color: #888;
}

/* 底部面板 */
.bottom-panels {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 10px;
}

.bottom-panel {
  background: linear-gradient(135deg, rgba(0, 30, 60, 0.9) 0%, rgba(0, 50, 100, 0.6) 100%);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 12px;
}

.panel-title {
  font-size: 12px;
  color: #00d4ff;
  font-weight: bold;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0, 200, 255, 0.2);
}

/* 饼图 */
.pie-charts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.pie-item {
  text-align: center;
}

.pie-chart-wrapper {
  width: 70px;
  height: 70px;
  margin: 0 auto;
}

.pie-svg {
  width: 100%;
  height: 100%;
}

.pie-slice {
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dasharray 0.5s ease;
}

.pie-title {
  font-size: 10px;
  color: #fff;
  margin-top: 5px;
}

.pie-legend {
  margin-top: 5px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  justify-content: center;
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.legend-name {
  color: #888;
}

.legend-value {
  color: #fff;
  min-width: 15px;
}

/* 调度命令 */
.command-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.command-item {
  padding: 8px;
  background: rgba(0, 50, 100, 0.3);
  border-radius: 6px;
  border-left: 3px solid;
}

.command-item.已执行 { border-left-color: #00ff88; }
.command-item.执行中 { border-left-color: #00d4ff; }
.command-item.待执行 { border-left-color: #ffaa00; }
.command-item.已取消 { border-left-color: #888; }

.cmd-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.cmd-type {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(0, 200, 255, 0.2);
  border-radius: 3px;
  color: #00d4ff;
}

.cmd-train {
  font-size: 11px;
  color: #fff;
  font-weight: bold;
}

.cmd-status {
  font-size: 9px;
  margin-left: auto;
}

.cmd-status.已执行 { color: #00ff88; }
.cmd-status.执行中 { color: #00d4ff; }
.cmd-status.待执行 { color: #ffaa00; }
.cmd-status.已取消 { color: #888; }

.cmd-content {
  font-size: 10px;
  color: #aaa;
  margin-bottom: 4px;
}

.cmd-meta {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #666;
}

/* 调度效率 */
.efficiency-metrics {
  display: flex;
  justify-content: space-around;
  margin-bottom: 10px;
}

.eff-item {
  text-align: center;
}

.eff-ring {
  width: 50px;
  height: 50px;
  margin: 0 auto;
}

.eff-circle {
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 0.5s ease;
}

.eff-value {
  font-size: 16px;
  font-weight: bold;
  color: #00d4ff;
}

.eff-value .unit {
  font-size: 10px;
  color: #888;
}

.eff-label {
  font-size: 9px;
  color: #888;
  margin-top: 3px;
}

.trend-chart {
  margin-top: 10px;
}

.chart-title {
  font-size: 10px;
  color: #888;
  margin-bottom: 8px;
}

.chart-bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 55px;
}

.bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.bar {
  width: 15px;
  background: linear-gradient(to top, #00d4ff, rgba(0, 200, 255, 0.3));
  border-radius: 2px 2px 0 0;
  position: relative;
  transition: height 0.3s;
}

.bar-tooltip {
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 8px;
  color: #888;
  opacity: 0;
  transition: opacity 0.2s;
}

.bar:hover .bar-tooltip {
  opacity: 1;
}

.bar-label {
  font-size: 8px;
  color: #666;
  margin-top: 3px;
}
</style>
