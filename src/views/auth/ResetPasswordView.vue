<template>
  <div class="auth-page">
    <div class="auth-grid" />

    <div class="auth-card">
      <header class="auth-head">
        <div class="auth-logo">🔒</div>
        <h1 class="auth-title">{{ siteName }}</h1>
        <p class="auth-sub">重置密码 · 使用重置令牌设置新密码</p>
      </header>

      <div v-if="prefilled" class="notice ok">
        <p class="notice-title">已从重置链接读取账号信息</p>
        <p class="notice-tip">请填写新密码完成重置；令牌已自动填入，如已过期请重新申请。</p>
      </div>
      <div v-else class="notice warn">
        <p class="notice-title">请手动填写重置信息</p>
        <p class="notice-tip">用户名与重置令牌可在「忘记密码」流程中获取，令牌 15 分钟内有效。</p>
      </div>

      <form class="auth-form" @submit.prevent="onSubmit">
        <div class="rs-field">
          <label for="rp-username">用户名 <span class="req">*</span></label>
          <input
            id="rp-username"
            v-model.trim="form.username"
            class="rs-input"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名"
          />
        </div>

        <div class="rs-field">
          <label for="rp-token">重置令牌 <span class="req">*</span></label>
          <input
            id="rp-token"
            v-model.trim="form.token"
            class="rs-input mono"
            type="text"
            autocomplete="off"
            placeholder="请输入短信或链接中的重置令牌"
          />
        </div>

        <div class="rs-field">
          <label for="rp-password">新密码 <span class="req">*</span></label>
          <input
            id="rp-password"
            v-model="form.newPassword"
            :class="['rs-input', { 'has-error': showError('newPassword') }]"
            type="password"
            autocomplete="new-password"
            placeholder="8-64 位，含字母和数字"
            @blur="touch('newPassword')"
          />
          <p v-if="showError('newPassword')" class="field-error">{{ errors.newPassword }}</p>
        </div>

        <div class="rs-field">
          <label for="rp-confirm">确认新密码 <span class="req">*</span></label>
          <input
            id="rp-confirm"
            v-model="form.confirmPassword"
            :class="['rs-input', { 'has-error': showError('confirmPassword') }]"
            type="password"
            autocomplete="new-password"
            placeholder="请再次输入新密码"
            @blur="touch('confirmPassword')"
          />
          <p v-if="showError('confirmPassword')" class="field-error">{{ errors.confirmPassword }}</p>
        </div>

        <button class="rs-btn primary block submit-btn" type="submit" :disabled="submitting">
          {{ submitting ? '提交中…' : '重置密码' }}
        </button>
      </form>

      <footer class="auth-foot">
        <router-link to="/login">返回登录</router-link>
        <span class="sep">|</span>
        <router-link to="/forgot">重新申请令牌</router-link>
      </footer>
    </div>
  </div>
</template>

<script setup>
// 直接重置页：支持从 /reset?username=xx&token=xx 预填，也可手动录入。
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState, resetPassword } from '../../services/auth.js'
import { toast } from '../../components/common/AppToast.vue'

const route = useRoute()
const router = useRouter()

const siteName = computed(() => authState.config.siteName || '铁路信号机数字孪生监测与可视化分析平台')

const query = (key) => (typeof route.query[key] === 'string' ? route.query[key].trim() : '')

const form = reactive({
  username: query('username'),
  token: query('token'),
  newPassword: '',
  confirmPassword: '',
})
const prefilled = ref(Boolean(form.username && form.token))

const errors = reactive({ newPassword: '', confirmPassword: '' })
const touched = reactive({ newPassword: false, confirmPassword: false })
const submitting = ref(false)

const validators = {
  newPassword: (value) => {
    if (!value) return '请输入新密码'
    if (value.length < 8 || value.length > 64) return '密码长度需为 8-64 位'
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '密码需同时包含字母和数字'
    return ''
  },
  confirmPassword: (value) => {
    if (!value) return '请再次输入新密码'
    return value === form.newPassword ? '' : '两次输入的密码不一致'
  },
}

const validateField = (key) => {
  errors[key] = validators[key](String(form[key] ?? ''))
  return !errors[key]
}

const touch = (key) => {
  touched[key] = true
  validateField(key)
}

const showError = (key) => Boolean(touched[key] && errors[key])

watch(
  () => form.newPassword,
  () => {
    if (touched.confirmPassword) validateField('confirmPassword')
  }
)

const onSubmit = async () => {
  if (submitting.value) return
  const username = form.username.trim().toLowerCase()
  if (!username) return toast.error('请输入用户名')
  if (!form.token.trim()) return toast.error('请输入重置令牌')
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
      token: form.token.trim(),
      newPassword: form.newPassword,
      confirmPassword: form.confirmPassword,
    })
    toast.success(data?.message || '密码已重置，请使用新密码登录')
    router.push('/login')
  } catch (error) {
    toast.error(error.message)
  } finally {
    submitting.value = false
  }
}
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

.auth-foot .sep {
  color: rgba(127, 163, 184, 0.5);
}
</style>
