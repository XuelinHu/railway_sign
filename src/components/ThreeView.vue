<template>
  <div class="three-view">
    <!-- Three.js 容器 -->
    <div id="threeContainer" ref="threeContainer"></div>

    <!-- 控制按钮 -->
    <div class="control-panel">
      <button class="control-btn" @click="resetView">🎯 复位视角</button>
      <button class="control-btn" @click="toggleSignals">🚦 切换信号</button>
      <div class="train-control-group">
        <button class="control-btn" @click="trainAnimation">🚂 列车行进</button>
        <div class="speed-inline">
          <span class="speed-label">列车速度</span>
          <select v-model.number="trainSpeed" class="speed-select">
            <option v-for="option in speedOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>
      <button class="control-btn" @click="toggleRotation">🔄 自动旋转</button>
    </div>

    <!-- 左侧数据面板 -->
    <div class="info-panel">
      <!-- 装饰边框 -->
      <div class="panel-border top-left"></div>
      <div class="panel-border top-right"></div>
      <div class="panel-border bottom-left"></div>
      <div class="panel-border bottom-right"></div>
      <div class="panel-border glow-line"></div>

      <div class="panel-section">
        <h2 class="panel-title">
          <span class="title-icon">🚦</span>
          <span class="title-text">信号灯监控</span>
          <span class="title-decorator"></span>
        </h2>
        <div id="signalList"></div>
      </div>

      <!-- 信号灯实时参数 -->
      <div class="panel-section">
        <h2 class="panel-title">
          <span class="title-icon">📊</span>
          <span class="title-text">实时参数</span>
          <span class="title-decorator"></span>
        </h2>
        <!-- 参数选择器 -->
        <div class="param-selectors">
          <select v-model="selectedParam" class="param-select" @change="onParamChange">
            <option value="temperature">🌡️ 温度</option>
            <option value="humidity">💧 湿度</option>
            <option value="light">☀️ 光照</option>
            <option value="voltage">⚡ 电压</option>
            <option value="current">🔌 电流</option>
            <option value="signal">📡 信号</option>
          </select>
          <select v-model="paramTimeRange" class="param-select" @change="onParamTimeChange">
            <option value="1h">近1小时</option>
            <option value="24h">近24小时</option>
            <option value="week">近一周</option>
          </select>
        </div>
        <!-- 当前值显示 -->
        <div class="current-value-display">
          <div class="current-param-icon">{{ paramConfig.icon }}</div>
          <div class="current-param-info">
            <div class="current-param-label">{{ paramConfig.label }}</div>
            <div class="current-param-value" :style="{ color: paramConfig.color }">
              {{ currentParamValue }}<span class="param-unit">{{ paramConfig.unit }}</span>
            </div>
          </div>
        </div>
        <!-- 曲线图 -->
        <div class="param-chart-container">
          <svg viewBox="0 0 280 100" class="param-chart-svg">
            <defs>
              <linearGradient :id="'paramGradient' + selectedParam" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" :style="`stop-color:${paramConfig.color};stop-opacity:0.4`" />
                <stop offset="100%" :style="`stop-color:${paramConfig.color};stop-opacity:0`" />
              </linearGradient>
            </defs>
            <!-- 网格线 -->
            <line x1="10" y1="20" x2="270" y2="20" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
            <line x1="10" y1="50" x2="270" y2="50" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
            <line x1="10" y1="80" x2="270" y2="80" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
            <!-- 数据区域 -->
            <polygon :points="paramAreaPoints" :fill="`url(#paramGradient${selectedParam})`" />
            <!-- 数据线 -->
            <polyline :points="paramLinePoints" fill="none" :stroke="paramConfig.color" stroke-width="2" />
            <!-- 数据点 -->
            <circle v-for="(point, idx) in paramChartPoints" :key="idx"
              :cx="point.x" :cy="point.y" r="3" :fill="paramConfig.color"
              @mouseenter="hoveredParamPoint = idx"
              @mouseleave="hoveredParamPoint = null" />
          </svg>
          <div v-if="hoveredParamPoint !== null" class="param-tooltip">
            {{ paramTimeLabels[hoveredParamPoint] }}: {{ currentParamData[hoveredParamPoint] }}{{ paramConfig.unit }}
          </div>
        </div>
        <!-- 参数快捷列表 -->
        <div class="param-quick-list">
          <div class="param-quick-item" v-for="(p, key) in paramConfigs" :key="key"
            :class="{ active: selectedParam === key }" @click="selectedParam = key">
            <span class="pq-icon">{{ p.icon }}</span>
            <span class="pq-value">{{ signalParams[key] }}{{ p.unit }}</span>
          </div>
        </div>
      </div>

      <!-- 设备状态 -->
      <div class="panel-section">
        <h2 class="panel-title">
          <span class="title-icon">⚙️</span>
          <span class="title-text">设备状态</span>
          <span class="title-decorator"></span>
        </h2>
        <div class="device-status">
          <div class="status-row">
            <span class="status-dot online"></span>
            <span class="status-label">主控板</span>
            <span class="status-value online">正常</span>
          </div>
          <div class="status-row">
            <span class="status-dot online"></span>
            <span class="status-label">通信模块</span>
            <span class="status-value online">正常</span>
          </div>
          <div class="status-row">
            <span class="status-dot" :class="signalParams.temperature > 50 ? 'warning' : 'online'"></span>
            <span class="status-label">散热系统</span>
            <span class="status-value" :class="signalParams.temperature > 50 ? 'warning' : 'online'">{{ signalParams.temperature > 50 ? '告警' : '正常' }}</span>
          </div>
          <div class="status-row">
            <span class="status-dot online"></span>
            <span class="status-label">电源模块</span>
            <span class="status-value online">正常</span>
          </div>
        </div>
      </div>

      <!-- 人形感应器 -->
      <div class="panel-section">
        <h2 class="panel-title">
          <span class="title-icon">🧍</span>
          <span class="title-text">人形感应器</span>
          <span class="title-decorator"></span>
        </h2>
        <div class="humanoid-sensor">
          <div class="sensor-row">
            <span class="sensor-label">电源</span>
            <span class="sensor-value online">{{ humanoidSensor.power }}</span>
            <span class="sensor-meta">{{ humanoidSensor.voltage }}</span>
          </div>
          <div class="sensor-row">
            <span class="sensor-label">GPS</span>
            <span class="sensor-value">{{ humanoidSensor.gps }}</span>
          </div>
          <div class="sensor-row">
            <span class="sensor-label">行人距离</span>
            <span class="sensor-value warning">{{ humanoidSensor.pedestrianDistance }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧数据面板 - 视频监控 -->
    <div class="stats-panel">
      <!-- 装饰边框 -->
      <div class="panel-border top-left"></div>
      <div class="panel-border top-right"></div>
      <div class="panel-border bottom-left"></div>
      <div class="panel-border bottom-right"></div>
      <div class="panel-border glow-line"></div>

      <div class="panel-section">
        <h2 class="panel-title">
          <span class="title-icon">🎮</span>
          <span class="title-text">场景信息</span>
          <span class="title-decorator"></span>
        </h2>
        <div class="stat-item">
          <span class="stat-label">相机位置:</span>
          <span class="stat-value" id="cameraPos">--</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">运行时间:</span>
          <span class="stat-value" id="uptime">0s</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">最后更新:</span>
          <span class="stat-value" id="lastUpdate">--</span>
        </div>
      </div>

      <div class="panel-section">
        <h2 class="panel-title">
          <span class="title-icon">📹</span>
          <span class="title-text">实时监控</span>
          <span class="title-decorator"></span>
        </h2>
        <div class="video-grid">
          <div class="video-card" v-for="(video, index) in videoList" :key="index">
            <div class="video-header">
              <span class="video-dot live"></span>
              <span class="video-title">{{ video.title }}</span>
            </div>
            <div class="video-container" @click="loadVideo(index)">
              <div v-if="!video.loaded" class="video-placeholder">
                <div class="play-button">▶</div>
                <div class="video-hint">点击播放</div>
              </div>
              <img
                v-else
                :src="video.src"
                class="stream-frame"
                alt="stream"
                @load="onVideoLoad(index)"
                @error="reloadVideo(index)"
              />
              <div v-if="video.loaded" class="video-status">{{ video.status }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import gsap from 'gsap'
import api from '../services/api.js'

const getWorldYaw = (obj) => {
  if (!obj) return 0
  const q = new THREE.Quaternion()
  obj.getWorldQuaternion(q)
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ')
  return e.y || 0
}

const threeContainer = ref(null)

// 信号灯实时参数
const signalParams = ref({
  temperature: 35,
  humidity: 65,
  light: 850,
  voltage: 220,
  current: 2.5,
  signal: -45
})

// ===== 参数曲线图相关 =====
const selectedParam = ref('temperature')
const paramTimeRange = ref('24h')
const hoveredParamPoint = ref(null)

// 参数配置
const paramConfigs = {
  temperature: { icon: '🌡️', label: '温度', unit: '°C', color: '#ff6b6b', min: 0, max: 60 },
  humidity: { icon: '💧', label: '湿度', unit: '%', color: '#4ecdc4', min: 0, max: 100 },
  light: { icon: '☀️', label: '光照强度', unit: 'Lux', color: '#ffe66d', min: 0, max: 2000 },
  voltage: { icon: '⚡', label: '电压', unit: 'V', color: '#a8e6cf', min: 180, max: 250 },
  current: { icon: '🔌', label: '电流', unit: 'A', color: '#dda0dd', min: 0, max: 5 },
  signal: { icon: '📡', label: '信号强度', unit: 'dBm', color: '#87ceeb', min: -100, max: 0 }
}

const paramConfig = computed(() => paramConfigs[selectedParam.value] || paramConfigs.temperature)
const currentParamValue = computed(() => signalParams.value[selectedParam.value])

// 参数历史数据 - 1小时（每5分钟一个点，12个点）
const paramData1h = ref({
  temperature: [32, 33, 34, 35, 34, 33, 35, 36, 35, 34, 35, 35],
  humidity: [60, 62, 65, 63, 64, 66, 65, 63, 64, 65, 66, 65],
  light: [800, 850, 900, 880, 860, 870, 850, 840, 850, 860, 850, 850],
  voltage: [218, 220, 222, 219, 221, 220, 218, 220, 221, 220, 219, 220],
  current: [2.3, 2.4, 2.5, 2.4, 2.5, 2.6, 2.5, 2.4, 2.5, 2.5, 2.4, 2.5],
  signal: [-48, -46, -45, -47, -45, -44, -46, -45, -47, -45, -46, -45]
})

// 参数历史数据 - 24小时（每小时一个点，24个点）
const paramData24h = ref({
  temperature: [28, 27, 26, 25, 24, 24, 25, 27, 30, 33, 36, 38, 40, 41, 40, 39, 37, 35, 33, 31, 30, 29, 28, 27],
  humidity: [75, 78, 80, 82, 85, 85, 83, 78, 70, 65, 60, 58, 55, 53, 55, 58, 62, 65, 68, 70, 72, 74, 75, 76],
  light: [0, 0, 0, 0, 0, 50, 200, 500, 800, 1100, 1400, 1600, 1800, 1700, 1500, 1200, 900, 600, 300, 100, 20, 0, 0, 0],
  voltage: [215, 216, 218, 218, 219, 220, 220, 221, 222, 220, 219, 218, 217, 218, 219, 220, 221, 220, 219, 218, 217, 216, 215, 215],
  current: [2.0, 1.9, 1.8, 1.8, 1.9, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.1, 3.2, 3.1, 3.0, 2.8, 2.6, 2.4, 2.2, 2.1, 2.0, 2.0, 1.9, 1.9],
  signal: [-55, -52, -50, -48, -46, -45, -44, -43, -42, -43, -44, -45, -46, -45, -44, -43, -44, -45, -47, -48, -50, -52, -53, -54]
})

// 参数历史数据 - 一周（每天一个点，7个点）
const paramDataWeek = ref({
  temperature: [32, 35, 38, 36, 34, 33, 35],
  humidity: [70, 65, 60, 62, 68, 72, 65],
  light: [850, 900, 950, 880, 820, 800, 850],
  voltage: [220, 218, 222, 219, 221, 220, 220],
  current: [2.5, 2.6, 2.7, 2.5, 2.4, 2.5, 2.5],
  signal: [-45, -48, -42, -44, -46, -47, -45]
})

// 时间标签
const paramTimeLabels1h = ['00:00', '00:05', '00:10', '00:15', '00:20', '00:25', '00:30', '00:35', '00:40', '00:45', '00:50', '00:55']
const paramTimeLabels24h = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
const paramTimeLabelsWeek = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const currentParamData = computed(() => {
  const dataMap = {
    '1h': paramData1h.value,
    '24h': paramData24h.value,
    'week': paramDataWeek.value
  }
  return dataMap[paramTimeRange.value]?.[selectedParam.value] || []
})

const paramTimeLabels = computed(() => {
  const labelsMap = {
    '1h': paramTimeLabels1h,
    '24h': paramTimeLabels24h,
    'week': paramTimeLabelsWeek
  }
  return labelsMap[paramTimeRange.value] || []
})

const paramChartPoints = computed(() => {
  const data = currentParamData.value
  if (!data || data.length === 0) return []

  const count = data.length
  const width = 260
  const height = 70
  const padding = 10
  const config = paramConfig.value

  return data.map((v, i) => ({
    x: padding + (i / (count - 1)) * width,
    y: padding + 10 + height - ((v - config.min) / (config.max - config.min)) * height
  }))
})

const paramLinePoints = computed(() => {
  return paramChartPoints.value.map(p => `${p.x},${p.y}`).join(' ')
})

const paramAreaPoints = computed(() => {
  const points = paramChartPoints.value
  if (points.length === 0) return ''
  const bottom = 90
  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ')
  const firstX = points[0].x
  const lastX = points[points.length - 1].x
  return `${firstX},${bottom} ${linePoints} ${lastX},${bottom}`
})

const onParamChange = () => {
  hoveredParamPoint.value = null
}

const onParamTimeChange = () => {
  hoveredParamPoint.value = null
}

// ===== 视频监控相关 =====
const STREAM_PROXY_BASE = import.meta.env.VITE_STREAM_PROXY_BASE || 'http://localhost:3001/stream-proxy'
const retryTimers = new Map()
const logVideo = (index, action, detail = '') => {
  const prefix = `[video-${index + 1}] ${action}`
  console.log(detail ? `${prefix}: ${detail}` : prefix)
}

const videoList = ref([
  {
    title: '监控点 1 - 站台A',
    streamPath: `${STREAM_PROXY_BASE}/live`,
    src: '',
    loaded: false,
    status: '待播放'
  },
  {
    title: '监控点 2 - 信号塔',
    streamPath: `${STREAM_PROXY_BASE}/live`,
    src: '',
    loaded: false,
    status: '待播放'
  },
  {
    title: '监控点 3 - 铁道口',
    streamPath: `${STREAM_PROXY_BASE}/live`,
    src: '',
    loaded: false,
    status: '待播放'
  }
])

const buildStreamUrl = (streamPath) => `${streamPath}?_t=${Date.now()}`

const loadVideo = (index) => {
  const video = videoList.value[index]
  if (!video.loaded) {
    video.src = buildStreamUrl(video.streamPath)
    video.loaded = true
    video.status = '连接中...'
    logVideo(index, 'load', video.src)
  }
}

const onVideoLoad = (index) => {
  const video = videoList.value[index]
  if (!video) return
  video.status = '已连接'
  logVideo(index, 'connected')
}

const reloadVideo = (index) => {
  const video = videoList.value[index]
  if (!video?.loaded) {
    return
  }

  video.status = '重连中...'
  logVideo(index, 'error', 'stream load failed, retry in 1.2s')
  clearTimeout(retryTimers.get(index))
  const timer = setTimeout(() => {
    video.src = buildStreamUrl(video.streamPath)
    logVideo(index, 'retry', video.src)
  }, 1200)
  retryTimers.set(index, timer)
}

// 计算属性
const tempPercent = computed(() => Math.min(signalParams.value.temperature / 60 * 100, 100))
const lightPercent = computed(() => Math.min(signalParams.value.light / 2000 * 100, 100))
const voltagePercent = computed(() => Math.min(signalParams.value.voltage / 250 * 100, 100))
const currentPercent = computed(() => Math.min(signalParams.value.current / 5 * 100, 100))
const signalPercent = computed(() => Math.min((100 + signalParams.value.signal) / 100 * 100, 100))

const tempClass = computed(() => {
  if (signalParams.value.temperature < 30) return 'temp-low'
  if (signalParams.value.temperature < 50) return 'temp-medium'
  return 'temp-high'
})

const voltageClass = computed(() => {
  if (signalParams.value.voltage >= 210 && signalParams.value.voltage <= 230) return 'voltage-normal'
  return 'voltage-warning'
})

let scene, camera, renderer, controls, labelRenderer
let signals = []
let train = null
let isTrainRunning = false
let autoRotate = false
const speedOptions = [
  { label: '慢速', value: 0.08 },
  { label: '标准', value: 0.12 },
  { label: '快速', value: 0.18 },
  { label: '极速', value: 0.25 }
]
// 默认速度稍微慢一点
const trainSpeed = ref(0.08)
let clock = new THREE.Clock()
let startTime = Date.now()
let mixer = null
let gltfLoader = null
let modelLabels = []
let trainLabelEntry = null
let updateUiTimer = null
let updateSignalParamsTimer = null
let signalObject = null
let pedestrianObject = null
let workerObject = null
let boxObject = null
let boxObjectSize = null
let boxSensorLabelEntry = null
let boxSensorLight = null
let boxSensorWave = null
let boxSensorLabelAnchor = null
let autoDemoStarted = false
let autoDemoWaitTimer = null
let autoDemoFlyTween = null

// 人形感应器面板数据
const humanoidSensor = ref({
  power: '正常',
  voltage: '24V',
  gps: '--, --',
  pedestrianDistance: '--'
})
const boxSensor = ref({
  power: '正常',
  battery: '86%',
  gps: '--, --',
  pedestrianDistance: '--'
})
let trainProgress = 0
const trainPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-168, 3, -168),
  new THREE.Vector3(-100, 3, -100),
  new THREE.Vector3(-84, 3, -84),
  new THREE.Vector3(-50, 3, -50),
  new THREE.Vector3(0, 3, 0),
  new THREE.Vector3(50, 3, 50),
  new THREE.Vector3(100, 3, 100),
  new THREE.Vector3(168, 3, 168),
])

