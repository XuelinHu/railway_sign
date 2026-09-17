<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>信号机管理</h2>
        <div class="sub">信号机台账与实时状态 · 列表接口 GET /api/admin/signals</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn" type="button" :disabled="loading" @click="load">刷新</button>
        <button class="rs-btn primary" type="button" @click="openCreate">➕ 新增信号机</button>
      </div>
    </div>

    <!-- 筛选项与 signalList 的 filters/searchFields 一致 -->
    <div class="filter-bar">
      <input v-model="filters.keyword" class="rs-input" placeholder="编号 / 名称 / 车站 / 里程" @keyup.enter="search" />
      <select v-model="filters.status" class="rs-select">
        <option value="">全部状态</option>
        <option v-for="item in STATUS_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <input v-model="filters.station" class="rs-input narrow" placeholder="车站" @keyup.enter="search" />
      <select v-model="filters.direction" class="rs-select">
        <option value="">全部方向</option>
        <option v-for="item in DIRECTION_OPTIONS" :key="item" :value="item">{{ item }}</option>
      </select>
      <select v-model="filters.type" class="rs-select">
        <option value="">全部类型</option>
        <option v-for="item in TYPE_OPTIONS" :key="item" :value="item">{{ item }}</option>
      </select>
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
      <template #cell-status="{ row }">
        <span class="rs-tag" :class="STATUS_CLASSES[row.status] || 'gray'">
          {{ STATUS_LABELS[row.status] || row.status || '-' }}
        </span>
      </template>
      <template #cell-online="{ row }">
        <span class="rs-tag" :class="Number(row.online) === 1 ? 'green' : 'gray'">
          {{ Number(row.online) === 1 ? '在线' : '离线' }}
        </span>
      </template>
      <template #cell-temperature="{ row }">{{ fixed(row.temperature) }}</template>
      <template #cell-humidity="{ row }">{{ fixed(row.humidity) }}</template>
      <template #cell-voltage="{ row }">{{ fixed(row.voltage, 2) }}</template>
      <template #cell-current="{ row }">{{ fixed(row.current, 2) }}</template>
      <template #cell-updated_at="{ row }">{{ formatTime(row.updated_at) }}</template>
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

    <!-- 新增 / 编辑信号机：字段与 saveSignal 一致 -->
    <AppModal v-model="formVisible" :title="form.id ? '编辑信号机' : '新增信号机'" width="640px" :close-on-mask="!submitting">
      <div class="form-grid">
        <div class="rs-field">
          <label>信号机编号 <span v-if="!form.id" class="req">*</span></label>
          <input v-model="form.code" class="rs-input" :disabled="Boolean(form.id)" placeholder="如 1491" />
        </div>
        <div class="rs-field">
          <label>名称</label>
          <input v-model="form.name" class="rs-input" placeholder="留空自动生成" />
        </div>
        <div class="rs-field">
          <label>车站</label>
          <input v-model="form.station" class="rs-input" placeholder="如 14站" />
        </div>
        <div class="rs-field">
          <label>里程</label>
          <input v-model="form.kilometer" class="rs-input" placeholder="如 K149+525" />
        </div>
        <div class="rs-field">
          <label>方向</label>
          <select v-model="form.direction" class="rs-select">
            <option v-for="item in DIRECTION_OPTIONS" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
        <div class="rs-field">
          <label>类型</label>
          <select v-model="form.type" class="rs-select">
            <option v-for="item in TYPE_OPTIONS" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
        <div class="rs-field">
          <label>灯位状态</label>
          <select v-model="form.status" class="rs-select">
            <option v-for="item in STATUS_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
        <div class="rs-field">
          <label>在线状态</label>
          <select v-model="form.online" class="rs-select">
            <option :value="true">在线</option>
            <option :value="false">离线</option>
          </select>
        </div>
        <div class="rs-field full">
          <label>备注</label>
          <textarea v-model="form.remark" class="rs-textarea" placeholder="选填"></textarea>
        </div>
      </div>
      <div class="form-note">温度、湿度、电压、电流为设备上报的实时监测值，不支持手工修改。</div>
      <template #footer>
        <button class="rs-btn" type="button" :disabled="submitting" @click="formVisible = false">取消</button>
        <button class="rs-btn primary" type="button" :disabled="submitting" @click="submitForm">
          {{ submitting ? '提交中…' : '保存' }}
        </button>
      </template>
    </AppModal>

    <!-- 删除确认 -->
    <AppModal v-model="confirmVisible" title="删除信号机" width="440px" :close-on-mask="!submitting">
      <p class="confirm-text">
        确定要删除信号机「<b>{{ confirmTarget?.code }}</b> {{ confirmTarget?.name }}」吗？该操作不可恢复。
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
// 信号机管理：GET /api/admin/signals（keyword/status/station/direction/type + 分页）。
// 状态取值 green/red/yellow/off、方向 上行/下行、类型四种，均取自 server/api/lib/db.js 种子数据。
import { onMounted, reactive, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'
import AppModal from '../../components/common/AppModal.vue'

const STATUS_OPTIONS = [
  { value: 'green', label: '绿灯' },
  { value: 'red', label: '红灯' },
  { value: 'yellow', label: '黄灯' },
  { value: 'off', label: '离线' },
]
const STATUS_LABELS = { green: '绿灯', red: '红灯', yellow: '黄灯', off: '离线' }
const STATUS_CLASSES = { green: 'green', red: 'red', yellow: 'orange', off: 'gray' }
const DIRECTION_OPTIONS = ['上行', '下行']
const TYPE_OPTIONS = ['进站信号机', '出站信号机', '通过信号机', '调车信号机']

const loading = ref(false)
const submitting = ref(false)
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)

