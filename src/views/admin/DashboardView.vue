<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>概览统计</h2>
        <div class="sub">系统运行总览 · 数据来源 GET /api/admin/overview</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn" type="button" :disabled="loading" @click="load">
          {{ loading ? '刷新中…' : '刷新数据' }}
        </button>
      </div>
    </div>

    <!-- 统计卡片：字段与接口 stats 一一对应 -->
    <div class="stat-grid">
      <div v-for="card in statCards" :key="card.label" class="stat-card">
        <div class="label">{{ card.icon }} {{ card.label }}</div>
        <div class="value">
          {{ num(card.value) }}<span v-if="card.unit" class="unit">{{ card.unit }}</span>
        </div>
      </div>
    </div>

    <!-- 趋势图：纯 CSS 柱状图，避免引入 ECharts 实例 -->
    <div class="chart-row">
      <div class="chart-panel">
        <div class="chart-head">
          <span class="chart-title">📈 近 14 天告警趋势</span>
          <span class="chart-meta">共 {{ num(stats.alarmTotal) }} 条告警</span>
        </div>
        <div v-if="alarmBars.length" class="bars">
          <div
            v-for="bar in alarmBars"
            :key="bar.day"
            class="bar-col"
            :title="`${bar.day}：${bar.total} 条`"
          >
            <span class="bar-value">{{ bar.total }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ height: bar.height + '%' }"></div>
            </div>
            <span class="bar-label">{{ bar.label }}</span>
          </div>
        </div>
        <div v-else class="chart-empty">暂无趋势数据</div>
      </div>

      <div class="chart-panel">
        <div class="chart-head">
          <span class="chart-title">🔑 近 14 天登录趋势</span>
          <span class="chart-meta">
            <span class="dot ok"></span>成功 {{ num(stats.loginToday) }}
            <span class="dot bad"></span>失败 {{ num(stats.loginFailedToday) }}
          </span>
        </div>
        <div v-if="loginBars.length" class="bars">
          <div
            v-for="bar in loginBars"
            :key="bar.day"
            class="bar-col"
            :title="`${bar.day}：成功 ${bar.success} / 失败 ${bar.failed}`"
          >
            <span class="bar-value">{{ bar.success + bar.failed }}</span>
            <div class="bar-track stacked">
              <div class="bar-fill failed" :style="{ height: bar.failedHeight + '%' }"></div>
              <div class="bar-fill success" :style="{ height: bar.successHeight + '%' }"></div>
            </div>
            <span class="bar-label">{{ bar.label }}</span>
          </div>
        </div>
        <div v-else class="chart-empty">暂无趋势数据</div>
      </div>
    </div>

    <!-- 分布：接口返回的 GROUP BY 结果 -->
    <div class="dist-row">
      <div class="dist-panel">
        <div class="dist-title">告警级别分布</div>
        <div class="dist-list">
          <span v-for="item in alarmLevels" :key="item.level" class="rs-tag" :class="levelClass(item.level)">
            {{ levelLabel(item.level) }} {{ num(item.total) }}
          </span>
          <span v-if="!alarmLevels.length" class="dist-empty">暂无数据</span>
        </div>
      </div>
      <div class="dist-panel">
        <div class="dist-title">告警状态分布</div>
        <div class="dist-list">
          <span v-for="item in alarmStatus" :key="item.status" class="rs-tag" :class="alarmStatusClass(item.status)">
            {{ alarmStatusLabel(item.status) }} {{ num(item.total) }}
          </span>
          <span v-if="!alarmStatus.length" class="dist-empty">暂无数据</span>
        </div>
      </div>
      <div class="dist-panel">
        <div class="dist-title">设备类型分布</div>
        <div class="dist-list">
          <span v-for="item in deviceTypes" :key="item.device_type" class="rs-tag blue">
            {{ deviceTypeLabel(item.device_type) }} {{ num(item.total) }}
          </span>
          <span v-if="!deviceTypes.length" class="dist-empty">暂无数据</span>
        </div>
      </div>
      <div class="dist-panel">
        <div class="dist-title">用户角色分布</div>
        <div class="dist-list">
          <span v-for="item in roleSummary" :key="item.role" class="rs-tag" :class="roleClass(item.role)">
            {{ roleLabel(item.role) }} {{ num(item.total) }}
          </span>
          <span v-if="!roleSummary.length" class="dist-empty">暂无数据</span>
        </div>
      </div>
    </div>

    <!-- 最近告警：接口已 LIMIT 6，不再分页 -->
    <div class="rs-panel section-panel">
      <div class="section-head">
        <h3>最近告警</h3>
        <router-link class="rs-btn small" to="/admin/alarms">查看全部</router-link>
      </div>
      <DataTable
        :columns="alarmColumns"
        :rows="recentAlarms"
        :loading="loading"
        row-key="id"
        :index="true"
      >
        <template #cell-level="{ row }">
          <span class="rs-tag" :class="levelClass(row.level)">{{ levelLabel(row.level) }}</span>
        </template>
        <template #cell-status="{ row }">
          <span class="rs-tag" :class="alarmStatusClass(row.status)">{{ alarmStatusLabel(row.status) }}</span>
        </template>
      </DataTable>
    </div>

    <div class="chart-row">
      <!-- 最近登录：登录日志接口的最近 6 条 -->
      <div class="rs-panel section-panel">
        <div class="section-head">
          <h3>最近登录</h3>
          <router-link class="rs-btn small" to="/admin/logs/login">查看全部</router-link>
        </div>
        <DataTable :columns="loginColumns" :rows="recentLogins" :loading="loading" row-key="id" :index="false">
          <template #cell-success="{ row }">
            <span class="rs-tag" :class="row.success ? 'green' : 'red'">{{ row.success ? '成功' : '失败' }}</span>
          </template>
        </DataTable>
      </div>

      <div class="rs-panel section-panel">
        <div class="section-head">
          <h3>最近智能体会话</h3>
          <router-link class="rs-btn small" to="/admin/ai/sessions">查看全部</router-link>
        </div>
        <DataTable :columns="sessionColumns" :rows="recentSessions" :loading="loading" row-key="id" :index="false">
          <template #cell-model="{ row }">
            <span class="rs-tag blue">{{ row.model || '-' }}</span>
          </template>
        </DataTable>
      </div>
    </div>
  </div>
