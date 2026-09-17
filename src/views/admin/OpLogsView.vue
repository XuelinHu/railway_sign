<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>操作日志</h2>
        <div class="sub">管理台操作审计 · 数据来自 GET /api/admin/op-logs</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn" type="button" :disabled="loading" @click="refreshAll">刷新</button>
      </div>
    </div>

    <!-- 筛选项与 opLogList 的 filters/searchFields 一致：action / targetType + keyword + 操作时间 -->
    <div class="filter-bar">
      <input v-model="filters.keyword" class="rs-input" placeholder="用户名 / 动作 / 详情 / IP" @keyup.enter="search" />
      <select v-model="filters.action" class="rs-select">
        <option value="">全部动作</option>
        <option v-for="item in options.actions" :key="item" :value="item">{{ item }}</option>
      </select>
      <select v-model="filters.targetType" class="rs-select">
        <option value="">全部目标类型</option>
        <option v-for="item in options.targetTypes" :key="item" :value="item">
          {{ targetLabel(item) }}
        </option>
      </select>
      <input v-model="filters.dateFrom" class="rs-input date-input" type="date" title="操作时间起" />
      <span class="range-sep">至</span>
      <input v-model="filters.dateTo" class="rs-input date-input" type="date" title="操作时间止" />
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
      <template #cell-username="{ row }">
        <span class="code-text">{{ row.username || '-' }}</span>
      </template>
      <template #cell-action="{ row }">
        <span class="rs-tag blue">{{ row.action || '-' }}</span>
      </template>
      <template #cell-target_type="{ row }">{{ targetLabel(row.target_type) }}</template>
      <template #cell-target_id="{ row }">{{ row.target_id || '-' }}</template>
      <template #cell-detail="{ row }">{{ row.detail || '-' }}</template>
      <template #cell-ip="{ row }">{{ row.ip || '-' }}</template>
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
// 操作日志：GET /api/admin/op-logs（keyword/action/targetType/dateFrom/dateTo + 分页）。
// 下拉候选来自 GET /api/admin/log-options → { actions: [], targetTypes: [] }（库内 DISTINCT 值）。
import { onMounted, reactive, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'

// target_type 是英文枚举，展示时补中文标签（未收录的原样输出）
const TARGET_LABELS = {
  user: '用户',
  role: '角色',
  signal: '信号机',
  alarm: '告警',
  work_order: '工单',
  ai_session: '智能体会话',
  ai_model: '模型',
  ai: '智能体',
  config: '系统配置',
  system: '系统',
}

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)

const options = ref({ actions: [], targetTypes: [] })
const filters = reactive({ keyword: '', action: '', targetType: '', dateFrom: '', dateTo: '' })

const targetLabel = (value) => (value ? TARGET_LABELS[value] || value : '-')

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/op-logs', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword,
        action: filters.action,
        targetType: filters.targetType,
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

const loadOptions = async () => {
  try {
    const data = await http.get('/admin/log-options')
    options.value = {
      actions: data?.actions || [],
      targetTypes: data?.targetTypes || [],
    }
  } catch (e) {
    toast.error(e.message)
  }
}

const refreshAll = async () => {
  await Promise.all([load(), loadOptions()])
}

const search = () => {
  page.value = 1
  load()
}

const reset = () => {
  filters.keyword = ''
  filters.action = ''
  filters.targetType = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  search()
}

const columns = [
  { key: 'username', title: '用户名', width: '130px' },
  { key: 'action', title: '动作', width: '140px' },
  { key: 'target_type', title: '目标类型', width: '110px' },
  { key: 'target_id', title: '目标ID', width: '130px' },
  { key: 'detail', title: '详情', tip: true },
  { key: 'ip', title: 'IP', width: '140px' },
  { key: 'created_at', title: '时间', width: '170px' },
]

// ISO 时间转本地可读格式
function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

onMounted(() => {
  load()
  loadOptions()
})
</script>

<style scoped>
.code-text {
  color: var(--rs-primary);
  font-weight: bold;
}

.date-input {
  min-width: 140px;
}

.range-sep {
  font-size: 13px;
  color: var(--rs-text-dim);
}
</style>
