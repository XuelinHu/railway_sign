<template>
  <div class="profile-page">
    <header class="profile-head">
      <div class="head-left">
        <button class="rs-btn small" type="button" @click="router.push('/')">← 返回平台</button>
        <h2>个人中心</h2>
      </div>
      <button class="rs-btn danger small" type="button" @click="onLogout">退出登录</button>
    </header>

    <div class="profile-body">
      <!-- 账号概览 -->
      <section class="rs-panel overview">
        <div class="avatar">{{ avatarText }}</div>
        <div class="overview-main">
          <div class="name-row">
            <b>{{ user.name || user.username || '未登录' }}</b>
            <span class="rs-tag blue">{{ roleLabel }}</span>
          </div>
          <div class="sub">用户名：{{ user.username || '-' }}</div>
          <div class="sub">注册时间：{{ formatTime(user.created_at) }} · 累计登录 {{ user.login_count ?? 0 }} 次</div>
        </div>
        <div class="overview-stats">
          <div class="stat-item">
            <span class="label">权限点</span>
            <b>{{ permissionText }}</b>
          </div>
          <div class="stat-item">
            <span class="label">最近登录时间</span>
            <b>{{ formatTime(user.last_login_at) }}</b>
          </div>
          <div class="stat-item">
            <span class="label">最近登录 IP</span>
            <b>{{ user.last_login_ip || '-' }}</b>
          </div>
        </div>
      </section>

      <div class="profile-grid">
        <!-- 一、基本资料 -->
        <section class="rs-panel card">
          <h3 class="card-title">基本资料</h3>
          <form @submit.prevent="onSaveProfile">
            <div class="rs-field">
              <label for="pf-username">用户名</label>
              <input id="pf-username" :value="user.username || ''" class="rs-input" type="text" readonly />
            </div>
            <div class="rs-field">
              <label for="pf-name">姓名 <span class="req">*</span></label>
              <input
                id="pf-name"
                v-model.trim="profileForm.name"
                :class="['rs-input', { 'has-error': showProfileError('name') }]"
                type="text"
                placeholder="2-20 位"
                @blur="touchProfile('name')"
              />
              <p v-if="showProfileError('name')" class="field-error">{{ profileErrors.name }}</p>
            </div>
            <div class="rs-field">
              <label for="pf-phone">手机号</label>
              <input
                id="pf-phone"
                v-model.trim="profileForm.phone"
                :class="['rs-input', { 'has-error': showProfileError('phone') }]"
                type="text"
                maxlength="11"
                placeholder="选填"
                @blur="touchProfile('phone')"
              />
              <p v-if="showProfileError('phone')" class="field-error">{{ profileErrors.phone }}</p>
            </div>
            <div class="rs-field">
              <label for="pf-email">邮箱</label>
              <input
                id="pf-email"
                v-model.trim="profileForm.email"
                :class="['rs-input', { 'has-error': showProfileError('email') }]"
                type="text"
                placeholder="选填"
                @blur="touchProfile('email')"
              />
              <p v-if="showProfileError('email')" class="field-error">{{ profileErrors.email }}</p>
            </div>
            <button class="rs-btn primary block" type="submit" :disabled="savingProfile">
              {{ savingProfile ? '保存中…' : '保存资料' }}
            </button>
          </form>
        </section>

        <!-- 二、修改密码 -->
        <section class="rs-panel card">
          <h3 class="card-title">修改密码</h3>
          <form @submit.prevent="onChangePassword">
            <div class="rs-field">
              <label for="pw-old">原密码 <span class="req">*</span></label>
              <input
                id="pw-old"
                v-model="passwordForm.oldPassword"
                class="rs-input"
                type="password"
                autocomplete="current-password"
                placeholder="请输入当前登录密码"
              />
            </div>
            <div class="rs-field">
              <label for="pw-new">新密码 <span class="req">*</span></label>
              <input
                id="pw-new"
                v-model="passwordForm.newPassword"
                :class="['rs-input', { 'has-error': showPasswordError('newPassword') }]"
                type="password"
                autocomplete="new-password"
                placeholder="8-64 位，含字母和数字"
                @blur="touchPassword('newPassword')"
              />
              <p v-if="showPasswordError('newPassword')" class="field-error">{{ passwordErrors.newPassword }}</p>
            </div>
            <div class="rs-field">
              <label for="pw-confirm">确认新密码 <span class="req">*</span></label>
              <input
                id="pw-confirm"
                v-model="passwordForm.confirmPassword"
                :class="['rs-input', { 'has-error': showPasswordError('confirmPassword') }]"
                type="password"
                autocomplete="new-password"
                placeholder="请再次输入新密码"
                @blur="touchPassword('confirmPassword')"
              />
              <p v-if="showPasswordError('confirmPassword')" class="field-error">{{ passwordErrors.confirmPassword }}</p>
            </div>
            <button class="rs-btn primary block" type="submit" :disabled="savingPassword">
              {{ savingPassword ? '提交中…' : '修改密码' }}
            </button>
            <p class="hint">修改成功后当前令牌会失效，需要使用新密码重新登录。</p>
          </form>
        </section>
      </div>

      <!-- 三、我的登录记录 -->
      <section class="rs-panel card">
        <div class="card-head">
          <h3 class="card-title">我的登录记录</h3>
          <button class="rs-btn small" type="button" :disabled="logsLoading" @click="loadLogs">刷新</button>
        </div>
        <DataTable
          :columns="columns"
          :rows="logs"
          :loading="logsLoading"
          row-key="id"
          :index="true"
          :index-base="(page - 1) * pageSize"
        >
          <template #cell-success="{ row }">
            <span :class="['rs-tag', Number(row.success) === 1 ? 'green' : 'red']">
              {{ Number(row.success) === 1 ? '成功' : '失败' }}
            </span>
          </template>
        </DataTable>
        <Pagination
          v-model:page="page"
          v-model:pageSize="pageSize"
          :total="total"
          :total-pages="totalPages"
          @change="loadLogs"
        />
      </section>
    </div>
  </div>
