<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>角色权限</h2>
        <div class="sub">角色与权限点分配 · 权限目录来自 GET /api/admin/permissions</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn" type="button" :disabled="loading" @click="load">刷新</button>
        <button class="rs-btn primary" type="button" @click="openCreate">➕ 新增角色</button>
      </div>
    </div>

    <div class="filter-bar">
      <input v-model="filters.keyword" class="rs-input" placeholder="角色码 / 名称 / 描述" @keyup.enter="search" />
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
        <span v-if="isBuiltIn(row)" class="rs-tag gray built-tag">内置</span>
      </template>
      <template #cell-permissions="{ row }">
        <span v-if="isSuper(row)" class="rs-tag orange">超级管理员</span>
        <span v-else class="rs-tag blue">{{ countOf(row) }} 个权限点</span>
      </template>
      <template #cell-created_at="{ row }">
        {{ formatTime(row.created_at) }}
      </template>
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button
            class="rs-btn small"
            type="button"
            :title="row.code === 'admin' ? '超级管理员角色只读，不可修改权限' : ''"
            @click="openEdit(row)"
          >
            {{ row.code === 'admin' ? '查看' : '编辑' }}
          </button>
          <button
            class="rs-btn small danger"
            type="button"
            :disabled="isBuiltIn(row)"
            :title="isBuiltIn(row) ? '内置角色不可删除' : ''"
            @click="openDelete(row)"
          >
            删除
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

    <!-- 新增 / 编辑角色 -->
    <AppModal v-model="formVisible" :title="formTitle" width="720px" :close-on-mask="!submitting">
      <div class="form-grid">
        <div class="rs-field">
          <label>角色码 <span v-if="!form.editing" class="req">*</span></label>
          <input
            v-model="form.code"
            class="rs-input"
            :disabled="form.editing || form.locked"
            placeholder="2-20 位小写字母数字，如 operator"
          />
        </div>
        <div class="rs-field">
          <label>角色名称 <span class="req">*</span></label>
          <input v-model="form.name" class="rs-input" :disabled="form.locked" placeholder="如 运维人员" />
        </div>
        <div class="rs-field">
          <label>排序</label>
          <input v-model.number="form.sort" class="rs-input" type="number" min="1" :disabled="form.locked" placeholder="数值越小越靠前" />
        </div>
        <div class="rs-field full">
          <label>角色描述</label>
          <textarea v-model="form.description" class="rs-textarea" :disabled="form.locked" placeholder="选填"></textarea>
        </div>
      </div>

      <!-- 权限点：按角色码前缀分组的多选框（权限目录为扁平数组，前端按模块归组展示） -->
      <div class="perm-head">
        <span class="perm-title">权限点</span>
        <span class="perm-count">已选 {{ form.permissions.length }} 项</span>
        <div class="spacer"></div>
        <button class="rs-btn small" type="button" :disabled="form.locked || isSuperForm" @click="selectAll">
          全选
        </button>
        <button class="rs-btn small" type="button" :disabled="form.locked || isSuperForm" @click="clearAll">
          清空
        </button>
      </div>

      <div v-if="isSuperForm" class="super-note">
        🛡️ 该角色拥有 <b>*</b>（全部权限），代表超级管理员，权限点不可拆分修改。
      </div>

      <div v-if="permissionsLoading" class="perm-empty">权限目录加载中…</div>
      <div v-else-if="!permissionGroups.length" class="perm-empty">未能加载权限目录</div>
      <div v-else class="perm-groups">
        <div v-for="group in permissionGroups" :key="group.key" class="perm-group">
          <div class="perm-group-head">
            <span class="perm-group-title">{{ group.label }}</span>
            <button
              class="rs-btn small"
              type="button"
              :disabled="form.locked || isSuperForm"
              @click="toggleGroup(group)"
            >
              {{ groupAllChecked(group) ? '取消全选' : '全选本组' }}
            </button>
          </div>
          <div class="perm-items">
            <label v-for="item in group.items" :key="item.code" class="perm-item">
              <input
                type="checkbox"
                :checked="form.permissions.includes(item.code)"
                :disabled="form.locked || isSuperForm"
                @change="togglePermission(item.code)"
              />
              <span class="perm-name">{{ item.name }}</span>
              <span class="perm-code">{{ item.code }}</span>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="rs-btn" type="button" :disabled="submitting" @click="formVisible = false">
          {{ form.locked ? '关闭' : '取消' }}
        </button>
        <button v-if="!form.locked" class="rs-btn primary" type="button" :disabled="submitting" @click="submitForm">
          {{ submitting ? '提交中…' : '保存' }}
        </button>
      </template>
    </AppModal>

    <!-- 删除确认 -->
    <AppModal v-model="confirmVisible" title="删除角色" width="440px" :close-on-mask="!submitting">
      <p class="confirm-text">
        确定要删除角色「<b>{{ confirmTarget?.name }}</b>（{{ confirmTarget?.code }}）」吗？该操作不可恢复。
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
// 角色权限：GET /api/admin/roles（keyword + 分页）、GET /api/admin/permissions（扁平权限目录）。
// PUT /api/admin/roles/:code 与 POST 共用 saveRole，均需在 body 中携带 code。
import { computed, onMounted, reactive, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'
import AppModal from '../../components/common/AppModal.vue'

const loading = ref(false)
const permissionsLoading = ref(false)
const submitting = ref(false)
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)
const permissions = ref([])

