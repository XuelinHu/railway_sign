<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>遥测记录</h2>
        <div class="sub">行人预警雷达上报数据 · 数据来自 GET /api/admin/telemetry</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn primary" type="button" :disabled="loading || statsLoading" @click="refreshAll">
          {{ loading || statsLoading ? '刷新中…' : '🔄 刷新' }}
        </button>
      </div>
    </div>

    <!-- 统计来自 GET /api/admin/telemetry/stats 的真实字段 -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">记录总数</div>
        <div class="value">{{ stats.total }}<span class="unit">条</span></div>
      </div>
      <div class="stat-card">
        <div class="label">近 24 小时上报</div>
        <div class="value">{{ stats.last24h }}<span class="unit">条</span></div>
      </div>
      <div class="stat-card">
        <div class="label">水位触发次数</div>
        <div class="value warn">{{ stats.waterAlerts }}<span class="unit">次</span></div>
      </div>
      <div class="stat-card">
        <div class="label">监测设备数</div>
        <div class="value">{{ stats.devices.length }}<span class="unit">台</span></div>
      </div>
      <div class="stat-card">
        <div class="label">设备最近距离</div>
        <div class="value">{{ nearestDistance }}<span class="unit">m</span></div>
      </div>
    </div>

    <!-- 设备维度概况：devices[].device_id / device / total / last_at / min_distance -->
    <div v-if="stats.devices.length" class="device-strip">
      <div v-for="item in stats.devices" :key="item.device_id" class="device-chip">
        <div class="chip-title">{{ item.device || item.device_id }}</div>
        <div class="chip-body">
          <span class="rs-tag blue">{{ item.device_id }}</span>
          <span class="chip-text">上报 {{ item.total }} 条</span>
          <span class="chip-text">最近 {{ formatDistance(item.min_distance) }}</span>
        </div>
        <div class="chip-time">最近上报 {{ formatTime(item.last_at) }}</div>
      </div>
    </div>

    <!-- 筛选项与 telemetryList 的 filters/searchFields 一致：deviceId / waterActive + keyword + 入库时间 -->
    <div class="filter-bar">
      <input v-model="filters.keyword" class="rs-input" placeholder="设备号 / 设备名 / wifi_ip" @keyup.enter="search" />
      <select v-model="filters.deviceId" class="rs-select">
        <option value="">全部设备</option>
        <option v-for="item in stats.devices" :key="item.device_id" :value="item.device_id">
          {{ item.device || item.device_id }}
        </option>
      </select>
      <select v-model="filters.waterActive" class="rs-select">
        <option value="">全部水位状态</option>
        <option value="1">水位触发</option>
        <option value="0">水位正常</option>
      </select>
      <input v-model="filters.dateFrom" class="rs-input date-input" type="date" title="入库时间起" />
      <span class="range-sep">至</span>
      <input v-model="filters.dateTo" class="rs-input date-input" type="date" title="入库时间止" />
      <button class="rs-btn" type="button" :disabled="loading" @click="search">查询</button>
      <button class="rs-btn" type="button" :disabled="loading" @click="reset">重置</button>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      row-key="id"
      :index="true"
      :index-base="(page - 1) * pageSize"
    >
      <template #cell-device_id="{ row }">
        <span class="code-text">{{ row.device_id }}</span>
      </template>
      <template #cell-distance_cm="{ row }">{{ formatNumber(row.distance_cm, 1) }}</template>
      <template #cell-distance_m="{ row }">{{ formatNumber(row.distance_m, 2) }}</template>
      <template #cell-water_active="{ row }">
        <span class="rs-tag" :class="waterClass(row.water_active)">{{ waterLabel(row.water_active) }}</span>
      </template>
      <template #cell-wifi_ip="{ row }">{{ row.wifi_ip || '-' }}</template>
      <template #cell-ts_ms="{ row }">{{ formatTime(row.ts_ms) }}</template>
      <template #cell-created_at="{ row }">{{ formatTime(row.created_at) }}</template>
    </DataTable>

    <Pagination
      v-model:page="page"
      v-model:pageSize="pageSize"
      :total="total"
      :total-pages="totalPages"
      @change="load"
    />
  </div>
</template>

