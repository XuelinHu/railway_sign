<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>模型管理</h2>
        <div class="sub">Ollama 模型目录与本机安装状态 · 列表来自 GET /api/admin/models</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn" type="button" :disabled="loading || ollamaLoading" @click="refreshAll">刷新</button>
        <button class="rs-btn primary" type="button" @click="openCreate">➕ 新增登记模型</button>
      </div>
    </div>

    <!-- Ollama 在线状态与安装情况：来自 GET /api/ai/models（ollamaOnline / installed / defaultModel） -->
    <div class="ollama-bar rs-panel">
      <span class="rs-tag" :class="ollama.online ? 'green' : 'red'">
        Ollama {{ ollama.online ? '在线' : '离线' }}
      </span>
      <span class="bar-item">已安装模型 <b>{{ ollama.installedCount }}</b> 个</span>
      <span class="bar-item">当前列表 <b>{{ total }}</b> 个</span>
      <span class="bar-item">智能体默认模型 <b>{{ ollama.defaultModel || '-' }}</b></span>
      <span v-if="!ollama.loaded" class="bar-item dim">未能读取本机模型状态，仅展示目录信息</span>
      <span v-else-if="!ollama.online" class="bar-item dim">Ollama 未响应，下载与删除本机模型会失败</span>
      <span v-else-if="ollama.degraded" class="bar-item dim">未取得本机安装明细（当前账号缺少 ai:use 权限），安装状态仅供参考</span>
    </div>

    <!-- 下载进度：POST /api/ai/models/pull 的 SSE（start / progress / done / error） -->
    <div v-if="pulling" class="pull-panel rs-panel">
      <div class="pull-head">
        <span class="pull-spinner"></span>
        <span class="pull-name">正在下载 {{ pulling }}</span>
        <span class="pull-percent">{{ pullPercent }}%</span>
        <span class="pull-spacer"></span>
        <button class="rs-btn small danger" type="button" @click="cancelPull">取消</button>
      </div>
      <div class="pull-bar">
        <div class="pull-fill" :style="{ width: `${pullPercent}%` }"></div>
      </div>
      <div class="pull-status">{{ pullStatus || '等待 Ollama 响应…' }}</div>
    </div>

    <!-- 筛选项与 modelList 的 filters/searchFields 一致：source / family + keyword -->
    <div class="filter-bar">
      <input v-model="filters.keyword" class="rs-input" placeholder="模型名 / 显示名 / 家族 / 标签" @keyup.enter="search" />
      <select v-model="filters.source" class="rs-select">
        <option value="">全部来源</option>
        <option v-for="item in SOURCE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <select v-model="filters.family" class="rs-select">
        <option value="">全部家族</option>
        <option v-for="item in familyOptions" :key="item" :value="item">{{ item }}</option>
      </select>
      <button class="rs-btn" type="button" :disabled="loading" @click="search">查询</button>
      <button class="rs-btn" type="button" :disabled="loading" @click="reset">重置</button>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      row-key="name"
      :index="true"
      :index-base="(page - 1) * pageSize"
    >
      <template #cell-name="{ row }">
        <span class="code-text">{{ row.name }}</span>
      </template>
      <template #cell-display_name="{ row }">{{ row.display_name || '-' }}</template>
      <template #cell-provider="{ row }">
        <span class="rs-tag gray">{{ row.provider || 'ollama' }}</span>
      </template>
      <template #cell-parameter_size="{ row }">{{ row.parameter_size || '-' }}</template>
      <template #cell-quantization="{ row }">{{ row.quantization || '-' }}</template>
      <template #cell-size="{ row }">{{ sizeOf(row) }}</template>
      <template #cell-installed="{ row }">
        <span class="rs-tag" :class="isInstalled(row.name) ? 'green' : 'gray'">
          {{ isInstalled(row.name) ? '已安装' : '未安装' }}
        </span>
      </template>
      <template #cell-is_default="{ row }">
        <span v-if="Number(row.is_default) === 1" class="rs-tag blue">默认</span>
        <span v-else>-</span>
      </template>
      <template #cell-description="{ row }">{{ row.description || '-' }}</template>
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button
            class="rs-btn small"
            type="button"
            :disabled="Number(row.is_default) === 1"
            :title="Number(row.is_default) === 1 ? '已是默认模型' : '设为智能体默认模型'"
            @click="setDefault(row)"
          >
            设为默认
          </button>
          <button
            v-if="!isInstalled(row.name)"
            class="rs-btn small primary"
            type="button"
            :disabled="Boolean(pulling)"
            @click="startPull(row.name)"
          >
            {{ pulling === row.name ? '下载中…' : '⬇ 下载' }}
          </button>
          <button
            class="rs-btn small danger"
            type="button"
            :disabled="Number(row.is_default) === 1"
            :title="Number(row.is_default) === 1 ? '默认模型不可删除，请先切换默认模型' : ''"
            @click="openDelete(row)"
          >
            {{ isInstalled(row.name) ? '删除本机' : '移除登记' }}
          </button>
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

    <!-- 新增登记模型：字段与 saveModel 的 INSERT 分支一致 -->
    <AppModal v-model="formVisible" title="新增登记模型" width="720px" :close-on-mask="!submitting">
      <div class="form-grid">
        <div class="rs-field">
          <label>模型名 <span class="req">*</span></label>
          <input v-model="form.name" class="rs-input" placeholder="Ollama 拉取名，如 qwen3:8b" />
        </div>
        <div class="rs-field">
          <label>显示名</label>
          <input v-model="form.display_name" class="rs-input" placeholder="留空默认与模型名一致" />
        </div>
        <div class="rs-field">
          <label>家族</label>
          <input v-model="form.family" class="rs-input" placeholder="留空取模型名冒号前部分" />
        </div>
        <div class="rs-field">
          <label>参数规模</label>
          <input v-model="form.parameter_size" class="rs-input" placeholder="如 8.2B" />
        </div>
        <div class="rs-field">
          <label>量化</label>
          <input v-model="form.quantization" class="rs-input" placeholder="如 Q4_K_M" />
        </div>
        <div class="rs-field">
          <label>大小（字节）</label>
          <input v-model.number="form.size_bytes" class="rs-input" type="number" min="0" placeholder="如 5220000000" />
        </div>
        <div class="rs-field">
          <label>标签</label>
          <input v-model="form.tags" class="rs-input" placeholder="英文逗号分隔，如 推荐,中文" />
        </div>
        <div class="rs-field">
          <label>排序</label>
          <input v-model.number="form.sort" class="rs-input" type="number" min="1" placeholder="数值越小越靠前" />
        </div>
        <div class="rs-field full">
          <label>模型描述</label>
          <textarea v-model="form.description" class="rs-textarea" placeholder="用于模型下拉与目录展示的说明"></textarea>
        </div>
      </div>

      <div class="form-note">
        登记只写入模型目录（source = custom）；若同名的本机模型尚未下载，可在列表中直接点「下载」拉取。
      </div>

      <template #footer>
        <button class="rs-btn" type="button" :disabled="submitting" @click="formVisible = false">取消</button>
        <button class="rs-btn primary" type="button" :disabled="submitting" @click="submitForm">
          {{ submitting ? '提交中…' : '保存' }}
        </button>
      </template>
    </AppModal>

    <!-- 删除确认：本机已安装走 Ollama 删除（释放磁盘），未安装走目录登记删除 -->
    <AppModal v-model="confirmVisible" title="删除模型" width="460px" :close-on-mask="!submitting">
      <p class="confirm-text" v-if="confirmInstalled">
        将从本机 Ollama 删除模型「<b>{{ confirmTarget?.name }}</b>」，<b>释放其占用的磁盘空间</b>（约
        {{ confirmTarget ? sizeOf(confirmTarget) : '-' }}），目录登记会保留。<br />
        删除后需要重新下载才能使用，确定继续吗？
      </p>
      <p class="confirm-text" v-else>
        将从模型目录移除「<b>{{ confirmTarget?.name }}</b>」的登记信息（本机未安装该模型，不涉及磁盘文件）。<br />
        确定继续吗？
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
// 模型管理：GET /api/admin/models（keyword/source/family + 分页，读 ai_models 目录表）。
// 本机安装状态与大小来自 GET /api/ai/models（请求需 ai:use），失败时降级为只展示目录信息。
// 设为默认 PUT /api/admin/models/:name/default；新增登记 POST /api/admin/models。
// 删除：本机已安装 → DELETE /api/ai/models/:name（Ollama 真删，释放磁盘）；
//       未安装 → DELETE /api/admin/models/:name（仅删目录登记）。
// 下载：POST /api/ai/models/pull，SSE 事件 start / progress / done / error。
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import http, { stream } from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'
import AppModal from '../../components/common/AppModal.vue'

