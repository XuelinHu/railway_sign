<template>
  <div class="auth-page">
    <div class="auth-grid" />

    <div class="auth-card">
      <header class="auth-head">
        <div class="auth-logo">🔑</div>
        <h1 class="auth-title">{{ siteName }}</h1>
        <p class="auth-sub">找回密码 · 验证身份后重置登录密码</p>
      </header>

      <div class="steps">
        <div :class="['step', { active: step === 1, done: step > 1 }]">
          <span class="dot">1</span>
          <span class="text">验证身份</span>
        </div>
        <i class="line" />
        <div :class="['step', { active: step === 2 }]">
          <span class="dot">2</span>
          <span class="text">重置密码</span>
        </div>
      </div>

      <!-- 第一步：用户名 + 预留手机号 + 图形验证码 -->
      <form v-if="step === 1" class="auth-form" @submit.prevent="onIssue">
        <div class="rs-field">
          <label for="fp-username">用户名 <span class="req">*</span></label>
          <input
            id="fp-username"
            v-model.trim="form.username"
            class="rs-input"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名"
          />
        </div>

        <div class="rs-field">
          <label for="fp-phone">注册手机号 <span class="req">*</span></label>
          <input
            id="fp-phone"
            v-model.trim="form.phone"
            :class="['rs-input', { 'has-error': showError('phone') }]"
            type="text"
            maxlength="11"
            placeholder="注册时预留的手机号"
            @blur="touch('phone')"
          />
          <p v-if="showError('phone')" class="field-error">{{ errors.phone }}</p>
        </div>

        <div class="rs-field">
          <label for="fp-captcha">图形验证码 <span class="req">*</span></label>
          <div class="captcha-row">
            <input
              id="fp-captcha"
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
          {{ submitting ? '提交中…' : '获取重置令牌' }}
        </button>
      </form>

      <!-- 第二步：重置令牌 + 新密码 -->
      <form v-else class="auth-form" @submit.prevent="onReset">
        <div :class="['notice', issued.token ? 'ok' : 'warn']">
          <p class="notice-title">{{ issued.message || '重置令牌已生成' }}</p>
          <p v-if="!issued.token" class="notice-tip">请查收短信中的重置令牌并填入下方输入框。</p>
          <p v-else class="notice-tip">演示环境直接回显令牌，有效期至 {{ formatTime(issued.expiresAt) }}。</p>
        </div>

        <div class="rs-field">
          <label for="fp-token">重置令牌 <span class="req">*</span></label>
          <input
            id="fp-token"
            v-model.trim="resetForm.token"
            class="rs-input mono"
            type="text"
            autocomplete="off"
            placeholder="请输入短信中的重置令牌"
          />
        </div>

        <div class="rs-field">
          <label for="fp-password">新密码 <span class="req">*</span></label>
          <input
            id="fp-password"
            v-model="resetForm.newPassword"
            :class="['rs-input', { 'has-error': showError('newPassword') }]"
            type="password"
            autocomplete="new-password"
            placeholder="8-64 位，含字母和数字"
            @blur="touch('newPassword')"
          />
          <p v-if="showError('newPassword')" class="field-error">{{ errors.newPassword }}</p>
        </div>

        <div class="rs-field">
          <label for="fp-confirm">确认新密码 <span class="req">*</span></label>
          <input
            id="fp-confirm"
            v-model="resetForm.confirmPassword"
            :class="['rs-input', { 'has-error': showError('confirmPassword') }]"
            type="password"
            autocomplete="new-password"
            placeholder="请再次输入新密码"
            @blur="touch('confirmPassword')"
          />
          <p v-if="showError('confirmPassword')" class="field-error">{{ errors.confirmPassword }}</p>
        </div>

        <div class="btn-row">
          <button class="rs-btn" type="button" :disabled="submitting" @click="backToStepOne">上一步</button>
          <button class="rs-btn primary" type="submit" :disabled="submitting">
            {{ submitting ? '提交中…' : '重置密码' }}
          </button>
        </div>
      </form>

      <footer class="auth-foot">
        <span>想起密码了？</span>
        <router-link to="/login">返回登录</router-link>
        <span class="sep">|</span>
        <router-link to="/reset">直接重置</router-link>
      </footer>
    </div>
  </div>
</template>

<script setup>
// 找回密码：第一步校验用户名 + 预留手机号换取一次性令牌，第二步用令牌重置密码。
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authState, forgotPassword, resetPassword, getCaptcha } from '../../services/auth.js'
import { toast } from '../../components/common/AppToast.vue'

const router = useRouter()

const PHONE_RE = /^1[3-9]\d{9}$/

const siteName = computed(() => authState.config.siteName || '铁路信号机数字孪生监测与可视化分析平台')

const step = ref(1)
const form = reactive({ username: '', phone: '', captchaCode: '' })
const resetForm = reactive({ token: '', newPassword: '', confirmPassword: '' })
const issued = reactive({ token: '', expiresAt: '', message: '' })

const errors = reactive({ phone: '', newPassword: '', confirmPassword: '' })
const touched = reactive({ phone: false, newPassword: false, confirmPassword: false })

