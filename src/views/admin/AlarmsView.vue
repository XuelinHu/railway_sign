<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>告警记录</h2>
        <div class="sub">设备告警查询与处理 · 时间筛选按发生时间（occurred_at）</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn" type="button" :disabled="loading" @click="load">刷新</button>
      </div>
    </div>

    <!-- 筛选项与 alarmList 的 filters/searchFields 一致 -->
    <div class="filter-bar">
      <input v-model="filters.keyword" class="rs-input" placeholder="告警码 / 信号机编号 / 标题 / 内容" @keyup.enter="search" />
      <select v-model="filters.level" class="rs-select">
        <option value="">全部级别</option>
        <option v-for="item in LEVEL_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <select v-model="filters.status" class="rs-select">
        <option value="">全部状态</option>
        <option v-for="item in STATUS_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <select v-model="filters.deviceType" class="rs-select">
        <option value="">全部设备类型</option>
        <option v-for="item in DEVICE_TYPE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <input v-model="filters.dateFrom" class="rs-input date-input" type="date" title="发生时间起" />
      <span class="range-sep">至</span>
      <input v-model="filters.dateTo" class="rs-input date-input" type="date" title="发生时间止" />
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
      <template #cell-code="{ row }">
        <span class="code-text">{{ row.code }}</span>
      </template>
      <template #cell-device_type="{ row }">
        {{ DEVICE_TYPE_LABELS[row.device_type] || row.device_type || '-' }}
      </template>
      <template #cell-level="{ row }">
        <span class="rs-tag" :class="LEVEL_CLASSES[row.level] || 'gray'">{{ LEVEL_LABELS[row.level] || row.level }}</span>
      </template>
      <template #cell-status="{ row }">
        <span class="rs-tag" :class="STATUS_CLASSES[row.status] || 'gray'">{{ STATUS_LABELS[row.status] || row.status }}</span>
      </template>
      <template #cell-occurred_at="{ row }">{{ formatTime(row.occurred_at) }}</template>
      <template #cell-handled_by="{ row }">{{ row.handled_by || '-' }}</template>
      <template #cell-handled_at="{ row }">{{ formatTime(row.handled_at) }}</template>
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button class="rs-btn small" type="button" @click="openHandle(row)">处理</button>
          <button class="rs-btn small" type="button" @click="openDetail(row)">详情</button>
        </div>
      </template>
    </DataTable>

    <Pagination
      v-model:page="page"
      v-model:pageSize="pageSize"
      :total="total"
      :total-pages="totalPages"
      @change="load"
    />

    <!-- 处理告警：状态取值与 handleAlarm 白名单一致 -->
    <AppModal v-model="handleVisible" title="处理告警" width="560px" :close-on-mask="!submitting">
      <div v-if="handleTarget" class="target-box">
        <div class="target-row">
          <span class="rs-tag" :class="LEVEL_CLASSES[handleTarget.level] || 'gray'">
            {{ LEVEL_LABELS[handleTarget.level] || handleTarget.level }}
          </span>
          <span class="target-code">{{ handleTarget.code }}</span>
          <span class="target-signal">信号机 {{ handleTarget.signal_code || '-' }}</span>
        </div>
        <div class="target-title">{{ handleTarget.title }}</div>
        <div class="target-content">{{ handleTarget.content || '无详细描述' }}</div>
        <div v-if="handleTarget.suggestion" class="target-suggestion">💡 {{ handleTarget.suggestion }}</div>
      </div>

      <div class="rs-field">
        <label>处理状态 <span class="req">*</span></label>
        <select v-model="handleForm.status" class="rs-select">
          <option v-for="item in STATUS_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </div>
      <div class="rs-field">
        <label>处理人</label>
        <input v-model="handleForm.handled_by" class="rs-input" placeholder="默认记录为当前登录账号" />
      </div>
      <div class="rs-field">
        <label>处理备注</label>
        <textarea v-model="handleForm.remark" class="rs-textarea" placeholder="填写处理过程、结果或遗留问题"></textarea>
      </div>

      <template #footer>
        <button class="rs-btn" type="button" :disabled="submitting" @click="handleVisible = false">取消</button>
        <button class="rs-btn primary" type="button" :disabled="submitting" @click="submitHandle">
          {{ submitting ? '提交中…' : '提交处理' }}
        </button>
      </template>
    </AppModal>

    <!-- 告警详情 -->
    <AppModal v-model="detailVisible" title="告警详情" width="560px">
      <div v-if="detailTarget" class="detail-list">
        <div class="detail-row"><span class="detail-label">告警码</span><span class="detail-value">{{ detailTarget.code }}</span></div>
        <div class="detail-row"><span class="detail-label">信号机</span><span class="detail-value">{{ detailTarget.signal_code || '-' }}</span></div>
        <div class="detail-row">
          <span class="detail-label">设备类型</span>
          <span class="detail-value">{{ DEVICE_TYPE_LABELS[detailTarget.device_type] || detailTarget.device_type || '-' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">级别</span>
          <span class="detail-value">
            <span class="rs-tag" :class="LEVEL_CLASSES[detailTarget.level] || 'gray'">
              {{ LEVEL_LABELS[detailTarget.level] || detailTarget.level }}
            </span>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">状态</span>
          <span class="detail-value">
            <span class="rs-tag" :class="STATUS_CLASSES[detailTarget.status] || 'gray'">
              {{ STATUS_LABELS[detailTarget.status] || detailTarget.status }}
            </span>
          </span>
        </div>
        <div class="detail-row"><span class="detail-label">标题</span><span class="detail-value">{{ detailTarget.title }}</span></div>
        <div class="detail-row"><span class="detail-label">内容</span><span class="detail-value">{{ detailTarget.content || '-' }}</span></div>
        <div class="detail-row"><span class="detail-label">处理建议</span><span class="detail-value">{{ detailTarget.suggestion || '-' }}</span></div>
        <div class="detail-row"><span class="detail-label">来源</span><span class="detail-value">{{ detailTarget.source || '-' }}</span></div>
        <div class="detail-row"><span class="detail-label">发生时间</span><span class="detail-value">{{ formatTime(detailTarget.occurred_at) }}</span></div>
        <div class="detail-row"><span class="detail-label">处理人</span><span class="detail-value">{{ detailTarget.handled_by || '-' }}</span></div>
        <div class="detail-row"><span class="detail-label">处理时间</span><span class="detail-value">{{ formatTime(detailTarget.handled_at) }}</span></div>
        <div class="detail-row"><span class="detail-label">处理备注</span><span class="detail-value">{{ detailTarget.remark || '-' }}</span></div>
      </div>
      <template #footer>
        <button class="rs-btn" type="button" @click="detailVisible = false">关闭</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
// 告警记录：GET /api/admin/alarms（keyword/level/status/deviceType/dateFrom/dateTo + 分页）。
// 处理接口 PUT /api/admin/alarms/:id/handle，状态白名单见 server/api/routes/admin.js 的 handleAlarm。
import { onMounted, reactive, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import { authState } from '../../services/auth.js'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'
import AppModal from '../../components/common/AppModal.vue'

const LEVEL_OPTIONS = [
  { value: 'critical', label: '严重' },
  { value: 'major', label: '重要' },
  { value: 'minor', label: '次要' },
  { value: 'info', label: '提示' },
]
const LEVEL_LABELS = { critical: '严重', major: '重要', minor: '次要', info: '提示' }
const LEVEL_CLASSES = { critical: 'red', major: 'orange', minor: 'blue', info: 'gray' }

// 状态取值与 alarms.status 默认值、种子数据及 handleAlarm 白名单一致
const STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'handling', label: '处理中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
]
const STATUS_LABELS = { pending: '待处理', handling: '处理中', resolved: '已解决', closed: '已关闭' }
const STATUS_CLASSES = { pending: 'red', handling: 'orange', resolved: 'green', closed: 'gray' }

const DEVICE_TYPE_OPTIONS = [
  { value: 'signal', label: '信号机' },
  { value: 'track', label: '轨道电路' },
  { value: 'switch', label: '道岔' },
  { value: 'power', label: '电源屏' },
]
const DEVICE_TYPE_LABELS = { signal: '信号机', track: '轨道电路', switch: '道岔', power: '电源屏' }

const loading = ref(false)
const submitting = ref(false)
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)

const filters = reactive({ keyword: '', level: '', status: '', deviceType: '', dateFrom: '', dateTo: '' })

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/alarms', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword,
        level: filters.level,
        status: filters.status,
        deviceType: filters.deviceType,
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
  filters.level = ''
  filters.status = ''
  filters.deviceType = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  search()
}