// ai_models.source 的真实取值：catalog（内置推荐目录）/ custom（管理台登记）/ local（本机未登记）
const SOURCE_OPTIONS = [
  { value: 'catalog', label: '推荐目录' },
  { value: 'custom', label: '自定义登记' },
  { value: 'local', label: '本机未登记' },
]

const loading = ref(false)
const ollamaLoading = ref(false)
const submitting = ref(false)
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)
const filters = reactive({ keyword: '', source: '', family: '' })

// 本机状态：installedNames / sizeLabels 由 /api/ai/models 的 list 归集
const ollama = ref({
  loaded: false,
  degraded: false,
  online: false,
  defaultModel: '',
  installedCount: 0,
  installedNames: new Set(),
  sizeLabels: {},
  families: [],
})

const isInstalled = (name) => ollama.value.installedNames.has(name)

// 家族下拉取自本机与当前页真实数据，避免写死
const familyOptions = computed(() => {
  const set = new Set(ollama.value.families)
  for (const row of rows.value) {
    if (row.family) set.add(row.family)
  }
  return [...set].sort()
})

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/models', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword,
        source: filters.source,
        family: filters.family,
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

// 本机安装状态：接口不可用（未登录/无 ai:use 权限/Ollama 代理异常）时静默降级
const loadOllama = async () => {
  ollamaLoading.value = true
  try {
    const data = await http.get('/ai/models')
    const list = data?.list || []
    const installedNames = new Set()
    const sizeLabels = {}
    for (const item of list) {
      if (item.installed) installedNames.add(item.name)
      if (item.size_label) sizeLabels[item.name] = item.size_label
    }
    ollama.value = {
      loaded: true,
      online: Boolean(data?.ollamaOnline),
      defaultModel: data?.defaultModel || '',
      installedCount: installedNames.size,
      installedNames,
      sizeLabels,
      families: [...new Set(list.map((item) => item.family).filter(Boolean))],
    }
  } catch (_) {
    // 降级：/api/ai/health 是公开接口，至少能拿到在线状态与已安装数量
    try {
      const health = await http.get('/ai/health')
      ollama.value = {
        ...ollama.value,
        loaded: true,
        degraded: true,
        online: Boolean(health?.ollama?.online),
        installedCount: Number(health?.ollama?.modelCount || 0),
        installedNames: new Set(),
        sizeLabels: {},
        families: [],
      }
    } catch (_) {
      ollama.value = { ...ollama.value, loaded: false }
    }
  } finally {
    ollamaLoading.value = false
  }
}

