<template>
  <div class="auth-page">
    <div class="auth-grid" />

    <div class="auth-card">
      <header class="auth-head">
        <div class="auth-logo">🚦</div>
        <h1 class="auth-title">{{ siteName }}</h1>
        <p class="auth-sub">数字孪生监测与可视化分析 · 用户登录</p>
      </header>

      <form class="auth-form" @submit.prevent="onSubmit">
        <div class="rs-field">
          <label for="login-username">用户名 <span class="req">*</span></label>
          <input
            id="login-username"
            v-model.trim="form.username"
            class="rs-input"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名"
          />
        </div>

        <div class="rs-field">
          <label for="login-password">密码 <span class="req">*</span></label>
          <input
            id="login-password"
            v-model="form.password"
            class="rs-input"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
          />
        </div>

        <div class="rs-field">
          <label for="login-captcha">图形验证码 <span class="req">*</span></label>
          <div class="captcha-row">
            <input
              id="login-captcha"
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

        <button class="rs-btn primary block login-btn" type="submit" :disabled="submitting">
          {{ submitting ? '登录中…' : '登 录' }}
        </button>
      </form>

      <div class="demo-box">
        <div class="demo-title">演示账号（点击一键填入）</div>
        <div class="demo-list">
          <button
            v-for="item in demoAccounts"
            :key="item.username"
            class="demo-chip"
            type="button"
            @click="fillDemo(item)"
          >
            <b>{{ item.label }}</b>
            <span>{{ item.username }} / {{ item.password }}</span>
          </button>
        </div>
      </div>

      <footer class="auth-foot">
        <router-link to="/register">注册账号</router-link>
        <span class="sep">|</span>
        <router-link to="/forgot">忘记密码</router-link>
      </footer>
    </div>
  </div>
</template>

<script setup>
// 登录页：用户名 + 密码 + 图形验证码，成功后按 redirect 参数回到原页面。
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState, login, getCaptcha } from '../../services/auth.js'
import { toast } from '../../components/common/AppToast.vue'

const route = useRoute()
const router = useRouter()

const siteName = computed(() => authState.config.siteName || '铁路信号机数字孪生监测与可视化分析平台')

const form = reactive({ username: '', password: '', captchaCode: '' })
const captchaId = ref('')
const captchaSvg = ref('')
const captchaLoading = ref(false)
const submitting = ref(false)

const demoAccounts = [
  { label: '管理员', username: 'admin', password: 'Admin@123' },
  { label: '运维人员', username: 'operator', password: 'Operator@123' },
  { label: '普通用户', username: 'user', password: 'User@123' },
]

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

const fillDemo = (item) => {
  form.username = item.username
  form.password = item.password
  toast.info(`已填入${item.label}演示账号，请输入验证码后登录`)
}

const onSubmit = async () => {
  if (submitting.value) return
  const username = form.username.trim().toLowerCase()
  if (!username) return toast.error('请输入用户名')
  if (!form.password) return toast.error('请输入密码')
  if (!form.captchaCode) return toast.error('请输入图形验证码')

  submitting.value = true
  try {
    await login({
      username,
      password: form.password,
      captchaId: captchaId.value,
      captchaCode: form.captchaCode.trim(),
    })
    toast.success('登录成功，正在进入平台…')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    router.push(redirect || '/')
  } catch (error) {
    toast.error(error.message)
    // 验证码一次性使用，登录失败后必须换一张
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

/* 背景网格：纯装饰 */
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
  max-width: 432px;
  padding: 30px 30px 22px;
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
  margin-bottom: 22px;
}

.auth-logo {
  font-size: 30px;
  line-height: 1;
  margin-bottom: 10px;
  filter: drop-shadow(0 0 10px rgba(0, 200, 255, 0.5));
}

.auth-title {
  font-size: 18px;
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

/* v-html 注入的 SVG 不受 scoped 约束，需用 :deep 指定尺寸 */
.captcha-svg :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.login-btn {
  margin-top: 6px;
  height: 42px;
  font-size: 15px;
  letter-spacing: 4px;
}

.demo-box {
  margin-top: 20px;
  padding: 12px;
  border: 1px dashed rgba(0, 200, 255, 0.28);
  border-radius: var(--rs-radius);
  background: rgba(0, 40, 70, 0.35);
}

.demo-title {
  font-size: 12px;
  color: var(--rs-text-dim);
  margin-bottom: 8px;
}

.demo-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.demo-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: rgba(0, 100, 150, 0.22);
  color: var(--rs-text);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.demo-chip b {
  color: var(--rs-primary);
  font-size: 12px;
}

.demo-chip span {
  color: var(--rs-text-dim);
  font-family: Consolas, monospace;
}

.demo-chip:hover {
  border-color: var(--rs-primary);
  background: rgba(0, 100, 150, 0.45);
}

.auth-foot {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 200, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 13px;
}

.auth-foot a {
  color: var(--rs-primary);
  text-decoration: none;
  transition: opacity 0.2s;
}

.auth-foot a:hover {
  opacity: 0.75;
  text-decoration: underline;
}

.auth-foot .sep {
  color: rgba(127, 163, 184, 0.5);
}
</style>
