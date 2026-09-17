// 路由：hash 模式（静态托管无需服务端 rewrite），带登录与角色守卫。

import { createRouter, createWebHashHistory } from 'vue-router'
import { authState, restore, isAdmin, isOperator } from '../services/auth.js'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/auth/LoginView.vue'), meta: { public: true, title: '登录' } },
  { path: '/register', name: 'register', component: () => import('../views/auth/RegisterView.vue'), meta: { public: true, title: '注册' } },
  { path: '/forgot', name: 'forgot', component: () => import('../views/auth/ForgotPasswordView.vue'), meta: { public: true, title: '找回密码' } },
  { path: '/reset', name: 'reset', component: () => import('../views/auth/ResetPasswordView.vue'), meta: { public: true, title: '重置密码' } },

  { path: '/', name: 'portal', component: () => import('../views/PortalHome.vue'), meta: { title: '可视化平台' } },
  { path: '/profile', name: 'profile', component: () => import('../views/profile/ProfileView.vue'), meta: { title: '个人中心' } },

  {
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('../views/admin/DashboardView.vue'), meta: { title: '概览统计', requiresAdmin: true } },
      { path: 'users', name: 'admin-users', component: () => import('../views/admin/UsersView.vue'), meta: { title: '用户管理', requiresAdmin: true } },
      { path: 'roles', name: 'admin-roles', component: () => import('../views/admin/RolesView.vue'), meta: { title: '角色权限', requiresAdmin: true } },
      { path: 'signals', name: 'admin-signals', component: () => import('../views/admin/SignalsView.vue'), meta: { title: '信号机管理', requiresAdmin: true } },
      { path: 'alarms', name: 'admin-alarms', component: () => import('../views/admin/AlarmsView.vue'), meta: { title: '告警记录', requiresAdmin: true } },
      { path: 'work-orders', name: 'admin-work-orders', component: () => import('../views/admin/WorkOrdersView.vue'), meta: { title: '工单管理', requiresAdmin: true } },
      { path: 'telemetry', name: 'admin-telemetry', component: () => import('../views/admin/TelemetryView.vue'), meta: { title: '遥测记录', requiresAdmin: true } },
      { path: 'logs/login', name: 'admin-login-logs', component: () => import('../views/admin/LoginLogsView.vue'), meta: { title: '登录日志', requiresAdmin: true } },
      { path: 'logs/op', name: 'admin-op-logs', component: () => import('../views/admin/OpLogsView.vue'), meta: { title: '操作日志', requiresAdmin: true } },
      { path: 'ai/sessions', name: 'admin-ai-sessions', component: () => import('../views/admin/AiSessionsView.vue'), meta: { title: '智能体会话', requiresAdmin: true } },
      { path: 'ai/models', name: 'admin-models', component: () => import('../views/admin/ModelsView.vue'), meta: { title: '模型管理', requiresAdmin: true } },
      { path: 'settings', name: 'admin-settings', component: () => import('../views/admin/SettingsView.vue'), meta: { title: '系统设置', requiresAdmin: true } },
    ],
  },

  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  // 首次进入先尝试用本地令牌恢复会话（刷新页面后保持登录）
  if (!authState.ready) await restore()

  if (to.meta.public) {
    if (authState.user && (to.name === 'login' || to.name === 'register')) return { path: '/' }
    return true
  }

  if (!authState.user) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }

  const needAdmin = to.matched.some((record) => record.meta.requiresAdmin)
  if (needAdmin && !isAdmin.value && !isOperator.value) return { path: '/' }

  return true
})

router.afterEach((to) => {
  const base = '铁路信号机数字孪生监测与可视化分析平台'
  document.title = to.meta.title ? `${to.meta.title} · ${base}` : base
})

export default router
