<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>系统设置</h2>
        <div class="sub">平台配置项维护 · 数据来自 GET /api/admin/configs（键 / 值 / 描述）</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn" type="button" :disabled="loading" @click="load">刷新</button>
      </div>
    </div>

    <div class="filter-bar">
      <input v-model="filters.keyword" class="rs-input" placeholder="配置键 / 配置值 / 描述" @keyup.enter="search" />
      <button class="rs-btn" type="button" :disabled="loading" @click="search">查询</button>
      <button class="rs-btn" type="button" :disabled="loading" @click="reset">重置</button>
      <span class="spacer"></span>
      <span class="count-hint">共 <b>{{ total }}</b> 项配置</span>
    </div>

    <!-- 按配置键前缀分组：ai.* 智能体 / voice.* 语音 / system.* 系统，其余归入其他 -->
    <div v-for="group in groups" :key="group.key" class="group-card rs-panel">
      <div class="group-head">
        <span class="group-title">{{ group.label }}</span>
        <span class="group-count">{{ group.items.length }} 项</span>
        <span class="group-prefix">{{ group.key }}.*</span>
        <span class="spacer"></span>
        <span v-if="dirtyCount(group)" class="group-dirty">{{ dirtyCount(group) }} 项待保存</span>
      </div>

      <DataTable :columns="columns" :rows="group.items" :loading="loading" row-key="key" :index="false">
        <template #cell-key="{ row }">
          <div class="key-cell">
            <span class="code-text">{{ row.key }}</span>
            <span v-if="hintOf(row.key)" class="key-hint">{{ hintOf(row.key) }}</span>
          </div>
        </template>
        <template #cell-value="{ row }">
          <!-- 开关型配置值固定为字符串 '0' / '1' -->
          <select v-if="isSwitch(row.key)" v-model="drafts[row.key]" class="rs-select value-switch">
            <option value="1">开启</option>
            <option value="0">关闭</option>
          </select>
          <textarea
            v-else-if="isTextarea(row.key)"
            v-model="drafts[row.key]"
            class="rs-textarea value-area"
            rows="3"
          ></textarea>
          <input
            v-else-if="isNumber(row.key)"
            v-model="drafts[row.key]"
            class="rs-input value-input"
            type="number"
            min="1"
          />
          <input v-else v-model="drafts[row.key]" class="rs-input value-input" />
        </template>
        <template #cell-description="{ row }">{{ row.description || '-' }}</template>
        <template #cell-updated_at="{ row }">{{ formatTime(row.updated_at) }}</template>
        <template #cell-actions="{ row }">
          <div class="row-actions">
            <button
              class="rs-btn small primary"
              type="button"
              :disabled="!isDirty(row) || submitting === row.key"
              @click="save(row)"
            >
              {{ submitting === row.key ? '保存中…' : '保存' }}
            </button>
            <button class="rs-btn small" type="button" :disabled="!isDirty(row)" @click="revert(row)">还原</button>
          </div>
        </template>
      </DataTable>
    </div>

    <div v-if="!groups.length && !loading" class="group-state">暂无配置项</div>

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
// 系统设置：GET /api/admin/configs（keyword + 分页），编辑 PUT /api/admin/configs/:key，body 为 { value }。
// 真实 key 前缀来自 system_configs 初始化数据：system.* / ai.* / voice.*，按前缀分组渲染成卡片。
import { computed, onMounted, reactive, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'

// 组名与展示顺序（未收录的前缀统一归入 other）
const GROUP_LABELS = { ai: '智能体', voice: '语音', system: '系统', other: '其他' }
const GROUP_ORDER = ['ai', 'voice', 'system', 'other']

// 开关型：值为字符串 '0' / '1'（后端按 === '1' 判定）
const SWITCH_KEYS = ['ai.context_enabled', 'voice.asr_enabled', 'voice.tts_enabled', 'system.reset_token_visible']
// 长文本与数值型
const TEXTAREA_KEYS = ['ai.system_prompt']
const NUMBER_KEYS = ['system.page_size', 'ai.max_history']

// 已知配置项的用途提示（key 取自 system_configs 初始化数据）
const KEY_HINTS = {
  'system.site_name': '顶栏与登录页展示的平台名称',
  'system.copyright': '侧边栏底部展示的版本号',
  'system.page_size': '管理台各列表未指定时的默认每页条数',
  'ai.default_model': '智能体默认模型，建议在「模型管理」中通过“设为默认”修改',
  'ai.system_prompt': '发送给模型的系统提示词，会拼接实时监测上下文',
  'ai.max_history': '随提问一起发送的历史消息条数',
  'ai.context_enabled': '开启后会把信号机 / 告警 / 遥测摘要注入提示词',
  'voice.tts_voice': '服务端语音播报音色，如 zh-CN-XiaoxiaoNeural',
  'voice.asr_enabled': '是否启用语音识别',
  'voice.tts_enabled': '是否启用服务端语音播报',
  'system.reset_token_visible': '开启后找回密码页直接回显重置令牌（仅演示环境建议开启）',
}

const loading = ref(false)
const submitting = ref('')
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)
const filters = reactive({ keyword: '' })