const filters = reactive({ keyword: '', status: '', station: '', direction: '', type: '' })

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/signals', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword,
        status: filters.status,
        station: filters.station,
        direction: filters.direction,
        type: filters.type,
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
  filters.station = ''
  filters.direction = ''
  filters.type = ''
  search()
}

// —— 新增 / 编辑 ——
const formVisible = ref(false)
const form = reactive({
  id: 0,
  code: '',
  name: '',
  station: '',
  kilometer: '',
  direction: '上行',
  type: '进站信号机',
  status: 'green',
  online: true,
  remark: '',
})

const openCreate = () => {
  Object.assign(form, {
    id: 0,
    code: '',
    name: '',
    station: '',
    kilometer: '',
    direction: '上行',
    type: '进站信号机',
    status: 'green',
    online: true,
    remark: '',
  })
  formVisible.value = true
}

const openEdit = (row) => {
  Object.assign(form, {
    id: row.id,
    code: row.code || '',
    name: row.name || '',
    station: row.station || '',
    kilometer: row.kilometer || '',
    direction: row.direction || '上行',
    type: row.type || '进站信号机',
    status: row.status || 'green',
    online: Number(row.online) === 1,
    remark: row.remark || '',
  })
  formVisible.value = true
}

const submitForm = async () => {
  if (submitting.value) return
  if (!form.id && !String(form.code || '').trim()) {
    toast.error('请填写信号机编号')
    return
  }
  submitting.value = true
  try {
    const body = {
      name: String(form.name || '').trim(),
      station: String(form.station || '').trim(),
      kilometer: String(form.kilometer || '').trim(),
      direction: form.direction,
      type: form.type,
      status: form.status,
      online: Boolean(form.online),
      remark: String(form.remark || '').trim(),
    }
    if (form.id) {
      await http.put(`/admin/signals/${form.id}`, body)
      toast.success('信号机已更新')
    } else {
      await http.post('/admin/signals', { ...body, code: String(form.code || '').trim() })
      toast.success('信号机已创建')
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
    await http.del(`/admin/signals/${confirmTarget.value.id}`)
    toast.success('信号机已删除')
    confirmVisible.value = false
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

// 数值展示：保留 1 位小数（电压电流保留 2 位）
const fixed = (value, digits = 1) => {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(digits) : String(value)
}

const columns = [
  { key: 'code', title: '编号', width: '100px' },
  { key: 'name', title: '名称', width: '150px' },
  { key: 'station', title: '车站', width: '90px' },
  { key: 'kilometer', title: '里程', width: '110px' },
  { key: 'direction', title: '方向', width: '80px' },
  { key: 'type', title: '类型', width: '120px' },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'temperature', title: '温度(℃)', width: '95px', align: 'right' },
  { key: 'humidity', title: '湿度(%)', width: '95px', align: 'right' },
  { key: 'voltage', title: '电压(V)', width: '95px', align: 'right' },
  { key: 'current', title: '电流(A)', width: '95px', align: 'right' },
  { key: 'online', title: '在线', width: '85px' },
  { key: 'updated_at', title: '更新时间', width: '170px' },
  { key: 'actions', title: '操作', width: '150px' },
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

.filter-bar .narrow {
  min-width: 110px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0 14px;
}

.form-grid .full {
  grid-column: 1 / -1;
}

.form-note {
  font-size: 12px;
  color: var(--rs-text-dim);
  padding: 8px 10px;
  background: rgba(0, 60, 100, 0.25);
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
