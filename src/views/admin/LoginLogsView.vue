<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>登录日志</h2>
        <div class="sub">账号登录审计 · 数据来自 GET /api/admin/login-logs</div>
      </div>
      <div class="page-actions">
        <button
          class="rs-btn"
          :class="{ primary: filters.success === '0' }"
          type="button"
          @click="toggleFailedOnly"
        >
          {{ filters.success === '0' ? '✓ 只看失败' : '只看失败' }}
        </button>
        <button class="rs-btn" type="button" :disabled="loading" @click="load">刷新</button>
      </div>
    </div>

    <!-- 筛选项与 loginLogList 的 filters/searchFields 一致：success + keyword + 登录时间 -->
    <div class="filter-bar">
      <input v-model="filters.keyword" class="rs-input" placeholder="用户名 / IP / 说明" @keyup.enter="search" />
      <select v-model="filters.success" class="rs-select">
        <option value="">全部结果</option>
        <option value="1">成功</option>
        <option value="0">失败</option>
      </select>
      <input v-model="filters.dateFrom" class="rs-input date-input" type="date" title="登录时间起" />
      <span class="range-sep">至</span>
      <input v-model="filters.dateTo" class="rs-input date-input" type="date" title="登录时间止" />
      <button class="rs-btn" type="button" :disabled="loading" @click="search">查询</button>
      <button class="rs-btn" type="button" :disabled="loading" @click="reset">重置</button>
      <span class="spacer"></span>
      <span class="count-hint">共 <b>{{ total }}</b> 条</span>
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
      <template #cell-ip="{ row }">{{ row.ip || '-' }}</template>
      <template #cell-success="{ row }">
        <span class="rs-tag" :class="Number(row.success) === 1 ? 'green' : 'red'">
          {{ Number(row.success) === 1 ? '成功' : '失败' }}
        </span>
      </template>
      <template #cell-message="{ row }">{{ row.message || '-' }}</template>
      <template #cell-user_agent="{ row }">
        <span v-if="row.user_agent" class="ua-text">{{ row.user_agent }}</span>
        <span v-else>-</span>
      </template>
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
// 登录日志：GET /api/admin/login-logs（keyword/success/dateFrom/dateTo + 分页）。
// success 为 1/0 的整型列，筛选时按字符串传参（后端 str() 后直接比对列值）。
import { onMounted, reactive, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)

const filters = reactive({ keyword: '', success: '', dateFrom: '', dateTo: '' })

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/login-logs', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword,
        success: filters.success,
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

const search = () => {
  page.value = 1
  load()
}

const reset = () => {
  filters.keyword = ''
  filters.success = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  search()
}

// 快捷筛选：只看失败（success = 0）
const toggleFailedOnly = () => {
  filters.success = filters.success === '0' ? '' : '0'
  search()
}

const columns = [
  { key: 'username', title: '用户名', width: '130px' },
  { key: 'ip', title: 'IP', width: '140px' },
  { key: 'success', title: '结果', width: '85px' },
  { key: 'message', title: '说明', width: '200px', tip: true },
  { key: 'user_agent', title: 'User-Agent', tip: true },
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

onMounted(load)
</script>

<style scoped>
.code-text {
  color: var(--rs-primary);
  font-weight: bold;
}

.ua-text {
  display: inline-block;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
  color: var(--rs-text-dim);
  font-size: 12px;
}

.date-input {
  min-width: 140px;
}

.range-sep {
  font-size: 13px;
  color: var(--rs-text-dim);
}

.count-hint {
  font-size: 13px;
  color: var(--rs-text-dim);
}

.count-hint b {
  color: var(--rs-primary);
}
</style>
