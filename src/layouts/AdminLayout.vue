<template>
  <div class="admin-shell">
    <!-- 左侧菜单（可折叠）：菜单项与 router/index.js 的 /admin 子路由一一对应 -->
    <aside class="sidebar" :class="{ collapsed }">
      <div class="brand">
        <span class="brand-icon">🚦</span>
        <div v-if="!collapsed" class="brand-text">
          <div class="brand-title">信号机管理台</div>
          <div class="brand-sub">Railway Sign Console</div>
        </div>
      </div>

      <nav class="menu">
        <router-link
          v-for="item in visibleMenus"
          :key="item.path"
          :to="item.path"
          class="menu-item"
          :class="{ active: route.path === item.path }"
          :title="collapsed ? item.title : undefined"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <span v-if="!collapsed" class="menu-label">{{ item.title }}</span>
        </router-link>
        <div v-if="!visibleMenus.length" class="menu-empty">当前账号没有可访问的管理菜单</div>
      </nav>

      <div v-if="!collapsed" class="sidebar-foot">v{{ authState.config.version }}</div>
    </aside>

    <div class="main">
      <!-- 顶栏：站点名 + 当前用户 + 全局操作 -->
      <header class="topbar">
        <div class="topbar-left">
          <button class="rs-btn small collapse-btn" type="button" @click="toggleCollapse">
            {{ collapsed ? '☰' : '⇤' }}
          </button>
          <h1 class="site-name" :title="authState.config.siteName">{{ authState.config.siteName }}</h1>
        </div>

        <div class="topbar-right">
          <span class="who">
            <span class="who-name">👤 {{ authState.user?.name || authState.user?.username || '未登录' }}</span>
            <span class="rs-tag blue">{{ roleLabel }}</span>
          </span>
          <router-link class="rs-btn small" to="/">返回可视化平台</router-link>
          <router-link class="rs-btn small" to="/profile">个人中心</router-link>
          <button class="rs-btn small danger" type="button" :disabled="loggingOut" @click="onLogout">
            {{ loggingOut ? '退出中…' : '退出' }}
          </button>
        </div>
      </header>

      <!-- 内容区：由子路由渲染，独立滚动 -->
      <section class="content">
        <router-view />
      </section>
    </div>
  </div>
</template>

<script setup>
// 管理台外壳：固定侧边菜单 + 顶栏 + 内容区，菜单按 authState.permissions 过滤。
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState, logout } from '../services/auth.js'
import { toast } from '../components/common/AppToast.vue'

const route = useRoute()
const router = useRouter()

// 折叠状态本地记忆，刷新后保持
const COLLAPSE_KEY = 'railway_sign_admin_collapsed'
const collapsed = ref(readCollapsed())
const loggingOut = ref(false)

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch (_) {
    return false
  }
}

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
  } catch (_) {
    /* 隐私模式下忽略 */
  }
}

// 菜单与权限点映射（权限点取自 /api/admin/permissions）
const MENUS = [
  { path: '/admin/dashboard', title: '概览统计', icon: '📊', permission: 'dashboard:view' },
  { path: '/admin/users', title: '用户管理', icon: '👥', permission: 'users:view' },
  { path: '/admin/roles', title: '角色权限', icon: '🛡️', permission: 'roles:view' },
  { path: '/admin/signals', title: '信号机管理', icon: '🚦', permission: 'signals:view' },
  { path: '/admin/alarms', title: '告警记录', icon: '⚠️', permission: 'alarms:view' },
  { path: '/admin/work-orders', title: '工单管理', icon: '🧰', permission: 'work-orders:view' },
  { path: '/admin/telemetry', title: '遥测记录', icon: '📡', permission: 'telemetry:view' },
  { path: '/admin/logs/login', title: '登录日志', icon: '🔑', permission: 'logs:view' },
  { path: '/admin/logs/op', title: '操作日志', icon: '📝', permission: 'logs:view' },
  { path: '/admin/ai/sessions', title: '智能体会话', icon: '💬', permission: 'ai:view' },
  { path: '/admin/ai/models', title: '模型管理', icon: '🧠', permission: 'ai:manage' },
  { path: '/admin/settings', title: '系统设置', icon: '⚙️', permission: 'system:config' },
]

// 含 '*' 表示超级管理员，全部菜单可见
const canView = (point) => {
  const list = authState.permissions || []
  return list.includes('*') || list.includes(point)
}

const visibleMenus = computed(() => MENUS.filter((item) => canView(item.permission)))

const ROLE_LABELS = { admin: '超级管理员', operator: '运维人员', user: '普通用户' }
const roleLabel = computed(() => ROLE_LABELS[authState.user?.role] || authState.user?.role || '未登录')

const onLogout = async () => {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await logout()
    router.push('/login')
  } catch (e) {
    toast.error(e.message)
  } finally {
    loggingOut.value = false
  }
}
</script>

<style scoped>
.admin-shell {
  display: flex;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 20% 0%, rgba(0, 90, 140, 0.35), transparent 55%), #000d18;
}

/* —— 侧边菜单 —— */
.sidebar {
  width: 208px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: rgba(0, 25, 45, 0.9);
  border-right: 1px solid rgba(0, 200, 255, 0.3);
  backdrop-filter: blur(10px);
  transition: width 0.2s ease;
}

.sidebar.collapsed {
  width: 62px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid rgba(0, 200, 255, 0.2);
}

.brand-icon {
  font-size: 22px;
  line-height: 1;
}

.brand-title {
  font-size: 15px;
  font-weight: bold;
  color: var(--rs-text-strong);
}

.brand-sub {
  font-size: 11px;
  color: var(--rs-text-dim);
  margin-top: 2px;
}

/* 菜单项较多，侧栏独立滚动 */
.menu {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--rs-radius);
  border: 1px solid transparent;
  color: var(--rs-text);
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.2s;
}

.menu-item:hover {
  background: rgba(0, 100, 150, 0.35);
  color: var(--rs-primary);
}

.menu-item.active {
  background: var(--rs-gradient);
  border-color: var(--rs-primary);
  color: #fff;
  font-weight: bold;
  box-shadow: 0 0 16px rgba(0, 200, 255, 0.35);
}

.menu-icon {
  font-size: 15px;
  line-height: 1;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.menu-empty {
  padding: 14px 10px;
  font-size: 12px;
  color: var(--rs-text-dim);
  line-height: 1.6;
}

.sidebar-foot {
  padding: 10px 14px;
  font-size: 11px;
  color: var(--rs-text-dim);
  border-top: 1px solid rgba(0, 200, 255, 0.15);
}

/* —— 右侧主区 —— */
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(0, 20, 40, 0.85);
  border-bottom: 1px solid rgba(0, 200, 255, 0.3);
  backdrop-filter: blur(10px);
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.topbar-left {
  flex: 1;
}

.site-name {
  font-size: 15px;
  font-weight: bold;
  color: var(--rs-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collapse-btn {
  flex-shrink: 0;
  min-width: 34px;
}

.who {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--rs-text-dim);
  white-space: nowrap;
}

.who-name {
  color: var(--rs-text);
}

/* router-link 渲染为 <a>，去掉下划线以匹配 .rs-btn 视觉 */
.topbar-right a.rs-btn {
  text-decoration: none;
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

@media (max-width: 900px) {
  .site-name {
    display: none;
  }
}
</style>
