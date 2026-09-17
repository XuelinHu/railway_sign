<template>
  <div class="auth-page">
    <div class="auth-grid" />

    <div class="auth-card">
      <header class="auth-head">
        <div class="auth-logo">🚦</div>
        <h1 class="auth-title">{{ siteName }}</h1>
        <p class="auth-sub">创建账号 · 注册后自动登录</p>
      </header>

      <form class="auth-form" @submit.prevent="onSubmit">
        <div class="form-grid">
          <div class="rs-field">
            <label for="reg-username">用户名 <span class="req">*</span></label>
            <input
              id="reg-username"
              v-model.trim="form.username"
              :class="['rs-input', { 'has-error': showError('username') }]"
              type="text"
              autocomplete="username"
              placeholder="字母开头，4-20 位"
              @blur="touch('username')"
            />
            <p v-if="showError('username')" class="field-error">{{ errors.username }}</p>
          </div>

          <div class="rs-field">
            <label for="reg-name">姓名 <span class="req">*</span></label>
            <input
              id="reg-name"
              v-model.trim="form.name"
              :class="['rs-input', { 'has-error': showError('name') }]"
              type="text"
              placeholder="2-20 位"
              @blur="touch('name')"
            />
            <p v-if="showError('name')" class="field-error">{{ errors.name }}</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="rs-field">
            <label for="reg-password">密码 <span class="req">*</span></label>
            <input
              id="reg-password"
              v-model="form.password"
              :class="['rs-input', { 'has-error': showError('password') }]"
              type="password"
              autocomplete="new-password"
              placeholder="8-64 位，含字母和数字"
              @blur="touch('password')"
            />
            <p v-if="showError('password')" class="field-error">{{ errors.password }}</p>
          </div>

          <div class="rs-field">
            <label for="reg-confirm">确认密码 <span class="req">*</span></label>
            <input
              id="reg-confirm"
              v-model="form.confirmPassword"
              :class="['rs-input', { 'has-error': showError('confirmPassword') }]"
              type="password"
              autocomplete="new-password"
              placeholder="请再次输入密码"
              @blur="touch('confirmPassword')"
            />
            <p v-if="showError('confirmPassword')" class="field-error">{{ errors.confirmPassword }}</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="rs-field">
            <label for="reg-phone">手机号</label>
            <input
              id="reg-phone"
              v-model.trim="form.phone"
              :class="['rs-input', { 'has-error': showError('phone') }]"
              type="text"
              maxlength="11"
              placeholder="选填，用于找回密码"
              @blur="touch('phone')"
            />
            <p v-if="showError('phone')" class="field-error">{{ errors.phone }}</p>
          </div>

          <div class="rs-field">
            <label for="reg-email">邮箱</label>
            <input
              id="reg-email"
              v-model.trim="form.email"
              :class="['rs-input', { 'has-error': showError('email') }]"
              type="text"
              placeholder="选填"
              @blur="touch('email')"
            />
            <p v-if="showError('email')" class="field-error">{{ errors.email }}</p>
          </div>
        </div>

        <div class="rs-field">
          <label for="reg-captcha">图形验证码 <span class="req">*</span></label>
          <div class="captcha-row">
            <input
              id="reg-captcha"
              v-model.trim="form.captchaCode"
              class="rs-input"
              type="text"
              maxlength="6"
              autocomplete="off"
              placeholder="不区分大小写"
            />
            <button class="captcha-box" type="button" title="点击刷新验证码" @click="loadCaptcha">
              <span v-if="captchaLoading" class="captcha-tip">加载中…</span>
              <span v-else-if="!captchaSvg" class="captcha-tip">点击刷新</span>
              <span v-else class="captcha-svg" v-html="captchaSvg" />
            </button>
          </div>
        </div>

        <button class="rs-btn primary block submit-btn" type="submit" :disabled="submitting">
          {{ submitting ? '注册中…' : '注 册' }}
        </button>
      </form>

      <footer class="auth-foot">
        <span>已有账号？</span>
        <router-link to="/login">返回登录</router-link>
      </footer>
    </div>
  </div>
</template>

<script setup>
// 注册页：前端校验规则与 server/api/routes/auth.js 保持一致，注册成功即自动登录。
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authState, register, getCaptcha } from '../../services/auth.js'
import { toast } from '../../components/common/AppToast.vue'

const router = useRouter()