const refreshAll = async () => {
  await Promise.all([load(), loadOllama()])
}

const search = () => {
  page.value = 1
  load()
}

const reset = () => {
  filters.keyword = ''
  filters.source = ''
  filters.family = ''
  search()
}

// 大小优先用接口给的 size_label，缺失时按 size_bytes 换算（与后端 sizeLabel 同规则）
const sizeOf = (row) => ollama.value.sizeLabels[row?.name] || sizeLabel(row?.size_bytes)

function sizeLabel(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '-'
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} GB`
  return `${Math.round(value / 1e6)} MB`
}

// —— 设为默认 ——
const setDefault = async (row) => {
  if (submitting.value) return
  submitting.value = true
  try {
    await http.put(`/admin/models/${encodeURIComponent(row.name)}/default`, {})
    toast.success(`已将 ${row.name} 设为默认模型`)
    await refreshAll()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

// —— 下载（SSE 流式进度）——
const pulling = ref('')
const pullPercent = ref(0)
const pullStatus = ref('')
let pullController = null

const startPull = async (name) => {
  if (pulling.value) {
    toast.info(`正在下载 ${pulling.value}，请先等待完成或取消`)
    return
  }
  pulling.value = name
  pullPercent.value = 0
  pullStatus.value = ''
  pullController = new AbortController()
  try {
    await stream('/ai/models/pull', {
      body: { name },
      signal: pullController.signal,
      onEvent: (event, payload) => {
        if (event === 'start') {
          pullStatus.value = '已连接 Ollama，开始拉取…'
        } else if (event === 'progress') {
          pullPercent.value = Number(payload?.percent || 0)
          pullStatus.value = payload?.status || ''
        } else if (event === 'done') {
          toast.success(`${name} 下载完成`)
          refreshAll()
        } else if (event === 'error') {
          toast.error(payload?.message || '模型下载失败')
        }
      },
    })
  } catch (e) {
    // 主动取消会中断流，不提示错误
    if (!pullController?.signal.aborted) toast.error(e.message)
  } finally {
    pulling.value = ''
    pullPercent.value = 0
    pullStatus.value = ''
    pullController = null
  }
}

const cancelPull = () => {
  if (!pullController) return
  pullController.abort()
  toast.info('已中断下载（已下载的分片保留在 Ollama，可稍后重新下载继续）')
}

// —— 新增登记 ——
const formVisible = ref(false)
const form = reactive({
  name: '',
  display_name: '',
  family: '',
  parameter_size: '',
  quantization: '',
  size_bytes: '',
  tags: '',
  sort: 99,
  description: '',
})

const openCreate = () => {
  Object.assign(form, {
    name: '',
    display_name: '',
    family: '',
    parameter_size: '',
    quantization: '',
    size_bytes: '',
    tags: '',
    sort: 99,
    description: '',
  })
  formVisible.value = true
}

const submitForm = async () => {
  if (submitting.value) return
  const name = String(form.name || '').trim()
  if (!name) {
    toast.error('请填写模型名称')
    return
  }
  submitting.value = true
  try {
    await http.post('/admin/models', {
      name,
      display_name: String(form.display_name || '').trim(),
      family: String(form.family || '').trim(),
      parameter_size: String(form.parameter_size || '').trim(),
      quantization: String(form.quantization || '').trim(),
      size_bytes: Number(form.size_bytes) || 0,
      tags: String(form.tags || '').trim(),
      sort: Number(form.sort) || 99,
      description: String(form.description || '').trim(),
    })
    toast.success('模型已登记到目录')
    formVisible.value = false
    await refreshAll()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

// —— 删除 ——
const confirmVisible = ref(false)
const confirmTarget = ref(null)
const confirmInstalled = ref(false)

const openDelete = (row) => {
  confirmTarget.value = row
  confirmInstalled.value = isInstalled(row.name)
  confirmVisible.value = true
}

const submitDelete = async () => {
  if (submitting.value || !confirmTarget.value) return
  const name = confirmTarget.value.name
  submitting.value = true
  try {
    if (confirmInstalled.value) {
      await http.del(`/ai/models/${encodeURIComponent(name)}`)
      toast.success(`已从本机删除 ${name}，磁盘空间已释放`)
    } else {
      await http.del(`/admin/models/${encodeURIComponent(name)}`)
      toast.success(`已移除 ${name} 的目录登记`)
    }
    confirmVisible.value = false
    await refreshAll()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

const columns = [
  { key: 'name', title: '模型名', width: '150px' },
  { key: 'display_name', title: '显示名', width: '200px' },
  { key: 'provider', title: '厂商', width: '95px' },
  { key: 'parameter_size', title: '参数规模', width: '95px' },
  { key: 'quantization', title: '量化', width: '95px' },
  { key: 'size', title: '大小', width: '95px', align: 'right' },
  { key: 'installed', title: '本机安装', width: '95px' },
  { key: 'is_default', title: '默认', width: '80px' },
  { key: 'description', title: '描述', tip: true },
  { key: 'actions', title: '操作', width: '250px' },
]

onMounted(() => {
  load()
  loadOllama()
})

// 离开页面时中断仍在进行的下载流（已下载分片保留在 Ollama，可再次点下载续传）
onBeforeUnmount(() => {
  pullController?.abort()
})
</script>

<style scoped>
.code-text {
  color: var(--rs-primary);
  font-weight: bold;
}

/* —— Ollama 状态条 —— */
.ollama-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 12px 14px;
  font-size: 13px;
  color: var(--rs-text-dim);
}

.ollama-bar .bar-item b {
  color: var(--rs-primary);
}

.ollama-bar .bar-item.dim {
  color: rgba(127, 163, 184, 0.7);
  font-size: 12px;
}

/* —— 下载进度 —— */
.pull-panel {
  padding: 14px;
}

.pull-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pull-name {
  font-size: 13px;
  color: var(--rs-text-strong);
  font-weight: bold;
}

.pull-percent {
  font-size: 13px;
  color: var(--rs-primary);
  font-weight: bold;
}

.pull-spacer {
  flex: 1;
}

.pull-bar {
  height: 10px;
  margin: 10px 0 8px;
  border-radius: 6px;
  background: rgba(0, 40, 70, 0.7);
  border: 1px solid var(--rs-panel-border);
  overflow: hidden;
}

.pull-fill {
  height: 100%;
  background: var(--rs-gradient);
  box-shadow: 0 0 12px rgba(0, 200, 255, 0.5);
  transition: width 0.3s ease;
}

.pull-status {
  font-size: 12px;
  color: var(--rs-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pull-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 200, 255, 0.3);
  border-top-color: var(--rs-primary);
  border-radius: 50%;
  animation: pull-spin 0.8s linear infinite;
}

@keyframes pull-spin {
  to {
    transform: rotate(360deg);
  }
}

/* —— 表单 —— */
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0 14px;
}

.form-grid .full {
  grid-column: 1 / -1;
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
