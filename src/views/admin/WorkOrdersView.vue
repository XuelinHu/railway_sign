<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>工单管理</h2>
        <div class="sub">工单派发与闭环跟踪 · 数据来自 GET /api/admin/work-orders</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn" type="button" :disabled="loading" @click="load">刷新</button>
        <button class="rs-btn primary" type="button" @click="openCreate">➕ 新增工单</button>
      </div>
    </div>

    <!-- 筛选项与 orderList 的 filters/searchFields 一致：status / priority / type + keyword + 创建时间 -->
    <div class="filter-bar">
      <input
        v-model="filters.keyword"
        class="rs-input"
        placeholder="工单号 / 标题 / 处理人 / 车站 / 关联告警"
        @keyup.enter="search"
      />
      <select v-model="filters.status" class="rs-select">
        <option value="">全部状态</option>
        <option v-for="item in STATUS_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <select v-model="filters.priority" class="rs-select">
        <option value="">全部优先级</option>
        <option v-for="item in PRIORITY_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <select v-model="filters.type" class="rs-select">
        <option value="">全部类型</option>
        <option v-for="item in TYPE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <input v-model="filters.dateFrom" class="rs-input date-input" type="date" title="创建时间起" />
      <span class="range-sep">至</span>
      <input v-model="filters.dateTo" class="rs-input date-input" type="date" title="创建时间止" />
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
      <template #cell-type="{ row }">
        <span class="rs-tag gray">{{ row.type || '-' }}</span>
      </template>
      <template #cell-priority="{ row }">
        <span class="rs-tag" :class="PRIORITY_CLASSES[row.priority] || 'gray'">
          {{ PRIORITY_LABELS[row.priority] || row.priority || '-' }}
        </span>
      </template>
      <template #cell-status="{ row }">
        <span class="rs-tag" :class="STATUS_CLASSES[row.status] || 'gray'">
          {{ STATUS_LABELS[row.status] || row.status || '-' }}
        </span>
      </template>
      <template #cell-assignee="{ row }">{{ row.assignee || '-' }}</template>
      <template #cell-station="{ row }">{{ row.station || '-' }}</template>
      <template #cell-alarm_code="{ row }">
        <span v-if="row.alarm_code" class="alarm-code">{{ row.alarm_code }}</span>
        <span v-else>-</span>
      </template>
      <template #cell-created_at="{ row }">{{ formatTime(row.created_at) }}</template>
      <template #cell-finished_at="{ row }">{{ formatTime(row.finished_at) }}</template>
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button class="rs-btn small" type="button" @click="openEdit(row)">编辑</button>
          <button class="rs-btn small danger" type="button" @click="openDelete(row)">删除</button>
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

    <!-- 新增 / 编辑工单：字段与 saveOrder 的入参一致 -->
    <AppModal v-model="formVisible" :title="formTitle" width="720px" :close-on-mask="!submitting">
      <div class="form-grid">
        <div class="rs-field">
          <label>工单号 <span v-if="!form.editing" class="hint">留空由服务端生成</span></label>
          <input
            v-model="form.code"
            class="rs-input"
            :disabled="form.editing"
            placeholder="如 WO20260001，留空自动生成"
          />
        </div>
        <div class="rs-field">
          <label>标题 <span class="req">*</span></label>
          <input v-model="form.title" class="rs-input" placeholder="如 1495信号机主灯丝断丝告警" />
        </div>
        <div class="rs-field">
          <label>类型</label>
          <select v-model="form.type" class="rs-select">
            <option v-for="item in TYPE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
        <div class="rs-field">
          <label>优先级</label>
          <select v-model="form.priority" class="rs-select">
            <option v-for="item in PRIORITY_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
        <div class="rs-field">
          <label>状态</label>
          <select v-model="form.status" class="rs-select">
            <option v-for="item in STATUS_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
        <div class="rs-field">
          <label>处理人</label>
          <input v-model="form.assignee" class="rs-input" placeholder="现场处理人姓名" />
        </div>
        <div class="rs-field">
          <label>车站 / 里程</label>
          <input v-model="form.station" class="rs-input" placeholder="如 K149+525" />
        </div>
        <div class="rs-field">
          <label>关联告警 <span v-if="form.editing" class="hint">编辑时不可修改</span></label>
          <input
            v-model="form.alarm_code"
            class="rs-input"
            :disabled="form.editing"
            placeholder="如 AL20260001"
          />
        </div>
        <div class="rs-field full">
          <label>工单描述</label>
          <textarea v-model="form.description" class="rs-textarea" placeholder="现场处置要求、作业要点等"></textarea>
        </div>
        <div class="rs-field full">
          <label>处理备注</label>
          <textarea v-model="form.remark" class="rs-textarea" placeholder="处理后填写，如“现场已恢复，参数正常”"></textarea>
        </div>
      </div>

      <div class="form-note">
        状态改为「已完成 / 已关闭」时，服务端会自动补记完成时间。
      </div>

      <template #footer>
        <button class="rs-btn" type="button" :disabled="submitting" @click="formVisible = false">取消</button>
        <button class="rs-btn primary" type="button" :disabled="submitting" @click="submitForm">
          {{ submitting ? '提交中…' : '保存' }}
        </button>
      </template>
    </AppModal>

    <!-- 删除确认 -->
    <AppModal v-model="confirmVisible" title="删除工单" width="440px" :close-on-mask="!submitting">
      <p class="confirm-text">
        确定要删除工单「<b>{{ confirmTarget?.code }}</b> {{ confirmTarget?.title }}」吗？该操作不可恢复。
      </p>
      <template #footer>
        <button class="rs-btn" type="button" :disabled="submitting" @click="confirmVisible = false">取消</button>
        <button class="rs-btn danger" type="button" :disabled="submitting" @click="submitDelete">
          {{ submitting ? '删除中…' : '确定删除' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
// 工单管理：GET /api/admin/work-orders（keyword/status/priority/type/dateFrom/dateTo + 分页）。
// 新增 POST /api/admin/work-orders、编辑 PUT /api/admin/work-orders/:id（共用 saveOrder）、删除 DELETE。
// 取值来源：work_orders 表默认值与 db.js 里的演示数据（type/priority/status）。
import { computed, onMounted, reactive, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'
import AppModal from '../../components/common/AppModal.vue'

const TYPE_OPTIONS = [
  { value: '故障处理', label: '故障处理' },
  { value: '计划检修', label: '计划检修' },
  { value: '巡检任务', label: '巡检任务' },
  { value: '备件更换', label: '备件更换' },
]

const PRIORITY_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]
const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' }
const PRIORITY_CLASSES = { high: 'red', medium: 'orange', low: 'gray' }

const STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'finished', label: '已完成' },
  { value: 'closed', label: '已关闭' },
]
const STATUS_LABELS = { pending: '待处理', processing: '处理中', finished: '已完成', closed: '已关闭' }
const STATUS_CLASSES = { pending: 'orange', processing: 'blue', finished: 'green', closed: 'gray' }