const getClosestPathProgress = (position, samples = 300) => {
  let bestProgress = 0
  let minDistance = Infinity

  for (let index = 0; index <= samples; index++) {
    const progress = index / samples
    const point = trainPath.getPoint(progress)
    const distance = point.distanceTo(position)
    if (distance < minDistance) {
      minDistance = distance
      bestProgress = progress
    }
  }

  return bestProgress
}

const getColorByState = (state) => {
  switch (state) {
    case 'red': return 0xff3333
    case 'green': return 0x33ff33
    case 'yellow': return 0xffff33
    default: return 0x666666
  }
}

const init = () => {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)
  scene.fog = new THREE.Fog(0xf0f0f0, 100, 800)

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  )
  camera.position.set(60, 60, 80)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const containerEl = document.getElementById('threeContainer')
  containerEl.appendChild(renderer.domElement)

  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.left = '0'
  labelRenderer.domElement.style.width = '100%'
  labelRenderer.domElement.style.height = '100%'
  labelRenderer.domElement.style.pointerEvents = 'none'
  containerEl.appendChild(labelRenderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.maxPolarAngle = Math.PI / 2
  controls.minDistance = 20
  controls.maxDistance = 200

  setupLights()
  createAxisHelper()
  createGround()
  createMountains()
  createRailway()
  createSignalLights()
  createTrain()
  createTrees()

  window.addEventListener('resize', onWindowResize)

  animate()
  updateUI()
  updateUiTimer = setInterval(updateUI, 1000)

  console.log('Three.js 小地图初始化完成')
}