<script setup>
// 遥测记录：GET /api/admin/telemetry（keyword/deviceId/waterActive/dateFrom/dateTo + 分页）。
// 统计 GET /api/admin/telemetry/stats 返回 { total, last24h, waterAlerts, devices[] }。
import { computed, onMounted, reactive, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'

const loading = ref(false)
const statsLoading = ref(false)
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)

const stats = ref({ total: 0, last24h: 0, waterAlerts: 0, devices: [] })

const filters = reactive({ keyword: '', deviceId: '', waterActive: '', dateFrom: '', dateTo: '' })

// 设备维度里的最小距离（单位 cm），换算成米展示
const nearestDistance = computed(() => {
  const list = stats.value.devices || []
  const values = list.map((item) => Number(item.min_distance)).filter((value) => Number.isFinite(value) && value > 0)
  if (!values.length) return '-'
  return (Math.min(...values) / 100).toFixed(2)
})

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/telemetry', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword,
        deviceId: filters.deviceId,
        waterActive: filters.waterActive,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
    })
    rows.value = data?.list || []
    total.value = Number(data?.total || 0)
    totalPages.value = Number(data?.totalPages || 1)
    if (page.value > totalPages.value) {
      page.value = totalPages.value
      await load()
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  statsLoading.value = true
  try {
    const data = await http.get('/admin/telemetry/stats')
    stats.value = {
      total: Number(data?.total || 0),
      last24h: Number(data?.last24h || 0),
      waterAlerts: Number(data?.waterAlerts || 0),
      devices: data?.devices || [],
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    statsLoading.value = false
  }
}

const refreshAll = async () => {
  await Promise.all([load(), loadStats()])
}

const search = () => {
  page.value = 1
  load()
}

const reset = () => {
  filters.keyword = ''
  filters.deviceId = ''
  filters.waterActive = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  search()
}

const waterLabel = (value) => {
  if (value === null || value === undefined) return '未知'
  return Number(value) === 1 ? '触发' : '正常'
}

const waterClass = (value) => {
  if (value === null || value === undefined) return 'gray'
  return Number(value) === 1 ? 'orange' : 'green'
}

const formatNumber = (value, digits = 1) => {
  const num = Number(value)
  if (value === null || value === undefined || !Number.isFinite(num)) return '-'
  return num.toFixed(digits)
}

const formatDistance = (value) => {
  const num = Number(value)
  if (value === null || value === undefined || !Number.isFinite(num)) return '-'
  return `${(num / 100).toFixed(2)} m`
}

const columns = [
  { key: 'device_id', title: '设备号', width: '130px' },
  { key: 'device', title: '设备名', width: '180px', tip: true },
  { key: 'distance_cm', title: '距离(cm)', width: '100px', align: 'right' },
  { key: 'distance_m', title: '距离(m)', width: '100px', align: 'right' },
  { key: 'water_active', title: '水位状态', width: '105px' },
  { key: 'wifi_ip', title: 'wifi_ip', width: '130px' },
  { key: 'ts_ms', title: '设备时间', width: '170px' },
  { key: 'created_at', title: '入库时间', width: '170px' },
]

// ISO 时间 / 毫秒时间戳转本地可读格式
function formatTime(value) {
  if (value === null || value === undefined || value === '') return '-'
  const date = new Date(typeof value === 'number' ? value : String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

onMounted(() => {
  load()
  loadStats()
})
</script>

<style scoped>
.code-text {
  color: var(--rs-primary);
  font-weight: bold;
}

.stat-card .value.warn {
  color: var(--rs-warning);
  text-shadow: 0 0 16px rgba(245, 166, 35, 0.4);
}

/* 设备维度概况：横向卡片条 */
.device-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.device-chip {
  padding: 12px 14px;
  background: var(--rs-panel-bg);
  border: 1px solid var(--rs-panel-border);
  border-radius: var(--rs-radius);
}

.chip-title {
  font-size: 13px;
  font-weight: bold;
  color: var(--rs-text-strong);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-body {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chip-text {
  font-size: 12px;
  color: var(--rs-text-dim);
}

.chip-time {
  margin-top: 8px;
  font-size: 11px;
  color: rgba(127, 163, 184, 0.75);
}

.date-input {
  min-width: 140px;
}

.range-sep {
  font-size: 13px;
  color: var(--rs-text-dim);
}
</style>