const filters = reactive({ keyword: '' })

const isBuiltIn = (row) => Number(row.built_in) === 1
const isSuper = (row) => Array.isArray(row.permissionList) && row.permissionList.includes('*')
const countOf = (row) => (Array.isArray(row.permissionList) ? row.permissionList.length : 0)

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/roles', {
      params: { page: page.value, pageSize: pageSize.value, keyword: filters.keyword },
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
  search()
}

// —— 权限目录：接口返回扁平数组 [{code, name}]，按 code 前缀归组便于勾选 ——
const MODULE_LABELS = {
  dashboard: '概览统计',
  users: '用户管理',
  roles: '角色权限',
  signals: '信号机管理',
  alarms: '告警记录',
  'work-orders': '工单管理',
  telemetry: '遥测记录',
  logs: '日志管理',
  ai: '智能体',
  system: '系统设置',
}

const loadPermissions = async () => {
  permissionsLoading.value = true
  try {
    const data = await http.get('/admin/permissions')
    permissions.value = data?.permissions || []
  } catch (e) {
    toast.error(e.message)
  } finally {
    permissionsLoading.value = false
  }
}

const permissionGroups = computed(() => {
  const groups = []
  const index = new Map()
  for (const item of permissions.value) {
    const key = String(item.code || '').split(':')[0] || 'other'
    if (!index.has(key)) {
      const group = { key, label: MODULE_LABELS[key] || key, items: [] }
      index.set(key, group)
      groups.push(group)
    }
    index.get(key).items.push(item)
  }
  return groups
})

// —— 新增 / 编辑角色 ——
const formVisible = ref(false)
const form = reactive({ editing: false, locked: false, code: '', name: '', description: '', sort: 99, permissions: [] })

const isSuperForm = computed(() => form.permissions.includes('*'))
const formTitle = computed(() => (form.locked ? '查看角色' : form.editing ? '编辑角色' : '新增角色'))

const openCreate = () => {
  Object.assign(form, { editing: false, locked: false, code: '', name: '', description: '', sort: 99, permissions: [] })
  formVisible.value = true
}

const openEdit = (row) => {
  Object.assign(form, {
    editing: true,
    // 内置超级管理员角色服务端禁止修改，这里以只读方式打开
    locked: row.code === 'admin',
    code: row.code || '',
    name: row.name || '',
    description: row.description || '',
    sort: Number(row.sort) || 99,
    permissions: Array.isArray(row.permissionList) ? [...row.permissionList] : [],
  })
  formVisible.value = true
}