</template>

<script setup>
// 个人中心：基本资料 / 修改密码 / 我的登录记录。
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authState, logout, updateProfile, changePassword, myLoginLogs } from '../../services/auth.js'
import { toast } from '../../components/common/AppToast.vue'
import DataTable from '../../components/common/DataTable.vue'
import Pagination from '../../components/common/Pagination.vue'

const router = useRouter()

const PHONE_RE = /^1[3-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLE_LABELS = { admin: '管理员', operator: '运维人员', user: '普通用户' }

const user = computed(() => authState.user || {})
const roleLabel = computed(() => ROLE_LABELS[user.value.role] || '普通用户')
const avatarText = computed(() => {
  const text = String(user.value.name || user.value.username || '用').trim()
  return text.slice(0, 1).toUpperCase()
})
const permissionText = computed(() => {
  const list = authState.permissions || []
  return list.includes('*') ? `全部权限（${list.length}）` : `${list.length} 个`
})

const formatTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/* —— 基本资料 —— */
const profileForm = reactive({ name: '', phone: '', email: '' })
const profileErrors = reactive({ name: '', phone: '', email: '' })
const profileTouched = reactive({ name: false, phone: false, email: false })
const savingProfile = ref(false)

const syncProfileForm = () => {
  profileForm.name = user.value.name || ''
  profileForm.phone = user.value.phone || ''
  profileForm.email = user.value.email || ''
}

const profileValidators = {
  name: (value) => {
    if (!value) return '请输入姓名'
    return value.length >= 2 && value.length <= 20 ? '' : '姓名长度需为 2-20 位'
  },
  phone: (value) => (!value ? '' : PHONE_RE.test(value) ? '' : '手机号格式不正确'),
  email: (value) => (!value ? '' : EMAIL_RE.test(value) ? '' : '邮箱格式不正确'),
}

const validateProfileField = (key) => {
  profileErrors[key] = profileValidators[key](String(profileForm[key] ?? '').trim())
  return !profileErrors[key]
}

const touchProfile = (key) => {
  profileTouched[key] = true
  validateProfileField(key)
}

const showProfileError = (key) => Boolean(profileTouched[key] && profileErrors[key])

const onSaveProfile = async () => {
  if (savingProfile.value) return
  const keys = ['name', 'phone', 'email']
  keys.forEach((key) => {
    profileTouched[key] = true
  })
  keys.forEach((key) => validateProfileField(key))
  const firstError = keys.find((key) => profileErrors[key])
  if (firstError) return toast.error(profileErrors[firstError])

  savingProfile.value = true
  try {
    const data = await updateProfile({
      name: String(profileForm.name).trim(),
      phone: String(profileForm.phone).trim(),
      email: String(profileForm.email).trim(),
    })
    if (data?.user) authState.user = data.user
    toast.success('资料已保存')
  } catch (error) {
    toast.error(error.message)
  } finally {
    savingProfile.value = false
  }
}

/* —— 修改密码 —— */
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const passwordErrors = reactive({ newPassword: '', confirmPassword: '' })
const passwordTouched = reactive({ newPassword: false, confirmPassword: false })
const savingPassword = ref(false)

const passwordValidators = {
  newPassword: (value) => {
    if (!value) return '请输入新密码'
    if (value.length < 8 || value.length > 64) return '密码长度需为 8-64 位'
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '密码需同时包含字母和数字'
    if (value === passwordForm.oldPassword) return '新密码不能与原密码相同'
    return ''
  },
  confirmPassword: (value) => {
    if (!value) return '请再次输入新密码'
    return value === passwordForm.newPassword ? '' : '两次输入的密码不一致'
  },
}

const validatePasswordField = (key) => {
  passwordErrors[key] = passwordValidators[key](String(passwordForm[key] ?? ''))
  return !passwordErrors[key]
}

const touchPassword = (key) => {
  passwordTouched[key] = true
  validatePasswordField(key)
}

const showPasswordError = (key) => Boolean(passwordTouched[key] && passwordErrors[key])

watch(
  () => passwordForm.newPassword,
  () => {
    if (passwordTouched.confirmPassword) validatePasswordField('confirmPassword')
  }
)

const onChangePassword = async () => {
  if (savingPassword.value) return
  if (!passwordForm.oldPassword) return toast.error('请输入原密码')
  passwordTouched.newPassword = true
  passwordTouched.confirmPassword = true
  validatePasswordField('newPassword')
  validatePasswordField('confirmPassword')
  if (passwordErrors.newPassword) return toast.error(passwordErrors.newPassword)
  if (passwordErrors.confirmPassword) return toast.error(passwordErrors.confirmPassword)

  savingPassword.value = true
  try {
    await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword,
    })
    toast.success('密码修改成功，请重新登录')
    await logout()
    router.push('/login')
  } catch (error) {
    toast.error(error.message)
  } finally {
    savingPassword.value = false
  }
}

