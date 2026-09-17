<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>用户管理</h2>
        <div class="sub">账号、角色与状态维护 · 危险操作均需二次确认</div>
      </div>
      <div class="page-actions">
        <button class="rs-btn primary" type="button" @click="openCreate">➕ 新增用户</button>
      </div>
    </div>

    <!-- 筛选区：keyword/role/status/dateFrom/dateTo 均为服务端查询参数 -->
    <div class="filter-bar">
      <input v-model="filters.keyword" class="rs-input" placeholder="用户名 / 姓名 / 手机号 / 邮箱" @keyup.enter="search" />
      <select v-model="filters.role" class="rs-select">
        <option value="">全部角色</option>
        <option v-for="item in ROLE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <select v-model="filters.status" class="rs-select">
        <option value="">全部状态</option>
        <option value="active">启用</option>
        <option value="disabled">禁用</option>
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
      <template #cell-role="{ row }">
        <span class="rs-tag" :class="ROLE_CLASSES[row.role] || 'gray'">{{ ROLE_LABELS[row.role] || row.role }}</span>
      </template>
      <template #cell-status="{ row }">
        <span class="rs-tag" :class="row.status === 'active' ? 'green' : 'red'">
          {{ row.status === 'active' ? '启用' : '禁用' }}
        </span>
      </template>
      <template #cell-login_count="{ row }">
        {{ row.login_count ?? 0 }}
      </template>
      <template #cell-last_login_at="{ row }">
        {{ formatTime(row.last_login_at) }}
      </template>
      <template #cell-created_at="{ row }">
        {{ formatTime(row.created_at) }}
      </template>
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button class="rs-btn small" type="button" @click="openEdit(row)">编辑</button>
          <button class="rs-btn small" type="button" @click="openRole(row)">改角色</button>
          <button class="rs-btn small" type="button" @click="openReset(row)">重置密码</button>
          <button
            class="rs-btn small"
            :class="{ danger: row.status === 'active' }"
            type="button"
            :disabled="isSelf(row)"
            :title="isSelf(row) ? '不能操作当前登录账号' : ''"
            @click="openToggleStatus(row)"
          >
            {{ row.status === 'active' ? '禁用' : '启用' }}
          </button>
          <button
            class="rs-btn small danger"
            type="button"
            :disabled="isSelf(row)"
            :title="isSelf(row) ? '不能删除当前登录账号' : ''"
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

    <!-- 新增 / 编辑用户 -->
    <AppModal v-model="formVisible" :title="form.id ? '编辑用户' : '新增用户'" width="560px" :close-on-mask="!submitting">
      <div class="form-grid">
        <div class="rs-field">
          <label>用户名 <span class="req">*</span></label>
          <input
            v-model="form.username"
            class="rs-input"
            :disabled="Boolean(form.id)"
            placeholder="字母开头，4-20 位字母数字下划线"
          />
        </div>
        <div class="rs-field">
          <label>姓名 <span class="req">*</span></label>
          <input v-model="form.name" class="rs-input" placeholder="至少 2 个字符" />
        </div>
        <div class="rs-field">
          <label>角色 <span class="req">*</span></label>
          <select v-model="form.role" class="rs-select">
            <option v-for="item in ROLE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
        <div class="rs-field">
          <label>状态</label>
          <select v-model="form.status" class="rs-select">
            <option value="active">启用</option>
            <option value="disabled">禁用</option>
          </select>
        </div>
        <div v-if="!form.id" class="rs-field">
          <label>初始密码</label>
          <input v-model="form.password" class="rs-input" type="text" placeholder="留空则使用默认密码 Init@1234（至少 8 位）" />
        </div>
        <div class="rs-field">
          <label>手机号</label>
          <input v-model="form.phone" class="rs-input" placeholder="选填" />
        </div>
        <div class="rs-field">
          <label>邮箱</label>
          <input v-model="form.email" class="rs-input" placeholder="选填" />
        </div>
        <div class="rs-field full">
          <label>备注</label>
          <textarea v-model="form.remark" class="rs-textarea" placeholder="选填"></textarea>
        </div>
      </div>
      <template #footer>
        <button class="rs-btn" type="button" :disabled="submitting" @click="formVisible = false">取消</button>
        <button class="rs-btn primary" type="button" :disabled="submitting" @click="submitForm">
          {{ submitting ? '提交中…' : '保存' }}
        </button>
      </template>
    </AppModal>

    <!-- 修改角色 -->
    <AppModal v-model="roleVisible" title="调整角色" width="420px" :close-on-mask="!submitting">
      <p class="confirm-text">
        用户 <b>{{ roleTarget?.username }}</b> 当前角色为
        <span class="rs-tag" :class="ROLE_CLASSES[roleTarget?.role] || 'gray'">
          {{ ROLE_LABELS[roleTarget?.role] || roleTarget?.role }}
        </span>
      </p>
      <div class="rs-field">
        <label>新角色</label>
        <select v-model="roleValue" class="rs-select">
          <option v-for="item in ROLE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </div>
      <template #footer>
        <button class="rs-btn" type="button" :disabled="submitting" @click="roleVisible = false">取消</button>
        <button class="rs-btn primary" type="button" :disabled="submitting" @click="submitRole">
          {{ submitting ? '提交中…' : '确定' }}
        </button>
      </template>
    </AppModal>

    <!-- 通用二次确认框：禁用/启用、重置密码、删除 -->
    <AppModal
      v-model="confirmState.visible"
      :title="confirmState.title"
      width="440px"
      :close-on-mask="!confirmState.submitting"
    >
      <p class="confirm-text">{{ confirmState.message }}</p>
      <div v-if="confirmState.withInput" class="rs-field">
        <label>{{ confirmState.inputLabel }}</label>
        <input v-model="confirmState.inputValue" class="rs-input" :placeholder="confirmState.placeholder" />
      </div>
      <template #footer>
        <button class="rs-btn" type="button" :disabled="confirmState.submitting" @click="confirmState.visible = false">取消</button>
        <button
          class="rs-btn"
          :class="confirmState.danger ? 'danger' : 'primary'"
          type="button"
          :disabled="confirmState.submitting"
          @click="runConfirm"
        >
          {{ confirmState.submitting ? '处理中…' : confirmState.confirmText }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
// 用户管理：列表接口 GET /api/admin/users（keyword/role/status/dateFrom/dateTo + 分页）。
import { onMounted, reactive, ref } from 'vue'
import http from '../../services/http.js'
import { toast } from '../../components/common/AppToast.vue'
import { authState } from '../../services/auth.js'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'
import AppModal from '../../components/common/AppModal.vue'

// 角色取值来自 server/api/lib/db.js 的 ROLES 与 ROLE_SEED
const ROLE_OPTIONS = [
  { value: 'admin', label: '超级管理员' },
  { value: 'operator', label: '运维人员' },
  { value: 'user', label: '普通用户' },
]
const ROLE_LABELS = { admin: '超级管理员', operator: '运维人员', user: '普通用户' }
const ROLE_CLASSES = { admin: 'orange', operator: 'blue', user: 'gray' }

const loading = ref(false)
const submitting = ref(false)
const rows = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(10)

const filters = reactive({ keyword: '', role: '', status: '', dateFrom: '', dateTo: '' })

const isSelf = (row) => Number(row.id) === Number(authState.user?.id)

const load = async () => {
  loading.value = true
  try {
    const data = await http.get('/admin/users', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: filters.keyword,
        role: filters.role,
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
    })
    rows.value = data?.list || []
    total.value = Number(data?.total || 0)
    totalPages.value = Number(data?.totalPages || 1)
    // 删除末页最后一条后回退页码
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
  filters.role = ''
  filters.status = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  search()
}

// —— 新增 / 编辑 ——
const formVisible = ref(false)
const form = reactive({ id: 0, username: '', name: '', role: 'user', status: 'active', password: '', phone: '', email: '', remark: '' })

const openCreate = () => {
  Object.assign(form, { id: 0, username: '', name: '', role: 'user', status: 'active', password: '', phone: '', email: '', remark: '' })
  formVisible.value = true
}

const openEdit = (row) => {
  Object.assign(form, {
    id: row.id,
    username: row.username || '',
    name: row.name || '',
    role: row.role || 'user',
    status: row.status || 'active',
    password: '',
    phone: row.phone || '',
    email: row.email || '',
    remark: row.remark || '',
  })
  formVisible.value = true
}

const submitForm = async () => {
  if (submitting.value) return
  if (!form.id && !/^[A-Za-z][A-Za-z0-9_]{3,19}$/.test(form.username.trim())) {
    toast.error('用户名需以字母开头，4-20 位字母数字下划线')
    return
  }
  if (form.name.trim().length < 2) {
    toast.error('姓名至少 2 个字符')
    return
  }
  if (!form.id && form.password && form.password.length < 8) {
    toast.error('密码至少 8 位')
    return
  }
  submitting.value = true
  try {
    if (form.id) {
      // PUT 不接收密码字段
      await http.put(`/admin/users/${form.id}`, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        role: form.role,
        status: form.status,
        remark: form.remark.trim(),
      })
      toast.success('用户信息已更新')
    } else {
      await http.post('/admin/users', {
        username: form.username.trim(),
        name: form.name.trim(),
        role: form.role,
        password: form.password,
        phone: form.phone.trim(),
        email: form.email.trim(),
        remark: form.remark.trim(),
      })
      toast.success('用户已创建')
    }
    formVisible.value = false
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

// —— 修改角色 ——
const roleVisible = ref(false)
const roleTarget = ref(null)
const roleValue = ref('user')

const openRole = (row) => {
  roleTarget.value = row
  roleValue.value = row.role || 'user'
  roleVisible.value = true
}

const submitRole = async () => {
  if (submitting.value || !roleTarget.value) return
  if (roleValue.value === roleTarget.value.role) {
    toast.info('角色未发生变化')
    roleVisible.value = false
    return
  }
  submitting.value = true
  try {
    await http.put(`/admin/users/${roleTarget.value.id}/role`, { role: roleValue.value })
    toast.success('角色已调整')
    roleVisible.value = false
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    submitting.value = false
  }
}

// —— 二次确认（禁用/启用、重置密码、删除） ——
const confirmState = reactive({
  visible: false,
  title: '',
  message: '',
  confirmText: '确定',
  danger: false,
  withInput: false,
  inputLabel: '',
  inputValue: '',
  placeholder: '',
  submitting: false,
  action: null,
})

const openConfirm = (options) => {
  Object.assign(confirmState, {
    visible: true,
    title: options.title,
    message: options.message,
    confirmText: options.confirmText || '确定',
    danger: Boolean(options.danger),
    withInput: Boolean(options.withInput),
    inputLabel: options.inputLabel || '',
    inputValue: options.inputValue || '',
    placeholder: options.placeholder || '',
    submitting: false,
    action: options.action,
  })
}

const runConfirm = async () => {
  if (confirmState.submitting || !confirmState.action) return
  confirmState.submitting = true
  try {
    await confirmState.action()
    confirmState.visible = false
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    confirmState.submitting = false
  }
}

const openToggleStatus = (row) => {
  const next = row.status === 'active' ? 'disabled' : 'active'
  openConfirm({
    title: next === 'disabled' ? '禁用用户' : '启用用户',
    message: `确定要${next === 'disabled' ? '禁用' : '启用'}用户「${row.username}」吗？${next === 'disabled' ? '禁用后该账号将无法登录。' : ''}`,
    confirmText: next === 'disabled' ? '确定禁用' : '确定启用',
    danger: next === 'disabled',
    action: async () => {
      await http.put(`/admin/users/${row.id}/status`, { status: next })
      toast.success(next === 'disabled' ? '用户已禁用' : '用户已启用')
    },
  })
}

const openDelete = (row) => {
  openConfirm({
    title: '删除用户',
    message: `确定要删除用户「${row.username}」吗？该操作不可恢复。`,
    confirmText: '确定删除',
    danger: true,
    action: async () => {
      await http.del(`/admin/users/${row.id}`)
      toast.success('用户已删除')
    },
  })
}

const openReset = (row) => {
  openConfirm({
    title: '重置密码',
    message: `将重置用户「${row.username}」的登录密码，重置后请及时告知本人。`,
    confirmText: '确定重置',
    danger: true,
    withInput: true,
    inputLabel: '新密码',
    inputValue: '',
    placeholder: '留空则使用默认密码 Reset@1234（至少 8 位）',
    action: async () => {
      const password = confirmState.inputValue.trim()
      if (password && password.length < 8) throw new Error('密码至少 8 位')
      const data = await http.post(`/admin/users/${row.id}/reset-password`, { password })
      toast.success(`密码已重置为：${data?.password || password || 'Reset@1234'}`, 8000)
    },
  })
}

// —— 表格列 ——
const columns = [
  { key: 'username', title: '用户名', width: '130px' },
  { key: 'name', title: '姓名', width: '100px' },
  { key: 'role', title: '角色', width: '110px' },
  { key: 'status', title: '状态', width: '80px' },
  { key: 'phone', title: '手机号', width: '130px' },
  { key: 'email', title: '邮箱', tip: true },
  { key: 'login_count', title: '登录次数', width: '90px', align: 'center' },
  { key: 'last_login_at', title: '最近登录时间', width: '170px' },
  { key: 'last_login_ip', title: '最近登录IP', width: '140px' },
  { key: 'created_at', title: '创建时间', width: '170px' },
  { key: 'actions', title: '操作', width: '300px' },
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
.date-input {
  min-width: 140px;
}

.range-sep {
  font-size: 13px;
  color: var(--rs-text-dim);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0 14px;
}

.form-grid .full {
  grid-column: 1 / -1;
}

.confirm-text {
  font-size: 14px;
  color: var(--rs-text);
  line-height: 1.7;
  margin-bottom: 12px;
}

.confirm-text b {
  color: var(--rs-primary);
}
</style>
