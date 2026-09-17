<template>
  <div class="portal">
    <!-- 原有三个业务标签页（内容与样式与改造前保持一致） -->
    <div class="tab-container">
      <button :class="['tab-btn', { active: currentTab === 'cesium' }]" @click="switchTab('cesium')">
        🗺️ 地理信息可视化
      </button>
      <button :class="['tab-btn', { active: currentTab === 'three' }]" @click="switchTab('three')">
        🚦 铁路信号设备孪生面板
      </button>
      <button :class="['tab-btn', { active: currentTab === 'data' }]" @click="switchTab('data')">
        📊 数据可视化平台
      </button>
    </div>

    <!-- 右上角用户区（新增）：管理台入口 / 个人中心 / 退出 -->
    <div class="user-bar">
      <span class="hello">👤 {{ user?.name || user?.username }}</span>
      <router-link v-if="canAdmin" class="user-btn" to="/admin">⚙️ 管理台</router-link>
      <router-link class="user-btn" to="/profile">个人中心</router-link>
      <button class="user-btn" type="button" @click="onLogout">退出</button>
    </div>

    <div class="content-container">
      <CesiumView v-if="currentTab === 'cesium'" />
      <ThreeView v-else-if="currentTab === 'three'" />
      <DataPanel v-else-if="currentTab === 'data'" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import CesiumView from '../components/CesiumView.vue'
import ThreeView from '../components/ThreeView.vue'
import DataPanel from '../components/DataPanel.vue'
import { authState, logout, isAdmin, isOperator } from '../services/auth.js'

const router = useRouter()
const currentTab = ref('three')
const user = computed(() => authState.user)
const canAdmin = computed(() => isAdmin.value || isOperator.value)

const switchTab = (tab) => {
  currentTab.value = tab
}

const onLogout = async () => {
  await logout()
  router.push('/login')
}
</script>

<style scoped>
.portal {
  width: 100%;
  height: 100%;
}

.tab-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 50px;
  background: rgba(0, 20, 40, 0.95);
  border-bottom: 2px solid rgba(0, 200, 255, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  z-index: 1000;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 200, 255, 0.2);
}

.tab-btn {
  padding: 8px 20px;
  background: rgba(0, 100, 150, 0.3);
  border: 2px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  color: #aaa;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-btn:hover {
  background: rgba(0, 100, 150, 0.5);
  color: #00d4ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 200, 255, 0.3);
}

.tab-btn.active {
  background: linear-gradient(135deg, #0066cc, #00d4ff);
  color: #fff;
  border-color: #00d4ff;
  box-shadow: 0 0 20px rgba(0, 200, 255, 0.5);
}

.content-container {
  width: 100%;
  height: 100%;
  padding-top: 50px;
}

.user-bar {
  position: fixed;
  top: 8px;
  right: 16px;
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.hello {
  color: #7fa3b8;
}

.user-btn {
  padding: 5px 12px;
  background: rgba(0, 100, 150, 0.3);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 6px;
  color: #cfe9f7;
  font-size: 13px;
  font-family: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.25s;
}

.user-btn:hover {
  background: rgba(0, 100, 150, 0.55);
  color: #00d4ff;
  border-color: #00d4ff;
}

/* 窄屏隐藏问候语，避免遮挡标签 */
@media (max-width: 1400px) {
  .hello {
    display: none;
  }
}
</style>
