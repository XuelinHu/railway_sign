<template>
  <div class="right-panel">
    <div class="panel-section ticker-section">
      <div class="section-header">
        <span class="section-icon">播报</span>
        <span class="section-title">区间滚动播报</span>
        <span class="section-badge">脱敏</span>
      </div>
      <div class="ticker-shell">
        <div class="ticker-track">
          <span v-for="(item, idx) in tickerItemsLoop" :key="`${idx}-${item}`" class="ticker-item">{{ item }}</span>
        </div>
      </div>
    </div>
    <!-- 设备监控 -->
    <div class="panel-section equipment-section">
      <div class="section-header">
        <span class="section-icon">⚙️</span>
        <span class="section-title">设备监控</span>
        <span class="section-badge">{{ totalDevices }} 台</span>
      </div>
      <div class="equipment-stats">
        <div class="stat-item normal">
          <span class="stat-value">{{ normalDevices }}</span>
          <span class="stat-label">正常</span>
        </div>
        <div class="stat-item warning">
          <span class="stat-value">{{ warningDevices }}</span>
          <span class="stat-label">预警</span>
        </div>
        <div class="stat-item error">
          <span class="stat-value">{{ errorDevices }}</span>
          <span class="stat-label">故障</span>
        </div>
      </div>
      <div class="equipment-list">
        <div
          v-for="eq in displayEquipment"
          :key="eq.type"
          class="equipment-item"
          :class="{ clickable: eq.clickable }"
          @click="handleEquipmentClick(eq)"
        >
          <div class="eq-header">
            <span class="eq-icon">{{ equipmentIcon(eq.icon) }}</span>
            <span class="eq-name">{{ eq.displayType }}</span>
            <span class="eq-online">{{ eq.onlineRate }}%</span>
          </div>
          <div class="eq-progress">
            <div class="progress-bar">
              <div
                class="progress-fill normal"
                :style="{ width: (eq.normal / eq.total * 100) + '%' }"
              ></div>
              <div
                class="progress-fill warning"
                :style="{ width: (eq.warning / eq.total * 100) + '%' }"
              ></div>
              <div
                class="progress-fill error"
                :style="{ width: (eq.error / eq.total * 100) + '%' }"
              ></div>
            </div>
          </div>
          <div class="eq-stats">
            <span class="normal">✓ {{ eq.normal }}</span>
            <span class="warning">⚠ {{ eq.warning }}</span>
            <span class="error">✗ {{ eq.error }}</span>
          </div>
          <div v-if="eq.clickable" class="eq-hint">点击查看{{ eq.displayType }}实时波动曲线</div>
        </div>
      </div>
    </div>

    <!-- 告警信息 -->
    <div class="panel-section alarm-section">
      <div class="section-header">
        <span class="section-icon">🚨</span>
        <span class="section-title">告警信息</span>
        <span class="section-badge alarm">{{ alarmCount }} 条</span>
      </div>
      <div class="alarm-tabs">
        <button
          v-for="tab in alarmTabs"
          :key="tab.value"
          :class="['alarm-tab', { active: activeAlarmTab === tab.value }]"
          @click="activeAlarmTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="alarm-list">
        <div
          v-for="alarm in filteredAlarms"
          :key="alarm.id"
          :class="['alarm-item', alarm.level, { handled: alarm.handled }]"
        >
          <div class="alarm-level">
            <span :class="['level-icon', alarm.level]">
              {{ alarm.level === 'critical' ? '🔴' : alarm.level === 'warning' ? '🟡' : '🔵' }}
            </span>
          </div>
          <div class="alarm-content">
            <div class="alarm-title">{{ alarm.title }}</div>
            <div class="alarm-desc">{{ alarm.desc }}</div>
            <div class="alarm-meta">
              <span>📍 {{ alarm.source }}</span>
              <span>🕐 {{ formatTime(alarm.time) }}</span>
            </div>
          </div>
          <div class="alarm-actions">
            <button class="action-btn" v-if="!alarm.handled">处理</button>
            <span class="handled-tag" v-else>已处理</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 安全监控 -->
    <div class="panel-section security-section">
      <div class="section-header">
        <span class="section-icon">🛡️</span>
        <span class="section-title">安全监控</span>
      </div>
      <div class="security-overview">
        <div class="security-score">
          <svg viewBox="0 0 100 100" class="score-ring">
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8" />
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              :stroke="securityColor"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="251"
              :stroke-dashoffset="251 - (security.securityScore / 100 * 251)"
              class="score-circle"
            />
            <text x="50" y="45" text-anchor="middle" fill="#fff" font-size="20" font-weight="bold">
              {{ security.securityScore }}
            </text>
            <text x="50" y="62" text-anchor="middle" fill="#888" font-size="10">
              安全评分
            </text>
          </svg>
        </div>
        <div class="security-stats">
          <div class="sec-stat">
            <span class="sec-value">{{ security.intrusionAttempts }}</span>
            <span class="sec-label">入侵尝试</span>
          </div>
          <div class="sec-stat">
            <span class="sec-value">{{ security.blockedIPs }}</span>
            <span class="sec-label">已拦截IP</span>
          </div>
          <div class="sec-stat">
            <span class="sec-value">{{ security.activeUsers }}</span>
            <span class="sec-label">活跃用户</span>
          </div>
        </div>
      </div>
      <div class="vulnerability-stats">
        <div class="vuln-title">漏洞统计</div>
        <div class="vuln-bars">
          <div class="vuln-item critical">
            <span class="vuln-label">严重</span>
            <div class="vuln-bar">
              <div class="vuln-fill" :style="{ width: Math.min(security.vulnerabilities.critical * 20, 100) + '%' }"></div>
            </div>
            <span class="vuln-count">{{ security.vulnerabilities.critical }}</span>
          </div>
          <div class="vuln-item high">
            <span class="vuln-label">高危</span>
            <div class="vuln-bar">
              <div class="vuln-fill" :style="{ width: Math.min(security.vulnerabilities.high * 10, 100) + '%' }"></div>
            </div>
            <span class="vuln-count">{{ security.vulnerabilities.high }}</span>
          </div>
          <div class="vuln-item medium">
            <span class="vuln-label">中危</span>
            <div class="vuln-bar">
              <div class="vuln-fill" :style="{ width: Math.min(security.vulnerabilities.medium * 5, 100) + '%' }"></div>
            </div>
            <span class="vuln-count">{{ security.vulnerabilities.medium }}</span>
          </div>
          <div class="vuln-item low">
            <span class="vuln-label">低危</span>
            <div class="vuln-bar">
              <div class="vuln-fill" :style="{ width: Math.min(security.vulnerabilities.low * 2, 100) + '%' }"></div>
            </div>
            <span class="vuln-count">{{ security.vulnerabilities.low }}</span>
          </div>
        </div>
      </div>
      <div class="security-events">
        <div class="events-title">最近安全事件</div>
        <div class="event-list">
          <div v-for="event in security.recentEvents.slice(0, 4)" :key="event.time" class="event-item">
            <span class="event-type">{{ event.type }}</span>
            <span class="event-user">{{ event.user }}</span>
            <span :class="['event-status', event.status]">{{ event.status }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 运维工单 -->
    <div class="panel-section workorder-section">
      <div class="section-header">
        <span class="section-icon">📋</span>
        <span class="section-title">运维工单</span>
      </div>
      <div class="workorder-stats">
        <div class="wo-stat pending">
          <span class="wo-value">{{ workOrders.pending }}</span>
          <span class="wo-label">待处理</span>
        </div>
        <div class="wo-stat processing">
          <span class="wo-value">{{ workOrders.processing }}</span>
          <span class="wo-label">处理中</span>
        </div>
        <div class="wo-stat completed">
          <span class="wo-value">{{ workOrders.completed }}</span>
          <span class="wo-label">已完成</span>
        </div>
      </div>
      <div class="wo-chart">
        <div class="pie-chart">
          <svg viewBox="0 0 100 100">
            <circle
              v-for="(slice, i) in pieSlices"
              :key="i"
              cx="50" cy="50" r="40"
              fill="none"
              :stroke="slice.color"
              stroke-width="20"
              :stroke-dasharray="slice.dashArray"
              :stroke-dashoffset="slice.offset"
              class="pie-slice"
            />
          </svg>
          <div class="pie-center">
            <span class="pie-value">{{ workOrders.satisfaction }}%</span>
            <span class="pie-label">满意度</span>
          </div>
        </div>
        <div class="wo-legend">
          <div v-for="item in workOrders.ordersByType" :key="item.type" class="legend-item">
            <span class="legend-dot" :style="{ background: item.color }"></span>
            <span class="legend-text">{{ item.type }}</span>
            <span class="legend-count">{{ item.count }}</span>
          </div>
        </div>
      </div>
      <div class="recent-orders">
        <div class="orders-title">最近工单</div>
        <div class="order-list">
          <div v-for="order in workOrders.recentOrders.slice(0, 3)" :key="order.id" class="order-item">
            <div class="order-header">
              <span :class="['order-priority', order.priority]">{{ order.priority }}</span>
              <span class="order-id">{{ order.id }}</span>
            </div>
            <div class="order-title">{{ order.title }}</div>
            <div class="order-meta">
              <span>{{ order.assignee }}</span>
              <span :class="['order-status', order.status]">{{ order.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deviceDialog.visible" class="device-dialog-mask" @click.self="closeDeviceDialog">
      <div class="device-dialog">
        <div class="device-dialog-header">
          <div>
            <div class="device-dialog-title">{{ deviceDialog.title }}</div>
            <div class="device-dialog-subtitle">秒级刷新监测界面 | {{ currentTimeLabel }}</div>
          </div>
          <div class="device-dialog-actions">
            <button v-if="deviceDialog.type === 'track' && trackFaultActive" class="dialog-btn" @click="restoreTrackFault">异常消除</button>
            <button class="dialog-btn" @click="closeDeviceDialog">关闭</button>
          </div>
        </div>
        <div class="device-toolbar">
          <span class="toolbar-chip">{{ deviceDialog.station }}</span>
          <span class="toolbar-chip">{{ deviceDialog.type === 'track' ? '1435调谐单元' : '1495道岔执行单元' }}</span>
          <span class="toolbar-chip" :class="trackFaultActive && deviceDialog.type === 'track' ? 'danger' : 'ok'">
            {{ trackFaultActive && deviceDialog.type === 'track' ? '故障告警' : '运行正常' }}
          </span>
        </div>
        <div class="device-summary-grid">
          <div v-for="item in deviceDialogStats" :key="item.label" class="device-summary-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
        <div class="monitor-chart-panel" v-for="chart in deviceDialogCharts" :key="chart.key">
          <div class="monitor-chart-title">{{ chart.title }}</div>
          <div class="monitor-axis-meta">
            <span>{{ chart.yAxisTitle }}</span>
            <span>{{ chart.xAxisTitle }}</span>
          </div>
          <svg viewBox="0 0 700 180" class="monitor-chart-svg">
            <text v-for="tick in chart.yTicks" :key="`${chart.key}-${tick.y}`" x="6" :y="tick.y + 4" class="monitor-axis-text">{{ tick.label }}</text>
            <line x1="48" y1="28" x2="676" y2="28" class="monitor-grid-line" />
            <line x1="48" y1="82" x2="676" y2="82" class="monitor-grid-line" />
            <line x1="48" y1="136" x2="676" y2="136" class="monitor-grid-line" />
            <line x1="48" y1="162" x2="676" y2="162" class="monitor-axis-line" />
            <polygon :points="chart.areaPoints" :fill="chart.fill" />
            <polyline :points="chart.linePoints" :stroke="chart.color" class="monitor-polyline" />
            <circle v-for="point in chart.points" :key="`${chart.key}-${point.x}`" :cx="point.x" :cy="point.y" r="2.2" :fill="chart.color" />
          </svg>
          <div class="monitor-time-row">
            <span>{{ chart.firstLabel }}</span>
            <span>{{ chart.midLabel }}</span>
            <span>{{ chart.lastLabel }}</span>
          </div>
        </div>
        <div class="device-dialog-note">
          {{ deviceDialogNote }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getEquipmentData, getAlarmData, getSecurityData, getWorkOrderData } from '../../services/mockDataService'

const equipment = ref(getEquipmentData())
const alarms = ref(getAlarmData())
const security = ref(getSecurityData())
const workOrders = ref(getWorkOrderData())
const activeAlarmTab = ref('all')
const updateTimer = ref(null)
const currentTimeLabel = ref(new Date().toLocaleString('zh-CN'))
const realtimeTick = ref(Date.now())
const trackFaultActive = ref(false)
const latestVoiceText = ref('')
const deviceDialog = ref({
  visible: false,
  type: 'switch',
  title: '1495道岔监测',
  station: 'K149+525'
})

const tickerItems = [
  '1491、1493、1495、1497 信号机在线率持续稳定，状态数据按秒级刷新。',
  '1495 信号机湿度、温度与电压监测曲线联动展示，适用于故障演练回放。',
  '1495 道岔动作电流、动作电压保持秒级采样，检修记录自动进入滚动播报。',
  '1435 调谐单元监测界面支持秒级波动与 L 键故障注入演示。',
  '轨道电路、电源屏、信号机弹窗均与当前系统时间同步刷新。',
  '当前区间演示对象为 1491-1497，所有编号已按最新命名统一。'
]

const tickerItemsLoop = computed(() => [...tickerItems, ...tickerItems])


// 告警标签
const alarmTabs = [
  { label: '全部', value: 'all' },
  { label: '严重', value: 'critical' },
  { label: '警告', value: 'warning' },
  { label: '信息', value: 'info' }
]

const displayEquipment = computed(() => {
  const typeMap = {
    signal: { displayType: '1491-1497信号机', clickable: false },
    switch: { displayType: '1495道岔', clickable: true, dialogType: 'switch' },
    track: { displayType: '1495轨道电路', clickable: true, dialogType: 'track' },
    battery: { displayType: 'UPS电源', clickable: false },
    network: { displayType: '通信设备', clickable: false },
    camera: { displayType: '监控摄像头', clickable: false },
    train: { displayType: '列车检测器', clickable: false },
    lightning: { displayType: '防雷设备', clickable: false }
  }

  return equipment.value.map((eq) => ({
    ...eq,
    displayType: typeMap[eq.icon]?.displayType || eq.type,
    clickable: Boolean(typeMap[eq.icon]?.clickable),
    dialogType: typeMap[eq.icon]?.dialogType || null
  }))
})

// 设备统计
const totalDevices = computed(() => equipment.value.reduce((sum, eq) => sum + eq.total, 0))
const normalDevices = computed(() => equipment.value.reduce((sum, eq) => sum + eq.normal, 0))
const warningDevices = computed(() => equipment.value.reduce((sum, eq) => sum + eq.warning, 0))
const errorDevices = computed(() => equipment.value.reduce((sum, eq) => sum + eq.error, 0))

// 告警数量
const normalizedAlarms = computed(() => {
  const base = [
    {
      id: 'alarm-signal-1495',
      level: 'info',
      title: '1495信号机巡检提示',
      desc: '1495信号机近 24 小时运行平稳，建议继续观察湿度与灯丝寿命趋势。',
      time: new Date(realtimeTick.value - 8 * 60 * 1000).toLocaleString('zh-CN'),
      source: '1495信号机',
      handled: false
    },
    {
      id: 'alarm-switch-1495',
      level: 'warning',
      title: '1495道岔动作波动预警',
      desc: '道岔动作电流产生轻微波动，建议点开实时曲线进一步核查。',
      time: new Date(realtimeTick.value - 3 * 60 * 1000).toLocaleString('zh-CN'),
      source: '1495道岔',
      handled: false
    }
  ]

  if (trackFaultActive.value) {
    base.unshift({
      id: 'alarm-track-1435',
      level: 'critical',
      title: '1435调谐单元参数异常告警',
      desc: '告警内容：谐振频率偏离设计值。关联分析：疑似电容被击穿或受潮。建议处置：更换1435调谐单元。',
      time: new Date(realtimeTick.value).toLocaleString('zh-CN'),
      source: '1435调谐单元',
      handled: false
    })
  }

  return base
})

const alarmCount = computed(() => normalizedAlarms.value.filter(a => !a.handled).length)

// 过滤告警
const filteredAlarms = computed(() => {
  if (activeAlarmTab.value === 'all') return normalizedAlarms.value.slice(0, 6)
  return normalizedAlarms.value.filter(a => a.level === activeAlarmTab.value).slice(0, 6)
})

const handleEquipmentClick = (eq) => {
  if (!eq.clickable || !eq.dialogType) return
  openDeviceDialog(eq.dialogType)
}

const openDeviceDialog = (type) => {
  deviceDialog.value = {
    visible: true,
    type,
    title: type === 'track' ? '1435调谐单元监测' : '1495道岔监测',
    station: 'K149+525'
  }
}

const closeDeviceDialog = () => {
  deviceDialog.value.visible = false
}

const speakAlarm = (text) => {
  latestVoiceText.value = text
  if (!('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  } catch (error) {
    console.warn('语音播报失败:', error)
  }
}

const restoreTrackFault = () => {
  trackFaultActive.value = false
}

const handleKeydown = (event) => {
  if (!event || event.repeat) return
  const key = String(event.key || '')
  const tag = String(event.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return

  if (key === 'l' || key === 'L') {
    trackFaultActive.value = true
    openDeviceDialog('track')
    speakAlarm('监测到1435调谐单元参数异常，谐振频率偏离设计值。关联分析为疑似电容被击穿或受潮，建议更换1435调谐单元。')
  }
}

const formatChartPoints = (series, minY = 24, maxY = 156, unit = '') => {
  const values = series.map((item) => item.value)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const range = Math.max(1, max - min)
  const points = series.map((item, index) => {
    const x = 48 + index * ((676 - 48) / Math.max(1, series.length - 1))
    const ratio = (item.value - min) / range
    const y = maxY - ratio * (maxY - minY)
    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      label: item.label,
      value: item.value
    }
  })
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPoints = points.length ? `${points[0].x},162 ${linePoints} ${points[points.length - 1].x},162` : ''
  return {
    points,
    linePoints,
    areaPoints,
    firstLabel: points[0]?.label || '--',
    midLabel: points[Math.floor(points.length / 2)]?.label || '--',
    lastLabel: points[points.length - 1]?.label || '--',
    yTicks: [
      { y: 28, label: `${max.toFixed(2)} ${unit}` },
      { y: 82, label: `${((max + min) / 2).toFixed(2)} ${unit}` },
      { y: 136, label: `${min.toFixed(2)} ${unit}` }
    ]
  }
}

const DIALOG_HISTORY_POINTS = 33
const DIALOG_HISTORY_INTERVAL_MS = 15 * 60 * 1000

const buildSeries = (base, amplitude, phase, faulted = false) => {
  const now = realtimeTick.value
  return Array.from({ length: DIALOG_HISTORY_POINTS }, (_, index) => {
    const offset = (DIALOG_HISTORY_POINTS - 1 - index) * DIALOG_HISTORY_INTERVAL_MS
    const sampleAt = now - offset
    const tHours = sampleAt / (60 * 60 * 1000)
    const ratio = index / Math.max(1, DIALOG_HISTORY_POINTS - 1)
    const fluctuation = Math.sin((tHours + phase) * 3.1) * amplitude + Math.cos((tHours + phase) * 4.2) * (amplitude * 0.45)
    let value = base + fluctuation
    if (faulted && ratio > 0.55) {
      const tailFluctuation = Math.sin((tHours + phase) * 5.4) * Math.max(0.06, amplitude * 0.08)
      value = Math.max(0.08, base * 0.015 + tailFluctuation)
    }
    return {
      label: new Date(sampleAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      value: Math.round(value * 100) / 100
    }
  })
}

const deviceDialogCharts = computed(() => {
  const isTrack = deviceDialog.value.type === 'track'
  const faulted = isTrack && trackFaultActive.value

  const firstSeries = isTrack
    ? buildSeries(55.0, 1.1, 0.2, faulted)
    : buildSeries(109.6, 2.4, 0.1, false)
  const secondSeries = isTrack
    ? buildSeries(33.0, 0.55, 0.8, faulted)
    : buildSeries(104.8, 2.8, 0.6, false)

  return [
    {
      key: 'top',
      title: isTrack ? '电容值变化曲线' : '定位动作曲线',
      yAxisTitle: isTrack ? '纵坐标：电容值（μF）' : '纵坐标：定位电压（V）',
      xAxisTitle: '横坐标：时间（近8小时）',
      color: faulted ? '#ff4d4f' : '#2d8cff',
      fill: faulted ? 'rgba(255,77,79,0.18)' : 'rgba(45,140,255,0.16)',
      ...formatChartPoints(firstSeries, 24, 156, isTrack ? 'μF' : 'V')
    },
    {
      key: 'bottom',
      title: isTrack ? '电感值变化曲线' : '反位动作曲线',
      yAxisTitle: isTrack ? '纵坐标：电感值（μH）' : '纵坐标：反位电压（V）',
      xAxisTitle: '横坐标：时间（近8小时）',
      color: faulted ? '#ff7a45' : '#37c978',
      fill: faulted ? 'rgba(255,122,69,0.14)' : 'rgba(55,201,120,0.14)',
      ...formatChartPoints(secondSeries, 24, 156, isTrack ? 'μH' : 'V')
    }
  ]
})

const deviceDialogStats = computed(() => {
  if (deviceDialog.value.type === 'track') {
    return [
      { label: '正常电容值', value: '55.00 uF' },
      { label: '允许范围', value: '52.25 ~ 57.75 uF' },
      { label: '正常电感值', value: '33.00 uH（允许±3%）' },
      { label: '当前状态', value: trackFaultActive.value ? '参数异常告警' : '运行正常' }
    ]
  }

  return [
    { label: '定位电压', value: '109.6 V' },
    { label: '反位电压', value: '104.8 V' },
    { label: '动作电流', value: '1.64 A' },
    { label: '状态', value: '运行正常' }
  ]
})

const deviceDialogNote = computed(() => {
  if (deviceDialog.value.type === 'track' && trackFaultActive.value) {
    return '参数异常告警。1435调谐单元告警内容：谐振频率偏离设计值。关联分析：疑似电容被击穿或受潮。建议处置：更换1435调谐单元。电气参数变化曲线以正常电容值 55 μF（允许±5%，52.25 ~ 57.75 μF）和正常电感值 33 μH（允许±3%）为参考。'
  }
  if (deviceDialog.value.type === 'track') {
    return '电气参数变化曲线按秒级推进，参考正常电容值 55 μF（允许±5%，52.25 ~ 57.75 μF）与正常电感值 33 μH（允许±3%）。按 L 键可触发 1435 调谐单元异常演示。'
  }
  return '道岔监测界面按秒级刷新动作曲线，便于观察定位与反位过程中的电压、电流波动。'
})

// 安全评分颜色
const securityColor = computed(() => {
  const score = security.value.securityScore
  if (score >= 90) return '#00ff88'
  if (score >= 70) return '#ffaa00'
  return '#ff6b6b'
})

// 饼图切片
const pieSlices = computed(() => {
  const data = workOrders.value.ordersByType
  const total = data.reduce((sum, item) => sum + item.count, 0)
  let offset = 0
  return data.map(item => {
    const percent = item.count / total
    const dashArray = `${percent * 251} ${251 - percent * 251}`
    const slice = { color: item.color, dashArray, offset: -offset }
    offset += percent * 251
    return slice
  })
})

// 设备图标
const equipmentIcon = (type) => {
  const icons = {
    signal: '🚦',
    switch: '🔀',
    track: '🛤️',
    battery: '🔋',
    network: '🌐',
    camera: '📹',
    train: '🚄',
    lightning: '⚡'
  }
  return icons[type] || '⚙️'
}

// 格式化时间
const formatTime = (timeStr) => {
  const date = new Date(timeStr)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 定时更新
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  updateTimer.value = setInterval(() => {
    equipment.value = getEquipmentData()
    security.value = getSecurityData()
    workOrders.value = getWorkOrderData()
    realtimeTick.value = Date.now()
    currentTimeLabel.value = new Date().toLocaleString('zh-CN')
  }, 1000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (updateTimer.value) {
    clearInterval(updateTimer.value)
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
})
</script>

<style scoped>
.right-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  padding-left: 5px;
}

.right-panel::-webkit-scrollbar {
  width: 4px;
}

.right-panel::-webkit-scrollbar-thumb {
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
  font-size: 16px;
  font-weight: bold;
  color: #00d4ff;
  flex: 1;
}

.section-badge {
  font-size: 13px;
  padding: 2px 8px;
  background: rgba(0, 200, 255, 0.2);
  border: 1px solid rgba(0, 200, 255, 0.4);
  border-radius: 10px;
  color: #00d4ff;
}

.ticker-shell {
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(0, 200, 255, 0.22);
  background: rgba(0, 18, 38, 0.6);
}

.ticker-track {
  display: flex;
  align-items: center;
  width: max-content;
  gap: 28px;
  padding: 10px 0;
  animation: ticker-scroll 30s linear infinite;
}

.ticker-item {
  flex: 0 0 auto;
  font-size: 14px;
  color: rgba(230, 247, 255, 0.92);
  white-space: nowrap;
}

@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.section-badge.alarm {
  background: rgba(255, 107, 107, 0.2);
  border-color: rgba(255, 107, 107, 0.4);
  color: #ff6b6b;
}

/* 设备统计 */
.equipment-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 15px;
}

.stat-item {
  text-align: center;
  padding: 10px;
  background: rgba(0, 50, 100, 0.3);
  border-radius: 8px;
  min-width: 60px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  display: block;
}

.stat-item.normal .stat-value { color: #00ff88; }
.stat-item.warning .stat-value { color: #ffaa00; }
.stat-item.error .stat-value { color: #ff6b6b; }

.stat-label {
  font-size: 13px;
  color: #888;
}

/* 设备列表 */
.equipment-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
}

.equipment-item {
  background: rgba(0, 50, 100, 0.2);
  border-radius: 8px;
  padding: 10px;
}

.equipment-item.clickable {
  cursor: pointer;
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  border: 1px solid rgba(0, 200, 255, 0.18);
}

.equipment-item.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 22px rgba(0, 140, 200, 0.22);
  border-color: rgba(0, 212, 255, 0.42);
}

.eq-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.eq-icon {
  font-size: 16px;
}

.eq-name {
  font-size: 14px;
  color: #fff;
  flex: 1;
}

.eq-online {
  font-size: 13px;
  color: #00ff88;
}

.eq-progress {
  margin-bottom: 5px;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  display: flex;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.5s ease;
}

.progress-fill.normal { background: #00ff88; }
.progress-fill.warning { background: #ffaa00; }
.progress-fill.error { background: #ff6b6b; }

.eq-stats {
  display: flex;
  gap: 15px;
  font-size: 10px;
}

.eq-stats .normal { color: #00ff88; }
.eq-stats .warning { color: #ffaa00; }
.eq-stats .error { color: #ff6b6b; }

.eq-hint {
  margin-top: 8px;
  font-size: 11px;
  color: rgba(175, 230, 255, 0.76);
}

/* 告警区域 */
.alarm-tabs {
  display: flex;
  gap: 5px;
  margin-bottom: 10px;
}

.alarm-tab {
  padding: 5px 12px;
  background: rgba(0, 50, 100, 0.3);
  border: 1px solid rgba(0, 200, 255, 0.2);
  border-radius: 15px;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.alarm-tab:hover {
  background: rgba(0, 100, 150, 0.3);
  color: #00d4ff;
}

.alarm-tab.active {
  background: rgba(0, 200, 255, 0.2);
  border-color: rgba(0, 200, 255, 0.5);
  color: #00d4ff;
}

.alarm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
}

.alarm-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: rgba(0, 50, 100, 0.2);
  border-radius: 8px;
  border-left: 3px solid;
  transition: all 0.3s;
}

.alarm-item.critical { border-left-color: #ff6b6b; }
.alarm-item.warning { border-left-color: #ffaa00; }
.alarm-item.info { border-left-color: #00d4ff; }
.alarm-item.handled { opacity: 0.6; }

.alarm-content {
  flex: 1;
  min-width: 0;
}

.alarm-title {
  font-size: 15px;
  color: #fff;
  margin-bottom: 3px;
}

.alarm-desc {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 5px;
}

.alarm-meta {
  display: flex;
  gap: 15px;
  font-size: 11px;
  color: #666;
}

.alarm-actions {
  display: flex;
  align-items: center;
}

.action-btn {
  padding: 4px 10px;
  background: rgba(0, 200, 255, 0.2);
  border: 1px solid rgba(0, 200, 255, 0.4);
  border-radius: 4px;
  color: #00d4ff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn:hover {
  background: rgba(0, 200, 255, 0.3);
}

.handled-tag {
  font-size: 12px;
  color: #00ff88;
}

/* 安全监控 */
.security-overview {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.security-score {
  width: 80px;
  height: 80px;
}

.score-ring {
  width: 100%;
  height: 100%;
}

.score-circle {
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 1s ease;
}

.security-stats {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.sec-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sec-value {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.sec-label {
  font-size: 12px;
  color: #888;
}

/* 漏洞统计 */
.vulnerability-stats {
  margin-bottom: 15px;
}

.vuln-title, .events-title, .orders-title {
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
}

.vuln-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vuln-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vuln-label {
  font-size: 10px;
  color: #888;
  width: 30px;
}

.vuln-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.vuln-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

.vuln-item.critical .vuln-fill { background: #ff6b6b; }
.vuln-item.high .vuln-fill { background: #ff9966; }
.vuln-item.medium .vuln-fill { background: #ffaa00; }
.vuln-item.low .vuln-fill { background: #00d4ff; }

.vuln-count {
  font-size: 10px;
  color: #aaa;
  width: 20px;
  text-align: right;
}

/* 安全事件 */
.event-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.event-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: rgba(0, 50, 100, 0.2);
  border-radius: 4px;
  font-size: 12px;
}

.event-type {
  color: #00d4ff;
}

.event-user {
  color: #888;
  flex: 1;
}

.event-status {
  padding: 2px 6px;
  border-radius: 3px;
}

.event-status.成功 { background: rgba(0, 255, 136, 0.2); color: #00ff88; }
.event-status.失败 { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; }
.event-status.待审核 { background: rgba(255, 170, 0, 0.2); color: #ffaa00; }

/* 运维工单 */
.workorder-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 15px;
}

.wo-stat {
  text-align: center;
}

.wo-value {
  font-size: 24px;
  font-weight: bold;
  display: block;
}

.wo-stat.pending .wo-value { color: #ffaa00; }
.wo-stat.processing .wo-value { color: #00d4ff; }
.wo-stat.completed .wo-value { color: #00ff88; }

.wo-label {
  font-size: 12px;
  color: #888;
}

.wo-chart {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.pie-chart {
  width: 80px;
  height: 80px;
  position: relative;
}

.pie-slice {
  transform: rotate(-90deg);
  transform-origin: center;
}

.pie-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.pie-value {
  font-size: 16px;
  font-weight: bold;
  color: #00ff88;
  display: block;
}

.pie-label {
  font-size: 11px;
  color: #888;
}

.wo-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-text {
  flex: 1;
  color: #aaa;
}

.legend-count {
  color: #fff;
}

/* 最近工单 */
.order-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-item {
  padding: 8px;
  background: rgba(0, 50, 100, 0.2);
  border-radius: 6px;
}

.order-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.order-priority {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
}

.order-priority.紧急 { background: #ff6b6b; color: #fff; }
.order-priority.高 { background: #ff9966; color: #fff; }
.order-priority.中 { background: #ffaa00; color: #000; }
.order-priority.低 { background: #00d4ff; color: #000; }

.order-id {
  font-size: 12px;
  color: #666;
}

.order-title {
  font-size: 13px;
  color: #fff;
  margin-bottom: 5px;
}

.order-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.order-meta span:first-child {
  color: #888;
}

.order-status {
  padding: 2px 6px;
  border-radius: 3px;
}

.order-status.待处理 { background: rgba(255, 170, 0, 0.2); color: #ffaa00; }
.order-status.处理中 { background: rgba(0, 200, 255, 0.2); color: #00d4ff; }
.order-status.已完成 { background: rgba(0, 255, 136, 0.2); color: #00ff88; }
.order-status.已关闭 { background: rgba(255, 255, 255, 0.1); color: #888; }

.device-dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(2, 8, 20, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 120;
  backdrop-filter: blur(8px);
}

.device-dialog {
  width: min(920px, calc(100vw - 60px));
  max-height: calc(100vh - 60px);
  overflow: auto;
  border-radius: 14px;
  background: linear-gradient(180deg, #0b2340 0%, #08172a 100%);
  border: 1px solid rgba(0, 200, 255, 0.26);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.42);
  padding: 18px 20px 20px;
}

.device-dialog-header,
.device-dialog-actions,
.monitor-time-row,
.device-toolbar {
  display: flex;
  align-items: center;
}

.device-dialog-header {
  justify-content: space-between;
  gap: 16px;
}

.device-dialog-title {
  font-size: 22px;
  font-weight: 700;
  color: #f4fbff;
}

.device-dialog-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}

.device-dialog-actions {
  gap: 10px;
}

.dialog-btn {
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 200, 255, 0.25);
  background: rgba(0, 120, 170, 0.16);
  color: #dff9ff;
  cursor: pointer;
}

.device-toolbar {
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.toolbar-chip {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #e8fbff;
  background: rgba(0, 90, 130, 0.22);
  border: 1px solid rgba(0, 200, 255, 0.18);
}

.toolbar-chip.ok {
  color: #73ffb2;
}

.toolbar-chip.danger {
  color: #ffd5d5;
  background: rgba(170, 25, 25, 0.32);
  border-color: rgba(255, 90, 90, 0.4);
}

.device-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.device-summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(0, 50, 100, 0.24);
  border: 1px solid rgba(0, 200, 255, 0.14);
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.device-summary-item strong {
  color: #fff;
  font-size: 16px;
}

.monitor-chart-panel {
  margin-top: 14px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(120, 180, 255, 0.18);
}

.monitor-chart-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #e8fbff;
  text-align: center;
}

.monitor-axis-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 12px;
  color: rgba(220, 242, 255, 0.72);
}

.monitor-chart-svg {
  width: 100%;
  height: 180px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
}

.monitor-grid-line {
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 1;
}

.monitor-axis-text {
  fill: rgba(255, 255, 255, 0.74);
  font-size: 11px;
  text-anchor: start;
}

.monitor-axis-line {
  stroke: rgba(255, 255, 255, 0.16);
  stroke-width: 1;
}

.monitor-polyline {
  fill: none;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-dasharray: 6 8;
  animation: dialogLineFlow 1.6s linear infinite;
}

.monitor-time-row {
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.device-dialog-note {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(0, 90, 130, 0.14);
  border: 1px solid rgba(0, 200, 255, 0.14);
  color: rgba(235, 248, 255, 0.9);
  line-height: 1.7;
  font-size: 13px;
}

@keyframes dialogLineFlow {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -28; }
}
</style>