const loading = ref(false)
const submitting = ref(false)
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)

const filters = reactive({ keyword: '', status: '', priority: '', type: '', dateFrom: '', dateTo: '' })

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/work-orders', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword,
        status: filters.status,
        priority: filters.priority,
        type: filters.type,
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
  filters.status = ''
  filters.priority = ''
  filters.type = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  search()
}

// —— 新增 / 编辑 ——
const formVisible = ref(false)
const form = reactive({
  editing: false,
  id: null,
  code: '',
  title: '',
  type: '故障处理',
  priority: 'medium',
  status: 'pending',
  assignee: '',
  station: '',
  alarm_code: '',
  description: '',
  remark: '',
})

const formTitle = computed(() => (form.editing ? `编辑工单 ${form.code}` : '新增工单'))

const openCreate = () => {
  Object.assign(form, {
    editing: false,
    id: null,
    code: '',
    title: '',
    type: '故障处理',
    priority: 'medium',
    status: 'pending',
    assignee: '',
    station: '',
    alarm_code: '',
    description: '',
    remark: '',
  })
  formVisible.value = true
}

const openEdit = (row) => {
  Object.assign(form, {
    editing: true,
    id: row.id,
    code: row.code || '',
    title: row.title || '',
    type: row.type || '故障处理',
    priority: row.priority || 'medium',
    status: row.status || 'pending',
    assignee: row.assignee || '',
    station: row.station || '',
    alarm_code: row.alarm_code || '',
    description: row.description || '',
    remark: row.remark || '',
  })
  formVisible.value = true
}

const submitForm = async () => {
  if (submitting.value) return
  const title = String(form.title || '').trim()
  if (!title) {
    toast.error('请填写工单标题')
    return
  }
  submitting.value = true
  try {
    const body = {
      title,
      type: form.type,
      priority: form.priority,
      status: form.status,
      assignee: String(form.assignee || '').trim(),
      station: String(form.station || '').trim(),
      description: String(form.description || '').trim(),
      remark: String(form.remark || '').trim(),
    }
    if (form.editing) {
      await http.put(`/admin/work-orders/${form.id}`, body)
      toast.success('工单已更新')
    } else {
      await http.post('/admin/work-orders', { ...body, code: String(form.code || '').trim(), alarm_code: String(form.alarm_code || '').trim() })
      toast.success('工单已创建')
    }
    formVisible.value = false
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

// —— 删除 ——
const confirmVisible = ref(false)
const confirmTarget = ref(null)

const openDelete = (row) => {
  confirmTarget.value = row
  confirmVisible.value = true
}

const submitDelete = async () => {
  if (submitting.value || !confirmTarget.value) return
  submitting.value = true
  try {
    await http.del(`/admin/work-orders/${confirmTarget.value.id}`)
    toast.success('工单已删除')
    confirmVisible.value = false
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

const columns = [
  { key: 'code', title: '工单号', width: '130px' },
  { key: 'title', title: '标题', width: '230px', tip: true },
  { key: 'type', title: '类型', width: '105px' },
  { key: 'priority', title: '优先级', width: '85px' },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'assignee', title: '处理人', width: '95px' },
  { key: 'station', title: '车站', width: '110px' },
  { key: 'alarm_code', title: '关联告警', width: '120px' },
  { key: 'created_at', title: '创建时间', width: '170px' },
  { key: 'finished_at', title: '完成时间', width: '170px' },
  { key: 'actions', title: '操作', width: '130px' },
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

.alarm-code {
  color: var(--rs-info);
}

.date-input {
  min-width: 140px;
}

.range-sep {
  font-size: 13px;
  color: var(--rs-text-dim);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0 14px;
}

.form-grid .full {
  grid-column: 1 / -1;
}

.rs-field .hint {
  margin-left: 6px;
  font-size: 11px;
  color: var(--rs-text-dim);
}

.form-note {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--rs-text-dim);
  background: rgba(0, 40, 70, 0.35);
  border: 1px solid rgba(0, 200, 255, 0.18);
  border-radius: var(--rs-radius);
}

.confirm-text {
  font-size: 14px;
  color: var(--rs-text);
  line-height: 1.7;
  margin-bottom: 6px;
}

.confirm-text b {
  color: var(--rs-primary);
}
</style>