const setupLights = () => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambientLight)

  const mainLight = new THREE.DirectionalLight(0xffffff, 1.5)
  mainLight.position.set(50, 100, 50)
  mainLight.castShadow = true
  mainLight.shadow.camera.left = -100
  mainLight.shadow.camera.right = 100
  mainLight.shadow.camera.top = 100
  mainLight.shadow.camera.bottom = -100
  mainLight.shadow.mapSize.width = 2048
  mainLight.shadow.mapSize.height = 2048
  scene.add(mainLight)

  const fillLight = new THREE.DirectionalLight(0xffeedd, 0.5)
  fillLight.position.set(-50, 50, -50)
  scene.add(fillLight)

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
  hemiLight.position.set(0, 200, 0)
  scene.add(hemiLight)
}

const createAxisHelper = () => {
  const axisGroup = new THREE.Group()
  const axisLength = 16.5
  const arrowHeadLength = 2.7
  const arrowHeadRadius = 1
  const lineRadius = 0.35

  const xAxisGroup = new THREE.Group()
  const xLineGeom = new THREE.CylinderGeometry(lineRadius, lineRadius, axisLength, 8)
  const xLineMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.45 })
  const xLine = new THREE.Mesh(xLineGeom, xLineMat)
  xLine.rotation.z = -Math.PI / 2
  xLine.position.x = axisLength / 2
  xAxisGroup.add(xLine)
  const xArrowGeom = new THREE.ConeGeometry(arrowHeadRadius, arrowHeadLength, 8)
  const xArrowMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.45 })
  const xArrow = new THREE.Mesh(xArrowGeom, xArrowMat)
  xArrow.rotation.z = -Math.PI / 2
  xArrow.position.x = axisLength + arrowHeadLength / 2
  xAxisGroup.add(xArrow)
  axisGroup.add(xAxisGroup)

  const yAxisGroup = new THREE.Group()
  const yLineGeom = new THREE.CylinderGeometry(lineRadius, lineRadius, axisLength, 8)
  const yLineMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.45 })
  const yLine = new THREE.Mesh(yLineGeom, yLineMat)
  yLine.position.y = axisLength / 2
  yAxisGroup.add(yLine)
  const yArrowGeom = new THREE.ConeGeometry(arrowHeadRadius, arrowHeadLength, 8)
  const yArrowMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.45 })
  const yArrow = new THREE.Mesh(yArrowGeom, yArrowMat)
  yArrow.position.y = axisLength + arrowHeadLength / 2
  yAxisGroup.add(yArrow)
  axisGroup.add(yAxisGroup)

  // Z 轴
  const zAxisGroup = new THREE.Group()
  const zLineGeom = new THREE.CylinderGeometry(lineRadius, lineRadius, axisLength, 8)
  const zLineMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.45 })
  const zLine = new THREE.Mesh(zLineGeom, zLineMat)
  zLine.rotation.x = Math.PI / 2
  zLine.position.z = axisLength / 2
  zAxisGroup.add(zLine)
  const zArrowGeom = new THREE.ConeGeometry(arrowHeadRadius, arrowHeadLength, 8)
  const zArrowMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.45 })
  const zArrow = new THREE.Mesh(zArrowGeom, zArrowMat)
  zArrow.rotation.x = Math.PI / 2
  zArrow.position.z = axisLength + arrowHeadLength / 2
  zAxisGroup.add(zArrow)
  axisGroup.add(zAxisGroup)

  const createAxisLabel = (text, color, position) => {
    const div = document.createElement('div')
    div.className = 'axis-label-3d'
    div.textContent = text
    div.style.cssText = `
      color: ${color};
      font-size: 12px;
      font-weight: bold;
      text-shadow: 0 0 4px rgba(0,0,0,0.8);
      pointer-events: none;
    `
    const label = new CSS2DObject(div)
    label.position.set(position.x, position.y, position.z)
    return label
  }

  axisGroup.add(createAxisLabel('X', '#ff4444', { x: axisLength + 5, y: 0, z: 0 }))
  axisGroup.add(createAxisLabel('Y', '#44ff44', { x: 0, y: axisLength + 5, z: 0 }))
  axisGroup.add(createAxisLabel('Z', '#4488ff', { x: 0, y: 0, z: axisLength + 5 }))
  axisGroup.position.set(120, -10, -100)
  scene.add(axisGroup)
}

const createGround = () => {
  const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50)
  const groundMaterial = new THREE.MeshStandardMaterial({
    // 地面用灰色填充
    color: 0x808080,
    roughness: 0.9,
    metalness: 0.1
  })

  const vertices = groundGeometry.attributes.position.array
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i]
    const z = vertices[i + 2]
    vertices[i + 1] = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5
  }
  groundGeometry.computeVertexNormals()

  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
}

const createMountains = () => {
  const mountainGeometry = new THREE.ConeGeometry(30, 60, 8)
  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a9a8a,
    roughness: 0.95,
    metalness: 0.05
  })

  const positions = [
    { x: -100, z: 50 },
    { x: 80, z: -100 },
    { x: 100, z: 60 },
    { x: -60, z: 120 }
  ]

  positions.forEach(pos => {
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial)
    mountain.position.set(pos.x, 30, pos.z)
    mountain.scale.y = 1 + Math.random() * 0.5
    mountain.castShadow = true
    mountain.receiveShadow = true
    scene.add(mountain)
  })
}

const createRailway = () => {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }

  // 铁轨方向：X轴旋转45度 (Math.PI / 4 = 45度)
  // 沿着X-Z对角线方向放置铁轨，确保在同一条直线上
  const railAngle = Math.PI / 4  // 45度

  // 铁轨模型缩放12倍后，假设实际有效长度约为15单位
  // 在45度角方向，X和Z方向的分量相等
  const segmentSpacing = 8  // 在当前基础上再缩小约 1.5 倍

  // 生成铁轨位置，沿着45度对角线方向 (z = x)
  const railPositions = []
  // 在现有基础上首末各再复制 5 段
  for (let i = -17; i <= 17; i++) {
    railPositions.push({
      x: i * segmentSpacing,
      z: i * segmentSpacing,  // 45度角时 z = x
      rotation: railAngle
    })
  }

  console.log('铁轨位置 (45度角, 紧密排列):', railPositions)

  railPositions.forEach((pos, index) => {
    gltfLoader.load(
      '/assets/models/railway.glb',
      (gltf) => {
        const railway = gltf.scene
        railway.scale.set(12, 12, 12)
        railway.position.set(pos.x, 0, pos.z)
        railway.rotation.y = pos.rotation

        railway.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        scene.add(railway)
        console.log(`铁轨段 ${index + 1} 加载成功，位置: (${pos.x}, ${pos.z})`)
      },
      (error) => {
        console.error(`铁轨段 ${index + 1} 加载失败:`, error)
      }
    )
  })
}