/* —— 我的登录记录 —— */
const columns = [
  { key: 'created_at', title: '时间', width: '180px', format: (value) => formatTime(value) },
  { key: 'ip', title: 'IP 地址', width: '150px' },
  { key: 'success', title: '结果', width: '90px', align: 'center' },
  { key: 'message', title: '说明', tip: true },
]

const logs = ref([])
const logsLoading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(1)

const loadLogs = async () => {
  logsLoading.value = true
  try {
    const data = await myLoginLogs({ page: page.value, pageSize: pageSize.value })
    logs.value = data?.list || []
    total.value = Number(data?.total || 0)
    totalPages.value = Number(data?.totalPages || 1)
  } catch (error) {
    logs.value = []
    total.value = 0
    totalPages.value = 1
    toast.error(error.message)
  } finally {
    logsLoading.value = false
  }
}

const onLogout = async () => {
  await logout()
  router.push('/login')
}

// 接口返回的 user 会整体替换 authState.user，这里同步刷新表单
watch(() => authState.user, syncProfileForm)
syncProfileForm()

onMounted(loadLogs)
</script>

<style scoped>
.profile-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(900px 560px at 50% -12%, rgba(0, 130, 200, 0.22), transparent 65%),
    linear-gradient(180deg, #04182a 0%, #01080f 80%);
}

.profile-head {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  background: rgba(0, 20, 40, 0.94);
  border-bottom: 1px solid var(--rs-panel-border);
  backdrop-filter: blur(10px);
}

.head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.head-left h2 {
  font-size: 17px;
  color: var(--rs-text-strong);
  font-weight: bold;
}

.profile-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 20px 40px;
  max-width: 1180px;
  margin: 0 auto;
}

.overview {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 18px;
}

.avatar {
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: bold;
  color: #fff;
  background: var(--rs-gradient);
  box-shadow: 0 0 18px rgba(0, 200, 255, 0.4);
}

.overview-main {
  flex: 1;
  min-width: 200px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-row b {
  font-size: 17px;
  color: var(--rs-text-strong);
}

.overview-main .sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--rs-text-dim);
}

.overview-stats {
  display: flex;
  align-items: center;
  gap: 26px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-item .label {
  font-size: 12px;
  color: var(--rs-text-dim);
}

.stat-item b {
  font-size: 14px;
  color: var(--rs-primary);
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 14px;
}

.card {
  padding: 16px 18px 18px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.card-title {
  font-size: 15px;
  color: var(--rs-text-strong);
  font-weight: bold;
  margin-bottom: 14px;
  padding-left: 10px;
  border-left: 3px solid var(--rs-primary);
  line-height: 1.2;
}

.card-head .card-title {
  margin-bottom: 0;
}

.rs-input[readonly] {
  opacity: 0.7;
  cursor: not-allowed;
}

.rs-input.has-error {
  border-color: rgba(255, 77, 94, 0.75);
}

.field-error {
  font-size: 12px;
  color: #ff8b96;
  line-height: 1.4;
}

.hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--rs-text-dim);
  line-height: 1.5;
}

@media (max-width: 620px) {
  .profile-body {
    padding: 14px 12px 32px;
  }

  .overview-stats {
    gap: 16px;
  }
}
</style>
