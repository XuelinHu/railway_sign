<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>智能体会话</h2>
        <div class="sub">智能体问答会话与消息留痕 · 数据来自 GET /api/admin/ai-sessions</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn" type="button" :disabled="loading" @click="load">刷新</button>
      </div>
    </div>

    <!-- 筛选项与 aiSessionList 的 filters/searchFields 一致：model / username + keyword + 创建时间 -->
    <div class="filter-bar">
      <input v-model="filters.keyword" class="rs-input" placeholder="标题 / 用户名 / 模型" @keyup.enter="search" />
      <input
        v-model="filters.username"
        class="rs-input suggest-input"
        list="ai-session-users"
        placeholder="所属用户"
        @keyup.enter="search"
      />
      <datalist id="ai-session-users">
        <option v-for="item in userSuggestions" :key="item" :value="item" />
      </datalist>
      <input
        v-model="filters.model"
        class="rs-input suggest-input"
        list="ai-session-models"
        placeholder="模型（精确匹配）"
        @keyup.enter="search"
      />
      <datalist id="ai-session-models">
        <option v-for="item in modelSuggestions" :key="item" :value="item" />
      </datalist>
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
      :index="false"
    >
      <template #cell-id="{ row }">
        <span class="code-text">#{{ row.id }}</span>
      </template>
      <template #cell-title="{ row }">
        <span class="title-text">{{ row.title || '-' }}</span>
      </template>
      <template #cell-username="{ row }">{{ row.username || '-' }}</template>
      <template #cell-model="{ row }">
        <span v-if="row.model" class="rs-tag blue">{{ row.model }}</span>
        <span v-else>-</span>
      </template>
      <template #cell-message_count="{ row }">
        <span class="rs-tag gray">{{ Number(row.message_count || 0) }} 条</span>
      </template>
      <template #cell-created_at="{ row }">{{ formatTime(row.created_at) }}</template>
      <template #cell-updated_at="{ row }">{{ formatTime(row.updated_at) }}</template>
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button class="rs-btn small" type="button" @click="openMessages(row)">查看对话</button>
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

    <!-- 查看对话：GET /api/admin/ai-sessions/:id/messages（返回 {list,total,page,pageSize,totalPages,session}） -->
    <AppModal v-model="messagesVisible" :title="messagesTitle" width="720px">
      <div v-if="messagesLoading" class="msg-state">对话加载中…</div>
      <div v-else-if="!messages.length" class="msg-state">该会话暂无消息记录</div>
      <div v-else ref="msgBody" class="msg-body">
        <div v-for="item in messages" :key="item.id" class="msg-row" :class="roleRowClass(item.role)">
          <div class="bubble" :class="roleBubbleClass(item.role)">
            <div class="bubble-head">
              <span class="bubble-role">{{ roleLabel(item.role) }}</span>
              <span class="bubble-time">{{ formatTime(item.created_at) }}</span>
            </div>
            <div class="bubble-text">{{ item.content }}</div>
            <div v-if="item.role === 'assistant' && (item.tokens || item.latency_ms)" class="bubble-foot">
              {{ item.tokens || 0 }} tokens · {{ item.latency_ms || 0 }} ms
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <span class="msg-count">{{ messages.length }} / {{ messageTotal }} 条消息</span>
        <button class="rs-btn" type="button" @click="messagesVisible = false">关闭</button>
      </template>
    </AppModal>

    <!-- 删除确认 -->
    <AppModal v-model="confirmVisible" title="删除会话" width="440px" :close-on-mask="!submitting">
      <p class="confirm-text">
        确定要删除会话「<b>{{ confirmTarget?.title }}</b>」（#{{ confirmTarget?.id }}）吗？<br />
        该会话的全部消息记录会一并删除，且不可恢复。
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
// 智能体会话：GET /api/admin/ai-sessions（keyword/model/username/dateFrom/dateTo + 分页）。
// 消息 GET /api/admin/ai-sessions/:id/messages 走 pageQuery，单页上限 200 条，超出时前端顺序补拉。
// 删除 DELETE /api/admin/ai-sessions/:id（服务端在同一事务内级联删除 ai_messages）。
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'
import AppModal from '../../components/common/AppModal.vue'

const loading = ref(false)
const submitting = ref(false)
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)

const filters = reactive({ keyword: '', username: '', model: '', dateFrom: '', dateTo: '' })

// 输入建议：取当前页出现过的值，避免新增接口（筛选仍是精确匹配）
const userSuggestions = computed(() => uniqueOf('username'))
const modelSuggestions = computed(() => uniqueOf('model'))