const createSignalLights = () => {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }

  const getObjectSize = (object3d) => {
    const box = new THREE.Box3().setFromObject(object3d)
    const size = new THREE.Vector3()
    box.getSize(size)
    return { box, size }
  }

  const placeOnGround = (object3d) => {
    const box = new THREE.Box3().setFromObject(object3d)
    const yOffset = -box.min.y
    object3d.position.y += yOffset
  }

  const createBoxSensorLabel = (model) => {
    const div = document.createElement('div')
    div.className = 'model-label'
    div.style.maxWidth = '240px'
    div.style.minWidth = '190px'
    div.innerHTML = `
      <div class="label-title">行人检测传感器</div>
      <div class="label-row">
        <span>🔌 电源:</span>
        <span class="label-value" data-field="power">正常</span>
      </div>
      <div class="label-row">
        <span>🔋 电量:</span>
        <span class="label-value" data-field="battery">86%</span>
      </div>
      <div class="label-row">
        <span>📍 GPS:</span>
        <span class="label-value" data-field="gps">--, --</span>
      </div>
      <div class="label-row">
        <span>📏 行人距离:</span>
        <span class="label-value" data-field="dist">--</span>
      </div>
    `

    const label = new CSS2DObject(div)
    // 不直接挂到 model 上，避免模型旋转导致 label 偏离“正上方”
    const anchor = new THREE.Object3D()
    anchor.position.copy(model.position)
    scene.add(anchor)
    anchor.add(label)

    return {
      object: anchor,
      label,
      div,
      fields: {
        power: div.querySelector('[data-field="power"]'),
        battery: div.querySelector('[data-field="battery"]'),
        gps: div.querySelector('[data-field="gps"]'),
        dist: div.querySelector('[data-field="dist"]')
      }
    }
  }

  const createSensorWave = () => {
    // 扇形光波（超声波）：最终需要在 X-Z 平面（法线对齐 Y 轴）
    // CircleGeometry 默认在 XY 平面，这里直接烘焙旋转到 XZ，避免后续叠加旋转导致“看起来不垂直”
    const radius = 8
    const angle = Math.PI / 2.6 // 扇形开角
    const geometry = new THREE.CircleGeometry(radius, 48, -angle / 2, angle)
    geometry.rotateX(-Math.PI / 2)
    const material = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = 5
    return mesh
  }

  const getWorldYaw = (obj) => {
    if (!obj) return 0
    const q = new THREE.Quaternion()
    obj.getWorldQuaternion(q)
    const e = new THREE.Euler().setFromQuaternion(q, 'YXZ')
    return e.y || 0
  }

  const loadAndPlaceNear = async ({ url, desiredHeight, position, rotation = {}, afterPlace }) => {
    return await new Promise((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => {
          const obj = gltf.scene
          if (rotation.x != null) obj.rotation.x = rotation.x
          if (rotation.y != null) obj.rotation.y = rotation.y
          if (rotation.z != null) obj.rotation.z = rotation.z

          const { size } = getObjectSize(obj)
          const baseHeight = Math.max(0.0001, size.y || 0.0001)
          const scale = desiredHeight / baseHeight
          obj.scale.setScalar(scale)

          obj.position.set(position.x, position.y ?? 0, position.z)
          placeOnGround(obj)

          if (typeof afterPlace === 'function') {
            try {
              afterPlace(obj, getObjectSize(obj).size)
            } catch (e) {
              console.warn('模型后处理失败:', e)
            }
          }

          obj.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })

          scene.add(obj)
          resolve(obj)
        },
        undefined,
        (error) => reject(error)
      )
    })
  }

  // 只创建一个信号灯，放在铁轨旁边
  // 铁轨方向是45度角，信号灯往Z方向挪一点
  // 铁轨经过 x=-20, z=-28 的位置（45度角），信号灯放在轨道旁边
  const signalPositions = [
    // 主信号灯：缩小 + 轻微挪位，避免与新增模型重叠
    { x: -24, z: -42 }
  ]

  const signalStates = ['red']
  const signalNames = ['主信号灯']

  signalPositions.forEach((pos, index) => {
    gltfLoader.load(
      '/assets/models/sign.glb',
      (gltf) => {
        const signGroup = gltf.scene
        // 信号灯在现有基础上缩放为当前的 1/3
        const signScale = (11.2 * 0.8) / 3
        signGroup.scale.set(signScale, signScale, signScale)
        signGroup.position.set(pos.x, 0, pos.z)

        signGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        scene.add(signGroup)
        signalObject = signGroup

        // 在主信号灯旁边放置 box / 行人 / 工作者
        try {
          // 信号灯由 Z 向 X 轴旋转 120°（绕 Y 轴），并朝 X 轴反方向移动两个身位
          signGroup.rotation.y = -Math.PI * 2 / 3

          const { size: signSize } = getObjectSize(signGroup)
          const signStepX = Math.max(2.0, signSize.x || 0)
          signGroup.position.x -= signStepX * 2
          const signHeight = Math.max(1, signSize.y)

          const base = { x: signGroup.position.x, z: signGroup.position.z }
          const dx = Math.max(2.2, signSize.x * 0.9)
          const dz = Math.max(1.2, signSize.z * 0.4)

          // Box：信号灯的 1/4 大小（按高度比例）
          loadAndPlaceNear({
            url: '/assets/models/box.glb',
            // box ×0.5
            desiredHeight: signHeight * 0.25 * 0.5,
            position: { x: base.x + dx, z: base.z + dz },
            // 由 X 朝 Y 方向旋转 90°（绕 Z 轴）
            rotation: { y: 0.2, z: Math.PI / 2 },
            // 盒子改为红色
            afterPlace: (obj) => {
              // box 向 Z 轴方向移动两个身位
              const { size } = getObjectSize(obj)
              const stepZ = Math.max(1.0, size.z || 0)
              obj.position.z += stepZ * 2
              boxObject = obj
              boxObjectSize = size

              // box 上方信息栏：固定在传感器正上方（使用包围盒高度）
              boxSensorLabelEntry = createBoxSensorLabel(obj)
              const { size: bSize } = getObjectSize(obj)
              boxSensorLabelEntry.label.position.set(0, Math.max(2.5, bSize.y + 1.4), 0)
              boxSensorLabelAnchor = boxSensorLabelEntry.object

              // 扇形超声波：沿 X-Y 夹角方向（45°）发射
              if (boxSensorWave) {
                scene.remove(boxSensorWave)
                boxSensorWave.geometry?.dispose?.()
                if (Array.isArray(boxSensorWave.material)) boxSensorWave.material.forEach(m => m.dispose?.())
                else boxSensorWave.material?.dispose?.()
                boxSensorWave = null
              }
              boxSensorWave = createSensorWave()
              boxSensorWave.position.set(obj.position.x, obj.position.y + 1.6, obj.position.z)
              // 光波应该垂直于 Y 轴：已烘焙到 X-Z 平面，这里只需要设置朝向（绕 Y 轴）
              boxSensorWave.rotation.set(0, getWorldYaw(obj), 0)
              scene.add(boxSensorWave)

              // 行人传感器红色发光（点光源）
              if (boxSensorLight) {
                scene.remove(boxSensorLight)
                boxSensorLight = null
              }
              boxSensorLight = new THREE.PointLight(0xff2222, 2.4, 40)
              boxSensorLight.position.set(obj.position.x, obj.position.y + 4.2, obj.position.z)
              scene.add(boxSensorLight)

              obj.traverse((child) => {
                if (!child.isMesh || !child.material) return
                const mats = Array.isArray(child.material) ? child.material : [child.material]
                mats.forEach((m) => {
                  if (m.color) m.color.setHex(0xff3333)
                  if (m.emissive) m.emissive.setHex(0xff0000)
                  if ('emissiveIntensity' in m) m.emissiveIntensity = 0.85
                  m.needsUpdate = true
                })
              })
            }
          }).catch((e) => console.warn('Box 模型加载失败:', e))

          // 行人/工作者：放在信号灯旁边，大小略小于信号灯（按高度比例）
          loadAndPlaceNear({
            url: '/assets/models/man.glb',
            // 人物 ×1.2
            desiredHeight: signHeight * 0.55 * 1.2,
            position: { x: base.x + dx * 0.35, z: base.z - dz * 0.85 },
            rotation: { y: -Math.PI / 6 },
            // 行人沿 X-Z 45° 方向移动 6 个身位，并再沿 X-Y 45° 方向移动 2 个身位
            afterPlace: (obj, objSize) => {
              const step = Math.max(1.2, objSize.x || 0, objSize.z || 0)
              const move = step * 6
              const d = move / Math.SQRT2
              obj.position.x += d
              obj.position.z += d
              const moveXY = step * 2
              const dxy = moveXY / Math.SQRT2
              obj.position.x += dxy
              obj.position.y += dxy
              pedestrianObject = obj
            }
          }).catch((e) => console.warn('行人模型加载失败:', e))

          // 用户口述为 word_man.glb，仓库实际文件名为 work_man.glb
          loadAndPlaceNear({
            url: '/assets/models/work_man.glb',
            // 人物 ×1.2
            desiredHeight: signHeight * 0.6 * 1.2,
            position: { x: base.x + dx * 0.75, z: base.z - dz * 0.35 },
            rotation: { y: Math.PI / 10 },
            // 检修人员往 Z 轴移动一个身位
            afterPlace: (obj, objSize) => {
              // 检修人员朝 X 轴反方向移动两身位
              const stepX = Math.max(1.2, objSize.x || 0)
              obj.position.x -= stepX * 2
              const stepZ = Math.max(1.2, objSize.z || 0)
              obj.position.z += stepZ * 1
              workerObject = obj
            }
          }).catch((e) => console.warn('工作者模型加载失败:', e))
        } catch (e) {
          console.warn('主信号灯旁模型摆放失败:', e)
        }

        const color = getColorByState(signalStates[index])
        const light = new THREE.PointLight(color, 3, 80)
        light.position.set(pos.x, 10, pos.z)
        scene.add(light)

        signals.push({
          mesh: signGroup,
          light: light,
          state: signalStates[index],
          name: signalNames[index]
        })

        // 主信号灯信息栏高度在现有基础上再加一倍
        createModelLabel(signGroup, signalNames[index], 28, 65, '109.3887', '24.3076', 2.4)
        updateSignalUI()
        console.log(`信号灯 ${signalNames[index]} 加载成功`)
      },
      (error) => {
        console.error(`信号灯 ${signalNames[index]} 加载失败:`, error)
      }
    )
  })
}