</template>

<script setup>
// 概览统计：字段名全部按 server/api/routes/admin.js 的 overview 处理器返回结构。
import { computed, onMounted, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'

const loading = ref(false)
const stats = ref({})
const alarmLevels = ref([])
const alarmStatus = ref([])
const deviceTypes = ref([])
const alarmTrend = ref([])
const loginTrend = ref([])
const recentAlarms = ref([])
const recentLogins = ref([])
const recentSessions = ref([])
const roleSummary = ref([])

const num = (value) => Number(value || 0).toLocaleString('zh-CN')

const load = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const data = await http.get('/admin/overview')
    stats.value = data?.stats || {}
    alarmLevels.value = data?.alarmLevels || []
    alarmStatus.value = data?.alarmStatus || []
    deviceTypes.value = data?.deviceTypes || []
    alarmTrend.value = data?.alarmTrend || []
    loginTrend.value = data?.loginTrend || []
    recentAlarms.value = data?.recentAlarms || []
    recentLogins.value = data?.recentLogins || []
    recentSessions.value = data?.recentSessions || []
    roleSummary.value = data?.roleSummary || []
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

// —— 统计卡片 ——
const statCards = computed(() => [
  { icon: '👥', label: '用户总数', value: stats.value.userTotal },
  { icon: '✅', label: '启用用户', value: stats.value.userActive },
  { icon: '🆕', label: '今日新增用户', value: stats.value.userToday },
  { icon: '🚦', label: '信号机总数', value: stats.value.signalTotal },
  { icon: '📶', label: '在线信号机', value: stats.value.signalOnline },
  { icon: '📴', label: '离线信号机', value: stats.value.signalOffline },
  { icon: '⚠️', label: '未处理告警', value: stats.value.alarmPending },
  { icon: '🔔', label: '告警总数', value: stats.value.alarmTotal },
  { icon: '📅', label: '今日告警', value: stats.value.alarmToday },
  { icon: '🧰', label: '工单总数', value: stats.value.orderTotal },
  { icon: '⏳', label: '待处理工单', value: stats.value.orderPending },
  { icon: '📡', label: '遥测记录', value: stats.value.telemetryTotal },
  { icon: '💬', label: '智能体会话', value: stats.value.aiSessionTotal },
  { icon: '✉️', label: '智能体消息', value: stats.value.aiMessageTotal },
  { icon: '🔑', label: '今日登录成功', value: stats.value.loginToday },
  { icon: '🚫', label: '今日登录失败', value: stats.value.loginFailedToday },
])

// —— 趋势柱状图（纯 CSS，高度按最大值百分比） ——
const dayLabel = (day) => String(day || '').slice(5)

const alarmBars = computed(() => {
  const rows = alarmTrend.value
  const max = Math.max(1, ...rows.map((row) => Number(row.total) || 0))
  return rows.map((row) => ({
    day: row.day,
    label: dayLabel(row.day),
    total: Number(row.total) || 0,
    height: Math.max(2, Math.round(((Number(row.total) || 0) / max) * 100)),
  }))
})

const loginBars = computed(() => {
  const rows = loginTrend.value
  const totals = rows.map((row) => (Number(row.success) || 0) + (Number(row.failed) || 0))
  const max = Math.max(1, ...totals)
  return rows.map((row) => {
    const success = Number(row.success) || 0
    const failed = Number(row.failed) || 0
    return {
      day: row.day,
      label: dayLabel(row.day),
      success,
      failed,
      successHeight: Math.max(success ? 2 : 0, Math.round((success / max) * 100)),
      failedHeight: Math.max(failed ? 2 : 0, Math.round((failed / max) * 100)),
    }
  })
})

// —— 文案与配色映射（取值来自 db.js 种子数据） ——
const LEVEL_LABELS = { critical: '严重', major: '重要', minor: '次要', info: '提示' }
const LEVEL_CLASSES = { critical: 'red', major: 'orange', minor: 'blue', info: 'gray' }
const levelLabel = (level) => LEVEL_LABELS[level] || level || '-'
const levelClass = (level) => LEVEL_CLASSES[level] || 'gray'

const ALARM_STATUS_LABELS = { pending: '待处理', handling: '处理中', resolved: '已解决', closed: '已关闭' }
const ALARM_STATUS_CLASSES = { pending: 'red', handling: 'orange', resolved: 'green', closed: 'gray' }
const alarmStatusLabel = (status) => ALARM_STATUS_LABELS[status] || status || '-'
const alarmStatusClass = (status) => ALARM_STATUS_CLASSES[status] || 'gray'

const DEVICE_TYPE_LABELS = { signal: '信号机', track: '轨道电路', switch: '道岔', power: '电源屏' }
const deviceTypeLabel = (type) => DEVICE_TYPE_LABELS[type] || type || '-'

const ROLE_LABELS = { admin: '超级管理员', operator: '运维人员', user: '普通用户' }
const ROLE_CLASSES = { admin: 'orange', operator: 'blue', user: 'gray' }
const roleLabel = (role) => ROLE_LABELS[role] || role || '-'
const roleClass = (role) => ROLE_CLASSES[role] || 'gray'

// —— 表格列 ——
const alarmColumns = [
  { key: 'code', title: '告警码', width: '130px' },
  { key: 'signal_code', title: '信号机', width: '100px' },
  { key: 'level', title: '级别', width: '90px' },
  { key: 'title', title: '标题', tip: true },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'occurred_at', title: '发生时间', width: '170px', format: (value) => formatTime(value) },
  { key: 'handled_by', title: '处理人', width: '100px' },
]

