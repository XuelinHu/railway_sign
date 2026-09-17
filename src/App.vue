<template>
  <router-view />
  <!-- 智能体入口：登录后全站可见的浮动按钮 + 弹框 -->
  <AgentLauncher v-if="isLoggedIn" />
  <AppToast />
</template>

<script setup>
// 根组件只负责路由出口与全局挂件；未登录时（登录/注册页）不显示智能体入口。
import AgentLauncher from './components/agent/AgentLauncher.vue'
import AppToast from './components/common/AppToast.vue'
import { isLoggedIn } from './services/auth.js'
</script>