const createTrain = () => {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }

  gltfLoader.load(
    '/assets/models/locomotive.glb',
    (gltf) => {
      train = gltf.scene
      train.scale.set(12, 12, 12)
      // 列车方向：由X轴向Z轴旋转45度，与铁轨方向一致
      // 铁轨方向是 Math.PI / 4 = 45度
      // 火车头模型默认朝向+X方向，需要旋转到朝向X-Z对角线方向
      const railAngle = Math.PI / 4  // 45度
      // 火车头往Y轴方向抬高，与铁轨平齐
      // 铁轨位置: z = x (45度对角线)，从 -168 到 168
      // 火车头放在铁轨上的位置，z 必须等于 x
      train.position.set(-84, 3, -84)  // 放在铁轨上，Y轴抬高到3，z=x保证在铁轨线上
      // 火车头由 Z 向 X 方向旋转 90°（在原有对齐铁轨方向的基础上偏转 90°）
      train.rotation.y = -railAngle + Math.PI / 2

      train.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      scene.add(train)

      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(train)
        const action = mixer.clipAction(gltf.animations[0])
        action.play()
      }

      // 火车头信息板高度降低：与主体模型更贴合（剩余约 1/5 高度）
      trainLabelEntry = createModelLabel(train, '火车头', 28, 70, '109.3900', '24.3100', 1.2)

      console.log('火车头模型加载成功 - 45度角方向，Y轴抬高')
    },
    (error) => {
      console.error('火车头模型加载失败:', error)
    }
  )
}

const createModelLabel = (model, name, temperature, humidity, gpsLon, gpsLat, labelHeight = 8) => {
  const div = document.createElement('div')
  div.className = 'model-label'

  div.innerHTML = `
    <div class="label-title">${name}</div>
    <div class="label-row">
      <span>🌡️ 温度:</span>
      <span class="label-value" data-field="temperature">${temperature}°C</span>
    </div>
    <div class="label-row">
      <span>💧 湿度:</span>
      <span class="label-value" data-field="humidity">${humidity}%</span>
    </div>
    <div class="label-row">
      <span>📍 GPS:</span>
      <span class="label-value" data-field="gps">${gpsLon}, ${gpsLat}</span>
    </div>
  `

  const label = new CSS2DObject(div)
  // 文本框位置：使用传入的labelHeight参数
  label.position.set(0, labelHeight, 0)
  model.add(label)
  // 保存标签信息用于跟随相机
  const entry = {
    object: model,
    label,
    div,
    name,
    fields: {
      temperature: div.querySelector('[data-field="temperature"]'),
      humidity: div.querySelector('[data-field="humidity"]'),
      gps: div.querySelector('[data-field="gps"]')
    }
  }
  modelLabels.push(entry)

  // 确保样式被添加到文档中（因为 CSS2DRenderer 的元素不在 Vue scoped 样式作用域内）
  if (!document.querySelector('#model-label-styles')) {
    const style = document.createElement('style')
    style.id = 'model-label-styles'
    style.textContent = `
      .model-label {
        position: absolute;
        background: rgba(0, 20, 40, 0.75) !important;
        border: 1px solid rgba(0, 200, 255, 0.4) !important;
        border-radius: 6px;
        padding: 6px 10px;
        color: #fff;
        font-size: 12px;
        pointer-events: none;
        backdrop-filter: blur(8px);
        box-shadow: 0 3px 10px rgba(0, 150, 200, 0.25);
        max-width: 200px;
        min-width: 150px;
        transform: translate(-50%, -100%);  /* 居中并在上方 */
        z-index: 0;  /* 确保在模型后面 */
      }
      .model-label.sensor-warning {
        border-color: rgba(255, 40, 40, 0.95) !important;
        background: linear-gradient(135deg, rgba(180, 20, 20, 0.88), rgba(90, 10, 10, 0.78)) !important;
        box-shadow: 0 0 22px rgba(255, 40, 40, 0.55) !important;
        animation: sensorWarningFlash 0.85s ease-in-out infinite;
      }
      @keyframes sensorWarningFlash {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.28); }
      }
      .label-title {
        font-size: 14px;
        font-weight: bold;
        color: #00d4ff;
        margin-bottom: 6px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(0, 200, 255, 0.25);
      }
      .label-row {
        display: flex;
        align-items: center;
        margin: 4px 0;
        font-size: 11px;
      }
      .label-value {
        flex: 1;
        color: #00d4ff;
        font-weight: bold;
      }
    `
    document.head.appendChild(style)
  }

  return entry
}

const updateLabelFields = (entry, next) => {
  if (!entry?.fields) return
  if (entry.fields.temperature && next.temperature != null) {
    entry.fields.temperature.textContent = `${next.temperature}°C`
  }
  if (entry.fields.humidity && next.humidity != null) {
    entry.fields.humidity.textContent = `${next.humidity}%`
  }
  if (entry.fields.gps && next.gps != null) {
    entry.fields.gps.textContent = next.gps
  }
}

const toTrainGps = (pos) => {
  // 简易映射：仅用于展示“列车行进时 GPS 发生变化”
  const baseLon = 109.39
  const baseLat = 24.31
  const scale = 0.000015
  const lon = baseLon + pos.x * scale
  const lat = baseLat + pos.z * scale
  return { lon, lat }
}

const updateHumanoidSensorPanel = () => {
  if (!signalObject) return

  const refObj = pedestrianObject || workerObject
  if (!refObj) return

  const dx = refObj.position.x - signalObject.position.x
  const dy = refObj.position.y - signalObject.position.y
  const dz = refObj.position.z - signalObject.position.z
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

  const { lon, lat } = toTrainGps(refObj.position)
  humanoidSensor.value.gps = `${lon.toFixed(4)}, ${lat.toFixed(4)}`
  humanoidSensor.value.pedestrianDistance = `${(dist * 1.6).toFixed(1)}m`
}

