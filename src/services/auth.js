// 认证状态（Vue reactive，单例）+ 公共服务接口调用。

import { reactive, computed } from 'vue'
import http, { getToken, setToken, onUnauthorized } from './http.js'

export const authState = reactive({
  user: null,
  permissions: [],
  config: { siteName: '铁路信号机数字孪生监测与可视化分析平台', version: 'V1.0', defaultModel: '', ttsVoice: '' },
  ready: false, // 是否已完成一次 /me 探测
})

export const isLoggedIn = computed(() => Boolean(authState.user))
export const isAdmin = computed(() => authState.permissions.includes('*') || authState.permissions.includes('admin:view'))
export const isOperator = computed(
  () => isAdmin.value || authState.permissions.includes('alarms:view') || authState.permissions.includes('work_orders:view')
)

export const hasPermission = (point) => {
  if (!point) return true
  const list = authState.permissions
  return list.includes('*') || list.includes(point)
}

const applySession = (data) => {
  authState.user = data.user
  authState.permissions = data.permissions || []
  if (data.config) authState.config = { ...authState.config, ...data.config }
}

export const getCaptcha = () => http.get('/auth/captcha')

export const login = async (payload) => {
  const data = await http.post('/auth/login', payload)
  setToken(data.token)
  applySession(data)
  authState.ready = true
  return data
}

export const register = async (payload) => {
  const data = await http.post('/auth/register', payload)
  setToken(data.token)
  applySession(data)
  authState.ready = true
  return data
}

export const logout = async () => {
  try {
    await http.post('/auth/logout', {})
  } catch (_) {
    /* 令牌可能已失效，本地清理即可 */
  }
  setToken('')
  authState.user = null
  authState.permissions = []
}

// 刷新页面后用本地令牌恢复会话；失败即视为未登录
export const restore = async () => {
  if (!getToken()) {
    authState.ready = true
    return null
  }
  try {
    const data = await http.get('/auth/me')
    applySession(data)
    return data.user
  } catch (_) {
    setToken('')
    authState.user = null
    authState.permissions = []
    return null
  } finally {
    authState.ready = true
  }
}

export const changePassword = (payload) => http.post('/auth/change-password', payload)
export const forgotPassword = (payload) => http.post('/auth/forgot-password', payload)
export const resetPassword = (payload) => http.post('/auth/reset-password', payload)
export const updateProfile = (payload) => http.post('/auth/profile', payload)
export const myLoginLogs = (params) => http.get('/auth/login-logs', { params })

// 令牌失效（过期/被踢）时清空本地状态
onUnauthorized(() => {
  authState.user = null
  authState.permissions = []
})

export default {
  state: authState,
  login,
  register,
  logout,
  restore,
  getCaptcha,
  changePassword,
  forgotPassword,
  resetPassword,
  updateProfile,
  myLoginLogs,
  hasPermission,
}