// —— 处理告警 ——
const handleVisible = ref(false)
const handleTarget = ref(null)
const handleForm = reactive({ status: 'handling', handled_by: '', remark: '' })

const openHandle = (row) => {
  handleTarget.value = row
  handleForm.status = row.status === 'pending' ? 'handling' : row.status
  handleForm.handled_by = row.handled_by || authState.user?.name || authState.user?.username || ''
  handleForm.remark = row.remark || ''
  handleVisible.value = true
}

const submitHandle = async () => {
  if (submitting.value || !handleTarget.value) return
  submitting.value = true
  try {
    await http.put(`/admin/alarms/${handleTarget.value.id}/handle`, {
      status: handleForm.status,
      handled_by: handleForm.handled_by.trim(),
      remark: handleForm.remark.trim(),
    })
    toast.success('告警已处理')
    handleVisible.value = false
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

// —— 详情 ——
const detailVisible = ref(false)
const detailTarget = ref(null)

const openDetail = (row) => {
  detailTarget.value = row
  detailVisible.value = true
}

const columns = [
  { key: 'code', title: '告警码', width: '130px' },
  { key: 'signal_code', title: '信号机', width: '100px' },
  { key: 'device_type', title: '设备类型', width: '100px' },
  { key: 'level', title: '级别', width: '85px' },
  { key: 'title', title: '标题', width: '200px' },
  { key: 'content', title: '内容', tip: true },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'occurred_at', title: '发生时间', width: '170px' },
  { key: 'handled_by', title: '处理人', width: '100px' },
  { key: 'handled_at', title: '处理时间', width: '170px' },
  { key: 'actions', title: '操作', width: '140px' },
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

.date-input {
  min-width: 140px;
}

.range-sep {
  font-size: 13px;
  color: var(--rs-text-dim);
}

/* 处理弹窗中的告警摘要 */
.target-box {
  padding: 12px 14px;
  margin-bottom: 14px;
  background: rgba(0, 40, 70, 0.45);
  border: 1px solid var(--rs-panel-border);
  border-radius: var(--rs-radius);
}

.target-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.target-code {
  color: var(--rs-primary);
  font-weight: bold;
  font-size: 13px;
}

.target-signal {
  font-size: 12px;
  color: var(--rs-text-dim);
}

.target-title {
  font-size: 14px;
  color: var(--rs-text-strong);
  margin-bottom: 6px;
}

.target-content {
  font-size: 13px;
  color: var(--rs-text);
  line-height: 1.7;
}

.target-suggestion {
  margin-top: 8px;
  font-size: 12px;
  color: #ffce7a;
  line-height: 1.6;
}

/* 详情弹窗 */
.detail-list {
  display: flex;
  flex-direction: column;
}

.detail-row {
  display: flex;
  gap: 12px;
  padding: 9px 2px;
  border-bottom: 1px solid rgba(0, 200, 255, 0.1);
  font-size: 13px;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  width: 84px;
  flex-shrink: 0;
  color: var(--rs-text-dim);
}

.detail-value {
  flex: 1;
  color: var(--rs-text);
  line-height: 1.7;
  word-break: break-all;
}
</style>