const updateBoxSensorLabel = () => {
  if (!boxObject || !boxSensorLabelEntry?.fields) return
  const refObj = pedestrianObject || workerObject
  if (!refObj) return

  const dx = refObj.position.x - boxObject.position.x
  const dy = refObj.position.y - boxObject.position.y
  const dz = refObj.position.z - boxObject.position.z
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const { lon, lat } = toTrainGps(boxObject.position)

  boxSensor.value.gps = `${lon.toFixed(4)}, ${lat.toFixed(4)}`
  boxSensor.value.pedestrianDistance = `${(dist * 1.6).toFixed(1)}m`

  // 行人经过预警：距离近时闪烁增强发光
  const meters = dist * 1.6
  const isWarning = meters < 20
  if (boxSensorLight && boxObject) {
    boxSensorLight.position.set(boxObject.position.x, boxObject.position.y + 4.2, boxObject.position.z)
    const t = Date.now() * 0.01
    boxSensorLight.intensity = isWarning ? (4.2 + Math.sin(t * 7) * 2.0) : 2.4
  }
  if (boxObject) {
    boxObject.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach((m) => {
        if (m.emissive) m.emissive.setHex(0xff0000)
        if ('emissiveIntensity' in m) {
          m.emissiveIntensity = isWarning ? (1.25 + Math.sin(Date.now() * 0.02) * 0.6) : 0.85
        }
        m.needsUpdate = true
      })
    })
  }

  // 传感器信息栏始终在 box 正上方（世界坐标系）
  if (boxSensorLabelAnchor && boxObject) {
    boxSensorLabelAnchor.position.set(boxObject.position.x, boxObject.position.y, boxObject.position.z)
    boxSensorLabelAnchor.rotation.set(0, 0, 0)
  }

  // 扇形超声波动画（缩放 + 淡出循环），并跟随传感器位置
  if (boxSensorWave && boxObject) {
    const bSize = boxObjectSize
    const waveY = boxObject.position.y + Math.max(0.2, (bSize?.y || 0) * 0.55)
    boxSensorWave.position.set(boxObject.position.x, waveY, boxObject.position.z)
    // 强制保持在 X-Z 平面（垂直于 Y 轴）：几何已烘焙旋转，这里只跟随朝向（绕 Y 轴）
    boxSensorWave.rotation.set(0, getWorldYaw(boxObject), 0)
    const period = 1300
    const t = (Date.now() % period) / period
    const scale = 0.6 + t * 2.4
    boxSensorWave.scale.set(scale, scale, scale)
    const baseOpacity = isWarning ? 0.45 : 0.28
    boxSensorWave.material.opacity = Math.max(0, (1 - t) * baseOpacity)
    boxSensorWave.material.color.setHex(isWarning ? 0xff1111 : 0xff3333)
  }

  // 信息栏红色告警（距离 < 10m）
  if (boxSensorLabelEntry?.div) {
    boxSensorLabelEntry.div.classList.toggle('sensor-warning', isWarning)
  }

  boxSensorLabelEntry.fields.power.textContent = boxSensor.value.power
  boxSensorLabelEntry.fields.battery.textContent = boxSensor.value.battery
  boxSensorLabelEntry.fields.gps.textContent = boxSensor.value.gps
  boxSensorLabelEntry.fields.dist.textContent = boxSensor.value.pedestrianDistance
}

const startAutoDemo = () => {
  if (autoDemoStarted) return
  autoDemoStarted = true

  autoDemoWaitTimer = setInterval(() => {
    if (!workerObject || !controls || !camera || !train || !signalObject) return
    clearInterval(autoDemoWaitTimer)
    autoDemoWaitTimer = null

    const workerPos = new THREE.Vector3()
    workerObject.getWorldPosition(workerPos)

    const camTo = workerPos.clone().add(new THREE.Vector3(22, 14, 22))

    const state = {
      camX: camera.position.x,
      camY: camera.position.y,
      camZ: camera.position.z,
      tx: controls.target.x,
      ty: controls.target.y,
      tz: controls.target.z
    }

    autoDemoFlyTween = gsap.to(state, {
      camX: camTo.x,
      camY: camTo.y,
      camZ: camTo.z,
      tx: workerPos.x,
      ty: workerPos.y,
      tz: workerPos.z,
      duration: 7,
      ease: 'power2.inOut',
      onUpdate: () => {
        camera.position.set(state.camX, state.camY, state.camZ)
        controls.target.set(state.tx, state.ty, state.tz)
        controls.update()
      },
      onComplete: () => {
        // 保持一定距离后开始旋转
        autoRotate = true

        // 自动触发火车头行进，并从信号灯附近开始
        const nearSignal = new THREE.Vector3(signalObject.position.x, 3, signalObject.position.z)
        trainProgress = getClosestPathProgress(nearSignal, 800)
        const startPoint = trainPath.getPoint(trainProgress)
        train.position.copy(startPoint)
        const nextPoint = trainPath.getPoint((trainProgress + 0.01) % 1)
        train.lookAt(nextPoint)
        isTrainRunning = true
      }
    })
  }, 200)
}

const createTrees = () => {
  const treeCount = 30

  for (let i = 0; i < treeCount; i++) {
    const treeGroup = new THREE.Group()

    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8)
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6a5a4a })
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
    trunk.position.y = 1.5
    trunk.castShadow = true
    treeGroup.add(trunk)

    const leavesGeometry = new THREE.ConeGeometry(2, 4, 8)
    const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x4a8a4a })
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial)
    leaves.position.y = 5
    leaves.castShadow = true
    treeGroup.add(leaves)

    // 树木大小随机分布
    const treeScale = 0.7 + Math.random() * 1.1
    treeGroup.scale.set(treeScale, treeScale * (0.85 + Math.random() * 0.4), treeScale)
    leaves.scale.set(1, 0.8 + Math.random() * 0.8, 1)

    // 树木位置不能落在铁轨上（铁轨沿 z = x 的 45° 对角线分布）
    // 点到直线 z=x 的距离：|z-x|/sqrt(2)
    const railClearance = 10
    let x = 0
    let z = 0
    let attempts = 0
    do {
      x = (Math.random() - 0.5) * 200
      z = (Math.random() - 0.5) * 200
      attempts++
    } while ((Math.abs(z - x) / Math.SQRT2) < railClearance && attempts < 80)

    treeGroup.position.set(x, 0, z)

    scene.add(treeGroup)
  }
}

const updateSignalUI = () => {
  const signalList = document.getElementById('signalList')
  if (!signalList) return

  const stateText = {
    'red': '禁止通行',
    'green': '允许通行',
    'yellow': '减速通行'
  }

  signalList.innerHTML = signals.map(signal => `
    <div class="signal-item">
      <div class="signal-light signal-${signal.state}"></div>
      <div class="signal-info">
        <div class="signal-line">
          <span class="signal-name">${signal.name}</span>
          <span class="signal-status signal-status-${signal.state}">${stateText[signal.state]}</span>
        </div>
      </div>
    </div>
  `).join('')
}

const toggleSignals = () => {
  const states = ['red', 'green', 'yellow']
  signals.forEach(signal => {
    const currentStateIndex = states.indexOf(signal.state)
    signal.state = states[(currentStateIndex + 1) % states.length]
    const color = getColorByState(signal.state)

    signal.light.color.setHex(color)

    if (signal.mesh) {
      signal.mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          if (child.material.emissive) {
            child.material.emissive.setHex(color)
          }
          if (child.material.color) {
            child.material.color.setHex(color)
          }
        }
      })
    }
  })
  updateSignalUI()
}

const trainAnimation = () => {
  const nextState = !isTrainRunning
  if (nextState && train) {
    trainProgress = getClosestPathProgress(train.position, 800)
  }
  isTrainRunning = nextState
}

const toggleRotation = () => {
  autoRotate = !autoRotate
}

const resetView = () => {
  camera.position.set(60, 60, 80)
  controls.target.set(0, 0, 0)
  controls.update()
}

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
}

const updateUI = () => {
  const lastUpdate = document.getElementById('lastUpdate')
  if (lastUpdate) {
    lastUpdate.textContent = new Date().toLocaleString('zh-CN')
  }

  const uptime = document.getElementById('uptime')
  if (uptime) {
    const seconds = Math.floor((Date.now() - startTime) / 1000)
    uptime.textContent = `${seconds}s`
  }

  const camPos = document.getElementById('cameraPos')
  if (camPos) {
    camPos.textContent = `${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)}`
  }
}

// 更新信号灯参数（从API获取实时数据）
const updateSignalParams = async () => {
  try {
    // 从API获取信号灯数据
    const signals = await api.getSignals()
    if (signals && signals.length > 0) {
      // 使用第一个信号灯的数据
      const signal = signals[0]
      signalParams.value.temperature = Math.round(signal.temperature * 10) / 10
      signalParams.value.humidity = Math.round(signal.humidity * 10) / 10
      signalParams.value.light = Math.round(signal.light_intensity)
      signalParams.value.voltage = Math.round(signal.voltage * 10) / 10
      signalParams.value.current = Math.round(signal.current * 100) / 100
      signalParams.value.signal = Math.round(signal.signal_strength)
    }
  } catch (error) {
    console.error('获取信号灯参数失败:', error)
    // 使用备用模拟数据
    signalParams.value.temperature = Math.round((30 + Math.random() * 25) * 10) / 10
    signalParams.value.humidity = Math.round((50 + Math.random() * 40) * 10) / 10
    signalParams.value.light = Math.round(500 + Math.random() * 1500)
    signalParams.value.voltage = Math.round((210 + Math.random() * 30) * 10) / 10
    signalParams.value.current = Math.round((1.5 + Math.random() * 2) * 100) / 100
    signalParams.value.signal = Math.round(-70 + Math.random() * 50)
  }
}