const loginColumns = [
  { key: 'username', title: '用户名', width: '110px' },
  { key: 'ip', title: 'IP', width: '130px' },
  { key: 'success', title: '结果', width: '80px' },
  { key: 'created_at', title: '登录时间', width: '170px', format: (value) => formatTime(value) },
]

const sessionColumns = [
  { key: 'title', title: '会话标题', tip: true },
  { key: 'username', title: '用户', width: '110px' },
  { key: 'model', title: '模型', width: '150px' },
  { key: 'message_count', title: '消息数', width: '80px', align: 'center' },
  { key: 'updated_at', title: '更新时间', width: '170px', format: (value) => formatTime(value) },
]

// ISO 时间转本地可读格式
function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

onMounted(load)
</script>

<style scoped>
.chart-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 14px;
}

.chart-panel {
  padding: 14px 16px;
  background: var(--rs-panel-bg);
  border: 1px solid var(--rs-panel-border);
  border-radius: var(--rs-radius);
  backdrop-filter: blur(10px);
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.chart-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--rs-text-strong);
}

.chart-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--rs-text-dim);
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.ok {
  background: var(--rs-success);
}

.dot.bad {
  background: var(--rs-danger);
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 180px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.bar-col {
  flex: 1;
  min-width: 26px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.bar-value {
  font-size: 11px;
  color: var(--rs-primary);
}

.bar-track {
  flex: 1;
  width: 100%;
  max-width: 34px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: rgba(0, 60, 100, 0.35);
  border-radius: 4px 4px 0 0;
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  background: var(--rs-gradient);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
}

.bar-track.stacked .bar-fill {
  border-radius: 0;
}

.bar-fill.success {
  background: linear-gradient(180deg, #22c55e, #14804a);
}

.bar-fill.failed {
  background: linear-gradient(180deg, #ff4d5e, #99222d);
}

.bar-label {
  font-size: 10px;
  color: var(--rs-text-dim);
  white-space: nowrap;
  transform: scale(0.9);
}

.chart-empty {
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--rs-text-dim);
}

/* —— 分布面板 —— */
.dist-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.dist-panel {
  padding: 12px 14px;
  background: var(--rs-panel-bg);
  border: 1px solid var(--rs-panel-border);
  border-radius: var(--rs-radius);
}

.dist-title {
  font-size: 13px;
  color: var(--rs-text-dim);
  margin-bottom: 10px;
}

.dist-list {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dist-empty {
  font-size: 12px;
  color: rgba(127, 163, 184, 0.75);
}

/* —— 区块面板 —— */
.section-panel {
  padding: 14px 16px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.section-head h3 {
  font-size: 14px;
  font-weight: bold;
  color: var(--rs-text-strong);
}

.section-head a.rs-btn {
  text-decoration: none;
}

@media (max-width: 720px) {
  .chart-row {
    grid-template-columns: 1fr;
  }
}
</style>