// 每行的编辑草稿，key → 输入值
const drafts = reactive({})

const isSwitch = (key) => SWITCH_KEYS.includes(key)
const isTextarea = (key) => TEXTAREA_KEYS.includes(key)
const isNumber = (key) => NUMBER_KEYS.includes(key)
const hintOf = (key) => KEY_HINTS[key] || ''

const fillDrafts = () => {
  for (const row of rows.value) {
    drafts[row.key] = row.value ?? ''
  }
}

const isDirty = (row) => String(drafts[row.key] ?? '') !== String(row.value ?? '')

const dirtyCount = (group) => group.items.filter((row) => isDirty(row)).length

const groups = computed(() => {
  const map = new Map()
  for (const row of rows.value) {
    const prefix = String(row.key || '').split('.')[0] || 'other'
    const groupKey = GROUP_LABELS[prefix] ? prefix : 'other'
    if (!map.has(groupKey)) map.set(groupKey, { key: groupKey, label: GROUP_LABELS[groupKey], items: [] })
    map.get(groupKey).items.push(row)
  }
  return [...map.values()].sort((a, b) => GROUP_ORDER.indexOf(a.key) - GROUP_ORDER.indexOf(b.key))
})

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/configs', {
      params: { page: page.value, pageSize: pageSize.value, keyword: filters.keyword },
    })
    rows.value = data?.list || []
    total.value = Number(data?.total || 0)
    totalPages.value = Number(data?.totalPages || 1)
    fillDrafts()
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
  search()
}

const revert = (row) => {
  drafts[row.key] = row.value ?? ''
}

const save = async (row) => {
  if (submitting.value) return
  const value = String(drafts[row.key] ?? '').trim()
  if (isNumber(row.key) && (!/^\d+$/.test(value) || Number(value) < 1)) {
    toast.error('该项需要填写大于 0 的整数')
    return
  }
  submitting.value = row.key
  try {
    await http.put(`/admin/configs/${encodeURIComponent(row.key)}`, { value })
    toast.success(`${row.key} 已保存`)
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = ''
  }
}

const columns = [
  { key: 'key', title: '配置键', width: '230px' },
  { key: 'value', title: '配置值' },
  { key: 'description', title: '描述', width: '230px', tip: true },
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

.key-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.key-hint {
  font-size: 11px;
  color: var(--rs-text-dim);
  line-height: 1.5;
}

.value-input {
  min-width: 220px;
}

.value-switch {
  min-width: 110px;
}

.value-area {
  min-width: 260px;
  min-height: 66px;
}

/* —— 分组卡片 —— */
.group-card {
  padding: 12px 14px 6px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.group-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--rs-text-strong);
}

.group-count {
  font-size: 12px;
  color: var(--rs-primary);
}

.group-prefix {
  font-size: 11px;
  color: var(--rs-text-dim);
}

.group-head .spacer {
  flex: 1;
}

.group-dirty {
  font-size: 12px;
  color: var(--rs-warning);
}

.group-state {
  padding: 30px;
  text-align: center;
  font-size: 13px;
  color: var(--rs-text-dim);
  background: var(--rs-panel-bg);
  border: 1px solid var(--rs-panel-border);
  border-radius: var(--rs-radius);
}

.count-hint {
  font-size: 13px;
  color: var(--rs-text-dim);
}

.count-hint b {
  color: var(--rs-primary);
}
</style>