// 加载参数历史数据
const loadParamHistory = async () => {
  try {
    const params = ['temperature', 'humidity', 'light', 'voltage', 'current', 'signal']
    for (const param of params) {
      const data = await api.getParamHistory(param, '24h', 1)
      if (data && data.length > 0) {
        const values = data.map(d => d.param_value)
        // 更新对应的时间范围数据
        if (values.length >= 24) {
          paramData24h.value[param] = values.slice(-24)
        }
        if (values.length >= 12) {
          paramData1h.value[param] = values.slice(-12)
        }
        if (values.length >= 7) {
          paramDataWeek.value[param] = values.slice(-7)
        }
      }
    }
  } catch (error) {
    console.error('加载参数历史失败:', error)
  }
}

const animate = () => {
  requestAnimationFrame(animate)

  const delta = clock.getDelta()

  controls.update()

  if (autoRotate) {
    controls.autoRotate = true
    controls.autoRotateSpeed = 2.0
  } else {
    controls.autoRotate = false
  }

  if (isTrainRunning && train) {
    trainProgress = (trainProgress + delta * trainSpeed.value) % 1
    const position = trainPath.getPoint(trainProgress)
    train.position.copy(position)

    const nextPoint = trainPath.getPoint((trainProgress + 0.01) % 1)
    train.lookAt(nextPoint)

    // 列车行进：GPS 跟随变化，同时展示温度
    if (trainLabelEntry) {
      const { lon, lat } = toTrainGps(train.position)
      const temp = Math.round((26 + Math.sin(trainProgress * Math.PI * 2) * 3 + Math.random() * 0.6) * 10) / 10
      const hum = Math.round((60 + Math.cos(trainProgress * Math.PI * 2) * 6 + Math.random() * 1.2) * 10) / 10
      updateLabelFields(trainLabelEntry, {
        temperature: temp,
        humidity: hum,
        gps: `${lon.toFixed(4)}, ${lat.toFixed(4)}`
      })
    }
  }

  updateHumanoidSensorPanel()
  updateBoxSensorLabel()

  if (mixer) {
    mixer.update(delta)
  }

  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}

onMounted(async () => {
  // 从API加载参数历史数据
  await loadParamHistory()
  await updateSignalParams()

  init()
  // 页面加载完成后自动演示：飞向工作人员 -> 到位后旋转 -> 自动触发行进
  startAutoDemo()

  // 定期更新信号灯参数
  updateSignalParamsTimer = setInterval(updateSignalParams, 5000)
})

onBeforeUnmount(() => {
  for (const timer of retryTimers.values()) {
    clearTimeout(timer)
  }
  retryTimers.clear()

  if (updateUiTimer) {
    clearInterval(updateUiTimer)
    updateUiTimer = null
  }
  if (updateSignalParamsTimer) {
    clearInterval(updateSignalParamsTimer)
    updateSignalParamsTimer = null
  }

  if (autoDemoWaitTimer) {
    clearInterval(autoDemoWaitTimer)
    autoDemoWaitTimer = null
  }
  if (autoDemoFlyTween) {
    autoDemoFlyTween.kill()
    autoDemoFlyTween = null
  }

  if (renderer) {
    renderer.dispose()
  }
  if (labelRenderer?.domElement?.parentNode) {
    labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement)
  }
  labelRenderer = null
  if (boxSensorLight && scene) {
    scene.remove(boxSensorLight)
    boxSensorLight = null
  }
  if (boxSensorWave && scene) {
    scene.remove(boxSensorWave)
    boxSensorWave.geometry?.dispose?.()
    if (Array.isArray(boxSensorWave.material)) boxSensorWave.material.forEach(m => m.dispose?.())
    else boxSensorWave.material?.dispose?.()
    boxSensorWave = null
  }
  if (boxSensorLabelAnchor && scene) {
    scene.remove(boxSensorLabelAnchor)
    boxSensorLabelAnchor = null
    boxSensorLabelEntry = null
  }
  window.removeEventListener('resize', onWindowResize)
})
</script>

<style scoped>
.three-view {
  width: 100%;
  height: 100%;
  position: relative;
}

#threeContainer {
  width: 100%;
  height: 100%;
  position: relative;
}

.control-panel {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 20, 40, 0.85);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 10px 16px;
  color: #fff;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  backdrop-filter: blur(10px);
  z-index: 100;
}

.control-btn {
  padding: 6px 12px;
  background: linear-gradient(135deg, #0066cc, #00d4ff);
  border: none;
  border-radius: 5px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s;
}

.control-btn:hover {
  background: linear-gradient(135deg, #0088ff, #00ffff);
  box-shadow: 0 0 15px rgba(0, 200, 255, 0.5);
}

.train-control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 6px;
  background: rgba(0, 40, 80, 0.45);
}

.speed-label {
  font-size: 12px;
  color: #a8ddff;
}

.speed-select {
  min-width: 78px;
  padding: 3px 6px;
  border: 1px solid rgba(0, 200, 255, 0.4);
  border-radius: 4px;
  background: rgba(0, 20, 40, 0.9);
  color: #d8f3ff;
  font-size: 12px;
}

.info-panel {
  position: absolute;
  top: 62px;
  left: 20px;
  bottom: 64px;
  width: 320px;
  background: rgba(0, 20, 40, 0.55);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 20px;
  color: #fff;
  overflow-y: auto;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 200, 255, 0.2),
              inset 0 0 30px rgba(0, 200, 255, 0.03);
}

.stats-panel {
  position: absolute;
  top: 62px;
  right: 20px;
  bottom: 64px;
  width: 320px;
  background: rgba(0, 20, 40, 0.55);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 20px;
  color: #fff;
  overflow-y: auto;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 200, 255, 0.2),
              inset 0 0 30px rgba(0, 200, 255, 0.03);
}

/* 面板装饰边框 */
.panel-border {
  position: absolute;
  pointer-events: none;
}

.panel-border.top-left {
  top: -1px;
  left: -1px;
  width: 30px;
  height: 30px;
  border-top: 3px solid #00d4ff;
  border-left: 3px solid #00d4ff;
  border-radius: 8px 0 0 0;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  animation: corner-float-tl 3.2s ease-in-out infinite;
}

.panel-border.top-right {
  top: -1px;
  right: -1px;
  width: 30px;
  height: 30px;
  border-top: 3px solid #00d4ff;
  border-right: 3px solid #00d4ff;
  border-radius: 0 8px 0 0;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  animation: corner-float-tr 3.6s ease-in-out infinite;
}

.panel-border.bottom-left {
  bottom: -1px;
  left: -1px;
  width: 30px;
  height: 30px;
  border-bottom: 3px solid #00d4ff;
  border-left: 3px solid #00d4ff;
  border-radius: 0 0 0 8px;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  animation: corner-float-bl 3.4s ease-in-out infinite;
}

.panel-border.bottom-right {
  bottom: -1px;
  right: -1px;
  width: 30px;
  height: 30px;
  border-bottom: 3px solid #00d4ff;
  border-right: 3px solid #00d4ff;
  border-radius: 0 0 8px 0;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  animation: corner-float-br 3.8s ease-in-out infinite;
}

.panel-border.glow-line {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #00d4ff, transparent);
  opacity: 0.6;
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.4; width: 50%; }
  50% { opacity: 0.8; width: 70%; }
}

@keyframes corner-float-tl {
  0%, 100% { transform: translate(0, 0); opacity: 0.85; }
  50% { transform: translate(-2px, -2px); opacity: 1; }
}

@keyframes corner-float-tr {
  0%, 100% { transform: translate(0, 0); opacity: 0.85; }
  50% { transform: translate(2px, -2px); opacity: 1; }
}

@keyframes corner-float-bl {
  0%, 100% { transform: translate(0, 0); opacity: 0.85; }
  50% { transform: translate(-2px, 2px); opacity: 1; }
}

@keyframes corner-float-br {
  0%, 100% { transform: translate(0, 0); opacity: 0.85; }
  50% { transform: translate(2px, 2px); opacity: 1; }
}

.panel-section {
  margin-bottom: 25px;
}

.panel-section:last-child {
  margin-bottom: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #00d4ff;
  font-size: 16px;
  margin-bottom: 15px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 200, 255, 0.3);
  position: relative;
}

.title-icon {
  font-size: 18px;
}

.title-text {
  flex: 1;
}

