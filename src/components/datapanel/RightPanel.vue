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
          v-for="eq in equipment"
          :key="eq.type"
          class="equipment-item"
        >
          <div class="eq-header">
            <span class="eq-icon">{{ equipmentIcon(eq.icon) }}</span>
            <span class="eq-name">{{ eq.type }}</span>
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

const tickerItems = [
  '西南山地上行咽喉区间出现轻雾，当前设备标识已脱敏展示。',
  '北侧桥隧结合段风速维持 3 级以内，轨旁箱体湿度处于正常范围。',
  '东坡隧道口至谷地缓坡区间采用匿名区段编码，不展示真实站名与真实人员信息。',
  '坡脚联络线信号机巡检记录为演示数据，检修班组名称已做泛化处理。',
  '临水弯道区段视频巡检为模拟画面，地理描述保留地貌特征但不对应真实坐标。',
  '上行 K 区段传感器在线率稳定，面板内设备编号为资产脱敏编码。',
  '高填方路基边坡监测数据来自本地仿真，不含真实单位名称与真实位置。'
]

const tickerItemsLoop = computed(() => [...tickerItems, ...tickerItems])


// 告警标签
const alarmTabs = [
  { label: '全部', value: 'all' },
  { label: '严重', value: 'critical' },
  { label: '警告', value: 'warning' },
  { label: '信息', value: 'info' }
]

// 设备统计
const totalDevices = computed(() => equipment.value.reduce((sum, eq) => sum + eq.total, 0))
const normalDevices = computed(() => equipment.value.reduce((sum, eq) => sum + eq.normal, 0))
const warningDevices = computed(() => equipment.value.reduce((sum, eq) => sum + eq.warning, 0))
const errorDevices = computed(() => equipment.value.reduce((sum, eq) => sum + eq.error, 0))

// 告警数量
const alarmCount = computed(() => alarms.value.filter(a => !a.handled).length)

// 过滤告警
const filteredAlarms = computed(() => {
  if (activeAlarmTab.value === 'all') return alarms.value.slice(0, 6)
  return alarms.value.filter(a => a.level === activeAlarmTab.value).slice(0, 6)
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
  updateTimer.value = setInterval(() => {
    equipment.value = getEquipmentData()
    alarms.value = getAlarmData()
    security.value = getSecurityData()
    workOrders.value = getWorkOrderData()
  }, 5000)
})

onUnmounted(() => {
  if (updateTimer.value) {
    clearInterval(updateTimer.value)
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
</style>