const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,19}$/
const PHONE_RE = /^1[3-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const siteName = computed(() => authState.config.siteName || '铁路信号机数字孪生监测与可视化分析平台')

const form = reactive({
  username: '',
  name: '',
  password: '',
  confirmPassword: '',
  phone: '',
  email: '',
  captchaCode: '',
})
const errors = reactive({ username: '', name: '', password: '', confirmPassword: '', phone: '', email: '' })
const touched = reactive({ username: false, name: false, password: false, confirmPassword: false, phone: false, email: false })

const captchaId = ref('')
const captchaSvg = ref('')
const captchaLoading = ref(false)
const submitting = ref(false)

// 密码类字段不做 trim，其余文本字段按后端的 str() 语义先去空格再校验
const rawValue = (key) => {
  const value = form[key]
  return key === 'password' || key === 'confirmPassword' ? String(value ?? '') : String(value ?? '').trim()
}

const validators = {
  username: (value) => {
    if (!value) return '请输入用户名'
    return USERNAME_RE.test(value) ? '' : '用户名需以字母开头，由 4-20 位字母、数字或下划线组成'
  },
  name: (value) => {
    if (!value) return '请输入姓名'
    return value.length >= 2 && value.length <= 20 ? '' : '姓名长度需为 2-20 位'
  },
  password: (value) => {
    if (!value) return '请输入密码'
    if (value.length < 8 || value.length > 64) return '密码长度需为 8-64 位'
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '密码需同时包含字母和数字'
    return ''
  },
  confirmPassword: (value) => {
    if (!value) return '请再次输入密码'
    return value === form.password ? '' : '两次输入的密码不一致'
  },
  phone: (value) => (!value ? '' : PHONE_RE.test(value) ? '' : '手机号格式不正确'),
  email: (value) => (!value ? '' : EMAIL_RE.test(value) ? '' : '邮箱格式不正确'),
}

const validateField = (key) => {
  errors[key] = validators[key](rawValue(key))
  return !errors[key]
}

const touch = (key) => {
  touched[key] = true
  validateField(key)
}

const showError = (key) => Boolean(touched[key] && errors[key])

// 改动密码后同步校验确认密码，避免错误提示残留
watch(
  () => form.password,
  () => {
    if (touched.confirmPassword) validateField('confirmPassword')
  }
)

const loadCaptcha = async () => {
  captchaLoading.value = true
  try {
    const data = await getCaptcha()
    captchaId.value = data?.id || ''
    captchaSvg.value = data?.svg || ''
  } catch (error) {
    captchaId.value = ''
    captchaSvg.value = ''
    toast.error(error.message)
  } finally {
    captchaLoading.value = false
  }
}

const onSubmit = async () => {
  if (submitting.value) return
  const keys = ['username', 'name', 'password', 'confirmPassword', 'phone', 'email']
  keys.forEach((key) => {
    touched[key] = true
  })
  keys.forEach((key) => validateField(key))
  const firstError = keys.find((key) => errors[key])
  if (firstError) return toast.error(errors[firstError])
  if (!form.captchaCode) return toast.error('请输入图形验证码')

  submitting.value = true
  try {
    await register({
      username: rawValue('username').toLowerCase(),
      name: rawValue('name'),
      password: form.password,
      confirmPassword: form.confirmPassword,
      phone: rawValue('phone'),
      email: rawValue('email'),
      captchaId: captchaId.value,
      captchaCode: form.captchaCode.trim(),
    })
    toast.success('注册成功，已自动登录')
    router.push('/')
  } catch (error) {
    toast.error(error.message)
    // 验证码一次性使用，失败后必须换一张
    form.captchaCode = ''
    await loadCaptcha()
  } finally {
    submitting.value = false
  }
}

onMounted(loadCaptcha)
</script>

<style scoped>
.auth-page {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 32px 16px;
  background:
    radial-gradient(900px 620px at 50% -10%, rgba(0, 130, 200, 0.3), transparent 65%),
    radial-gradient(700px 520px at 105% 105%, rgba(0, 200, 255, 0.16), transparent 60%),
    linear-gradient(180deg, #04182a 0%, #01080f 75%);
}

.auth-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(rgba(0, 200, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 200, 255, 0.06) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.9), transparent 72%);
  -webkit-mask-image: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.9), transparent 72%);
}

.auth-card {
  position: relative;
  width: 100%;
  max-width: 560px;
  padding: 28px 30px 20px;
  border-radius: 14px;
  background: var(--rs-panel-bg-solid);
  border: 1px solid var(--rs-panel-border);
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.55), 0 0 34px rgba(0, 150, 220, 0.16);
  backdrop-filter: blur(12px);
}

.auth-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 18%;
  right: 18%;
  height: 2px;
  border-radius: 0 0 4px 4px;
  background: var(--rs-gradient);
  box-shadow: 0 0 16px rgba(0, 200, 255, 0.6);
}

.auth-head {
  text-align: center;
  margin-bottom: 20px;
}

.auth-logo {
  font-size: 28px;
  line-height: 1;
  margin-bottom: 8px;
  filter: drop-shadow(0 0 10px rgba(0, 200, 255, 0.5));
}

.auth-title {
  font-size: 17px;
  line-height: 1.5;
  font-weight: bold;
  letter-spacing: 1px;
  background: linear-gradient(135deg, #ffffff, #7fe0ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.auth-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--rs-text-dim);
  letter-spacing: 1px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}

.rs-field {
  margin-bottom: 10px;
}

.field-error {
  font-size: 12px;
  color: #ff8b96;
  line-height: 1.4;
}

.rs-input.has-error {
  border-color: rgba(255, 77, 94, 0.75);
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.captcha-box {
  flex: none;
  width: 132px;
  height: 44px;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--rs-panel-border);
  border-radius: var(--rs-radius);
  background: rgba(0, 40, 70, 0.6);
  cursor: pointer;
  transition: border-color 0.2s;
}

.captcha-box:hover {
  border-color: var(--rs-primary);
}

.captcha-tip {
  font-size: 12px;
  color: var(--rs-text-dim);
}

.captcha-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.captcha-svg :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.submit-btn {
  margin-top: 6px;
  height: 42px;
  font-size: 15px;
  letter-spacing: 4px;
}

.auth-foot {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 200, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--rs-text-dim);
}

.auth-foot a {
  color: var(--rs-primary);
  text-decoration: none;
}

.auth-foot a:hover {
  opacity: 0.75;
  text-decoration: underline;
}

@media (max-width: 560px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