const uniqueOf = (key) => {
  const set = new Set()
  for (const row of rows.value) {
    if (row[key]) set.add(row[key])
  }
  return [...set]
}

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/ai-sessions', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword,
        username: filters.username,
        model: filters.model,
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
  filters.username = ''
  filters.model = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  search()
}

// —— 查看对话 ——
const messagesVisible = ref(false)
const messagesLoading = ref(false)
const messages = ref([])
const messageTotal = ref(0)
const messageSession = ref(null)
const msgBody = ref(null)

const messagesTitle = computed(() =>
  messageSession.value ? `会话 #${messageSession.value.id} · ${messageSession.value.title || '未命名'}` : '会话对话'
)

const openMessages = async (row) => {
  messageSession.value = row
  messages.value = []
  messageTotal.value = 0
  messagesVisible.value = true
  messagesLoading.value = true
  try {
    // 后端 parsePagination 单页上限 200，会话很长时分页顺序补拉（最多 10 页）
    const first = await http.get(`/admin/ai-sessions/${row.id}/messages`, { params: { page: 1, pageSize: 200 } })
    const list = [...(first?.list || [])]
    const pages = Math.min(Number(first?.totalPages || 1), 10)
    for (let index = 2; index <= pages; index += 1) {
      const next = await http.get(`/admin/ai-sessions/${row.id}/messages`, { params: { page: index, pageSize: 200 } })
      list.push(...(next?.list || []))
    }
    messages.value = list
    messageTotal.value = Number(first?.total || 0)
    if (first?.session) messageSession.value = first.session
    await nextTick()
    if (msgBody.value) msgBody.value.scrollTop = msgBody.value.scrollHeight
  } catch (e) {
    toast.error(e.message)
  } finally {
    messagesLoading.value = false
  }
}

const ROLE_LABELS = { user: '用户', assistant: '智能体', system: '系统', tool: '工具' }
const roleLabel = (role) => ROLE_LABELS[role] || role || '未知'

// user 靠右蓝色气泡，assistant 靠左深色气泡，其余（system/tool）居中弱化
const roleRowClass = (role) => {
  if (role === 'user') return 'right'
  if (role === 'assistant') return 'left'
  return 'center'
}

const roleBubbleClass = (role) => {
  if (role === 'user') return 'user'
  if (role === 'assistant') return 'assistant'
  return 'other'
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
    await http.del(`/admin/ai-sessions/${confirmTarget.value.id}`)
    toast.success('会话已删除')
    confirmVisible.value = false
    if (messageSession.value?.id === confirmTarget.value.id) messagesVisible.value = false
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

const columns = [
  { key: 'id', title: 'ID', width: '80px' },
  { key: 'title', title: '标题', width: '260px', tip: true },
  { key: 'username', title: '所属用户', width: '120px' },
  { key: 'model', title: '模型', width: '150px' },
  { key: 'message_count', title: '消息条数', width: '100px' },
  { key: 'created_at', title: '创建时间', width: '170px' },
  { key: 'updated_at', title: '更新时间', width: '170px' },
  { key: 'actions', title: '操作', width: '170px' },
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

.title-text {
  color: var(--rs-text-strong);
}

.suggest-input {
  min-width: 150px;
  color-scheme: dark;
}

.date-input {
  min-width: 140px;
}

.range-sep {
  font-size: 13px;
  color: var(--rs-text-dim);
}

/* —— 对话气泡 —— */
.msg-state {
  padding: 30px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--rs-text-dim);
}

.msg-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 56vh;
  overflow-y: auto;
  padding-right: 6px;
}

.msg-row {
  display: flex;
}

.msg-row.right {
  justify-content: flex-end;
}

.msg-row.left {
  justify-content: flex-start;
}

.msg-row.center {
  justify-content: center;
}

.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--rs-panel-border);
  background: rgba(0, 40, 70, 0.5);
  font-size: 13px;
  line-height: 1.7;
}

.bubble.user {
  background: rgba(0, 120, 200, 0.35);
  border-color: rgba(0, 200, 255, 0.55);
}

.bubble.assistant {
  background: rgba(6, 26, 46, 0.95);
}

.bubble.other {
  max-width: 100%;
  background: rgba(0, 20, 40, 0.7);
  border-color: rgba(127, 163, 184, 0.3);
}

.bubble-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--rs-text-dim);
}

.bubble-role {
  color: var(--rs-primary);
  font-weight: bold;
}

.bubble-text {
  color: var(--rs-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-foot {
  margin-top: 8px;
  font-size: 11px;
  color: var(--rs-text-dim);
}

.msg-count {
  margin-right: auto;
  font-size: 12px;
  color: var(--rs-text-dim);
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