const togglePermission = (code) => {
  const list = form.permissions
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
  else list.push(code)
}

const groupAllChecked = (group) => group.items.every((item) => form.permissions.includes(item.code))

const toggleGroup = (group) => {
  if (groupAllChecked(group)) {
    form.permissions = form.permissions.filter((code) => !group.items.some((item) => item.code === code))
    return
  }
  const merged = new Set(form.permissions)
  for (const item of group.items) merged.add(item.code)
  form.permissions = [...merged]
}

const selectAll = () => {
  form.permissions = permissions.value.map((item) => item.code)
}

const clearAll = () => {
  form.permissions = []
}

const submitForm = async () => {
  if (submitting.value) return
  const code = String(form.code || '').trim().toLowerCase()
  const name = String(form.name || '').trim()
  if (!/^[a-z][a-z0-9_-]{1,19}$/.test(code)) {
    toast.error('角色码需为 2-20 位小写字母数字（可含 - 与 _）')
    return
  }
  if (!name) {
    toast.error('请填写角色名称')
    return
  }
  if (!form.permissions.length) {
    toast.error('请至少勾选一个权限点')
    return
  }
  submitting.value = true
  try {
    const body = {
      code,
      name,
      description: String(form.description || '').trim(),
      sort: Number(form.sort) || 99,
      permissions: [...form.permissions],
    }
    if (form.editing) {
      await http.put(`/admin/roles/${encodeURIComponent(code)}`, body)
      toast.success('角色已更新')
    } else {
      await http.post('/admin/roles', body)
      toast.success('角色已创建')
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
    await http.del(`/admin/roles/${encodeURIComponent(confirmTarget.value.code)}`)
    toast.success('角色已删除')
    confirmVisible.value = false
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

const columns = [
  { key: 'code', title: '角色码', width: '150px' },
  { key: 'name', title: '名称', width: '130px' },
  { key: 'description', title: '描述', tip: true },
  { key: 'permissions', title: '权限点', width: '140px' },
  { key: 'sort', title: '排序', width: '80px', align: 'center' },
  { key: 'created_at', title: '创建时间', width: '170px' },
  { key: 'actions', title: '操作', width: '160px' },
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
  loadPermissions()
})
</script>

<style scoped>
.code-text {
  color: var(--rs-primary);
  font-weight: bold;
}

.built-tag {
  margin-left: 6px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0 14px;
}

.form-grid .full {
  grid-column: 1 / -1;
}

.perm-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
  margin-bottom: 10px;
  border-top: 1px solid var(--rs-panel-border);
}

.perm-head .spacer {
  flex: 1;
}

.perm-title {
  font-size: 13px;
  color: var(--rs-text-dim);
  padding-top: 12px;
}

.perm-count {
  font-size: 12px;
  color: var(--rs-primary);
  padding-top: 12px;
}

.perm-head .rs-btn {
  margin-top: 12px;
}

.super-note {
  padding: 10px 12px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #ffce7a;
  background: rgba(245, 166, 35, 0.12);
  border: 1px solid rgba(245, 166, 35, 0.45);
  border-radius: var(--rs-radius);
}

.perm-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--rs-text-dim);
}

.perm-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 340px;
  overflow-y: auto;
  padding-right: 4px;
}

.perm-group {
  border: 1px solid rgba(0, 200, 255, 0.18);
  border-radius: var(--rs-radius);
  padding: 10px 12px;
  background: rgba(0, 40, 70, 0.25);
}

.perm-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.perm-group-title {
  font-size: 13px;
  font-weight: bold;
  color: var(--rs-text-strong);
}

.perm-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 6px 10px;
}

.perm-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--rs-text);
  cursor: pointer;
}

.perm-item input[type='checkbox'] {
  accent-color: var(--rs-primary);
  cursor: pointer;
}

.perm-item input[type='checkbox']:disabled {
  cursor: not-allowed;
}

.perm-name {
  white-space: nowrap;
}

.perm-code {
  font-size: 11px;
  color: var(--rs-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