const captchaId = ref('')
const captchaSvg = ref('')
const captchaLoading = ref(false)
const submitting = ref(false)

const formatTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const validators = {
  phone: (value) => (!value ? '请输入注册时预留的手机号' : PHONE_RE.test(value) ? '' : '手机号格式不正确'),
  newPassword: (value) => {
    if (!value) return '请输入新密码'
    if (value.length < 8 || value.length > 64) return '密码长度需为 8-64 位'
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '密码需同时包含字母和数字'
    return ''
  },
  confirmPassword: (value) => {
    if (!value) return '请再次输入新密码'
    return value === resetForm.newPassword ? '' : '两次输入的密码不一致'
  },
}

// 手机号按后端 str() 语义先去空格，密码字段保持原样（后端不对密码 trim）
const validateField = (key) => {
  if (key === 'phone') errors.phone = validators.phone(String(form.phone ?? '').trim())
  else errors[key] = validators[key](String(resetForm[key] ?? ''))
  return !errors[key]
}

const touch = (key) => {
  touched[key] = true
  validateField(key)
}

const showError = (key) => Boolean(touched[key] && errors[key])

watch(
  () => resetForm.newPassword,
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

const onIssue = async () => {
  if (submitting.value) return
  const username = form.username.trim().toLowerCase()
  if (!username) return toast.error('请输入用户名')
  touched.phone = true
  if (!validateField('phone')) return toast.error(errors.phone)
  if (!form.captchaCode) return toast.error('请输入图形验证码')

  submitting.value = true
  try {
    const data = await forgotPassword({
      username,
      phone: form.phone.trim(),
      captchaId: captchaId.value,
      captchaCode: form.captchaCode.trim(),
    })
    issued.token = data?.token || ''
    issued.expiresAt = data?.expiresAt || ''
    issued.message = data?.message || ''
    resetForm.token = issued.token
    resetForm.newPassword = ''
    resetForm.confirmPassword = ''
    touched.newPassword = false
    touched.confirmPassword = false
    errors.newPassword = ''
    errors.confirmPassword = ''
    step.value = 2
    toast.success(issued.message || '重置令牌已生成')
  } catch (error) {
    toast.error(error.message)
    form.captchaCode = ''
    await loadCaptcha()
  } finally {
    submitting.value = false
  }
}

const onReset = async () => {
  if (submitting.value) return
  const username = form.username.trim().toLowerCase()
  if (!resetForm.token.trim()) return toast.error('请输入重置令牌')
  touched.newPassword = true
  touched.confirmPassword = true
  validateField('newPassword')
  validateField('confirmPassword')
  if (errors.newPassword) return toast.error(errors.newPassword)
  if (errors.confirmPassword) return toast.error(errors.confirmPassword)

  submitting.value = true
  try {
    const data = await resetPassword({
      username,
      token: resetForm.token.trim(),
      newPassword: resetForm.newPassword,
      confirmPassword: resetForm.confirmPassword,
    })
    toast.success(data?.message || '密码已重置，请使用新密码登录')
    router.push('/login')
  } catch (error) {
    toast.error(error.message)
  } finally {
    submitting.value = false
  }
}

const backToStepOne = () => {
  step.value = 1
  form.captchaCode = ''
  loadCaptcha()
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
  max-width: 448px;
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
  margin-bottom: 16px;
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

.steps {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--rs-text-dim);
}

.step .dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--rs-panel-border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}

.step.active .dot,
.step.done .dot {
  border-color: var(--rs-primary);
  color: #fff;
  background: var(--rs-gradient);
}

.step.active .text,
.step.done .text {
  color: var(--rs-primary);
}

.line {
  flex: 1;
  height: 1px;
  background: rgba(0, 200, 255, 0.25);
}

.field-error {
  font-size: 12px;
  color: #ff8b96;
  line-height: 1.4;
}

.rs-input.has-error {
  border-color: rgba(255, 77, 94, 0.75);
}

.mono {
  font-family: Consolas, monospace;
  letter-spacing: 1px;
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

.notice {
  padding: 10px 12px;
  margin-bottom: 14px;
  border-radius: var(--rs-radius);
  border: 1px solid transparent;
  font-size: 12px;
  line-height: 1.6;
}

.notice.ok {
  border-color: rgba(34, 197, 94, 0.45);
  background: rgba(34, 197, 94, 0.12);
  color: #a7f3c4;
}

.notice.warn {
  border-color: rgba(245, 166, 35, 0.45);
  background: rgba(245, 166, 35, 0.12);
  color: #ffce7a;
}

.notice-title {
  font-size: 13px;
  font-weight: bold;
}

.notice-tip {
  margin-top: 4px;
  opacity: 0.9;
}

.submit-btn {
  margin-top: 6px;
  height: 42px;
  font-size: 15px;
  letter-spacing: 2px;
}

.btn-row {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.btn-row .rs-btn {
  flex: 1;
  height: 42px;
  font-size: 15px;
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

.auth-foot .sep {
  color: rgba(127, 163, 184, 0.5);
}
</style>