.title-decorator {
  width: 40px;
  height: 2px;
  background: linear-gradient(90deg, #00d4ff, transparent);
}

.signal-item {
  display: flex;
  align-items: center;
  margin: 12px 0;
  padding: 10px;
  background: rgba(0, 100, 150, 0.2);
  border-radius: 5px;
  border-left: 3px solid #00d4ff;
}

.signal-light {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin-right: 12px;
  box-shadow: 0 0 10px currentColor;
  animation: blink 2s infinite;
}

.signal-red { background: #ff3333; color: #ff3333; }
.signal-green { background: #33ff33; color: #33ff33; }
.signal-yellow { background: #ffff33; color: #ffff33; }

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.signal-info {
  flex: 1;
}

.signal-name {
  font-size: 13px;
  font-weight: bold;
}

.signal-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}

.signal-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.signal-status-red {
  color: #ffd7d7;
  background: rgba(255, 70, 70, 0.28);
  border: 1px solid rgba(255, 120, 120, 0.5);
}

.signal-status-green {
  color: #dbffe1;
  background: rgba(46, 204, 113, 0.24);
  border: 1px solid rgba(102, 255, 178, 0.45);
}

.signal-status-yellow {
  color: #fff5cf;
  background: rgba(255, 193, 7, 0.22);
  border: 1px solid rgba(255, 225, 119, 0.45);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
  font-size: 13px;
}

.stat-label { color: #aaa; }
.stat-value { color: #00d4ff; font-weight: bold; }
.stat-value.highlight {
  color: #33ff33;
  text-shadow: 0 0 5px rgba(51, 255, 51, 0.5);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(0, 100, 150, 0.3);
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0066cc, #00d4ff);
  border-radius: 4px;
  transition: width 0.5s;
}

.loading {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loading-content {
  text-align: center;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(0, 200, 255, 0.3);
  border-top-color: #00d4ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: #00d4ff;
  font-size: 18px;
}

.model-label {
  position: absolute;
  background: rgba(0, 20, 40, 0.9);
  border: 2px solid rgba(0, 200, 255, 0.5);
  border-radius: 8px;
  padding: 12px 16px;
  color: #fff;
  font-size: 14px;
  pointer-events: none;
  backdrop-filter: blur(5px);
  box-shadow: 0 4px 15px rgba(0, 150, 200, 0.3);
  max-width: 280px;
}

.label-title {
  font-size: 16px;
  font-weight: bold;
  color: #00d4ff;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 200, 255, 0.3);
}

.label-row {
  display: flex;
  align-items: center;
  margin: 6px 0;
  font-size: 13px;
}

.label-value {
  flex: 1;
  color: #00d4ff;
  font-weight: bold;
}

/* 参数网格 */
.param-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.param-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: rgba(0, 100, 150, 0.15);
  border-radius: 8px;
  border-left: 3px solid #00d4ff;
}

.param-icon {
  font-size: 20px;
  width: 30px;
  text-align: center;
}

.param-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.param-label {
  font-size: 12px;
  color: #aaa;
}

.param-value {
  font-size: 14px;
  font-weight: bold;
  color: #00d4ff;
}

.param-bar {
  width: 60px;
  height: 6px;
  background: rgba(0, 100, 150, 0.3);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.bar-fill.temp { background: linear-gradient(90deg, #4CAF50, #FFC107, #FF5722); }
.bar-fill.humidity { background: linear-gradient(90deg, #00d4ff, #0066cc); }
.bar-fill.light { background: linear-gradient(90deg, #FFC107, #FF9800); }
.bar-fill.voltage { background: linear-gradient(90deg, #33ff33, #00d4ff); }
.bar-fill.current { background: linear-gradient(90deg, #00d4ff, #ff9900); }
.bar-fill.signal { background: linear-gradient(90deg, #ff3333, #FFC107, #33ff33); }

/* 参数值颜色 */
.temp-low { color: #4CAF50 !important; }
.temp-medium { color: #FFC107 !important; }
.temp-high { color: #FF5722 !important; }
.voltage-normal { color: #33ff33 !important; }
.voltage-warning { color: #FFC107 !important; }

/* 设备状态 */
.device-status {
  margin-bottom: 15px;
}

.humanoid-sensor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
}

.sensor-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(0, 100, 150, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(0, 200, 255, 0.18);
}

.sensor-label {
  font-size: 12px;
  color: #aaa;
  min-width: 60px;
}

.sensor-value {
  font-size: 12px;
  color: #fff;
  font-weight: bold;
  flex: 1;
}

.sensor-meta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
}

.sensor-value.online { color: #33ff33; }
.sensor-value.warning { color: #ffaa00; }

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(0, 100, 150, 0.1);
  border-radius: 6px;
  margin-bottom: 6px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-dot.online {
  background: #33ff33;
  box-shadow: 0 0 8px rgba(51, 255, 51, 0.6);
}

.status-dot.warning {
  background: #FFC107;
  box-shadow: 0 0 8px rgba(255, 193, 7, 0.6);
  animation: pulse-warning 1s infinite;
}

@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-label {
  flex: 1;
  font-size: 12px;
  color: #aaa;
}

.status-value {
  font-size: 12px;
  font-weight: bold;
}

.status-value.online { color: #33ff33; }
.status-value.warning { color: #FFC107; }

/* 视频网格 */
.video-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.video-card {
  background: rgba(0, 100, 150, 0.15);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(0, 200, 255, 0.2);
}

.video-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(0, 200, 255, 0.1);
  border-bottom: 1px solid rgba(0, 200, 255, 0.2);
}

.video-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
}

.video-dot.live {
  background: #ff3333;
  box-shadow: 0 0 6px rgba(255, 51, 51, 0.8);
  animation: live-pulse 1.5s infinite;
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.video-title {
  font-size: 11px;
  color: #00d4ff;
  font-weight: bold;
}

.video-container {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 */
  background: #000;
}

.video-container .stream-frame {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-status {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: #d8f3ff;
  background: rgba(0, 20, 40, 0.75);
  border: 1px solid rgba(0, 200, 255, 0.35);
}

/* 视频占位符 */
.video-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(0, 40, 80, 0.8), rgba(0, 20, 40, 0.9));
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s;
}

.video-placeholder:hover {
  background: linear-gradient(135deg, rgba(0, 60, 100, 0.8), rgba(0, 30, 60, 0.9));
}

.video-placeholder:hover .play-button {
  transform: scale(1.1);
  box-shadow: 0 0 30px rgba(0, 200, 255, 0.6);
}

.play-button {
  width: 50px;
  height: 50px;
  background: rgba(0, 200, 255, 0.3);
  border: 2px solid #00d4ff;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 20px;
  color: #00d4ff;
  transition: all 0.3s;
  box-shadow: 0 0 15px rgba(0, 200, 255, 0.4);
}

.video-hint {
  margin-top: 10px;
  font-size: 12px;
  color: #888;
}

/* 参数选择器 */
.param-selectors {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.param-select {
  flex: 1;
  background: rgba(0, 100, 150, 0.3);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 6px;
  color: #00d4ff;
  font-size: 12px;
  padding: 8px 10px;
  cursor: pointer;
  outline: none;
}

.param-select:hover {
  background: rgba(0, 100, 150, 0.5);
}

.param-select option {
  background: rgba(0, 20, 40, 0.95);
  color: #fff;
}

/* 当前值显示 */
.current-value-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 100, 150, 0.15);
  border-radius: 8px;
  margin-bottom: 12px;
  border-left: 3px solid #00d4ff;
}

.current-param-icon {
  font-size: 32px;
}

.current-param-info {
  flex: 1;
}

.current-param-label {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 4px;
}

.current-param-value {
  font-size: 28px;
  font-weight: bold;
}

.param-unit {
  font-size: 14px;
  color: #888;
  margin-left: 4px;
}

/* 参数曲线图容器 */
.param-chart-container {
  background: rgba(0, 50, 80, 0.2);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 12px;
}

.param-chart-svg {
  width: 100%;
  height: 100px;
  cursor: crosshair;
}

.param-tooltip {
  background: rgba(0, 40, 80, 0.95);
  border: 1px solid rgba(0, 200, 255, 0.5);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: #fff;
  text-align: center;
  margin-top: 4px;
}

/* 参数快捷列表 */
.param-quick-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.param-quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 6px;
  background: rgba(0, 100, 150, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid transparent;
}

.param-quick-item:hover {
  background: rgba(0, 100, 150, 0.3);
}

.param-quick-item.active {
  background: rgba(0, 200, 255, 0.2);
  border-color: rgba(0, 200, 255, 0.5);
}

.pq-icon {
  font-size: 16px;
  margin-bottom: 4px;
}

.pq-value {
  font-size: 12px;
  font-weight: bold;
  color: #00d4ff;
}

</style>
