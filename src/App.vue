<template>
  <div id="app">
    <!-- Tab 切换栏 -->
    <div class="tab-container">
      <button
        :class="['tab-btn', { active: currentTab === 'cesium' }]"
        @click="switchTab('cesium')"
      >
        🌍 地理信息可视化
      </button>
      <button
        :class="['tab-btn', { active: currentTab === 'three' }]"
        @click="switchTab('three')"
      >
        🎮 铁道信号孪生面板
      </button>
      <button
        :class="['tab-btn', { active: currentTab === 'data' }]"
        @click="switchTab('data')"
      >
        📊 大数据可视化平台
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="content-container">
      <CesiumView v-if="currentTab === 'cesium'" />
      <ThreeView v-else-if="currentTab === 'three'" />
      <DataPanel v-else-if="currentTab === 'data'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CesiumView from './components/CesiumView.vue'
import ThreeView from './components/ThreeView.vue'
import DataPanel from './components/DataPanel.vue'

// 默认打开：数字孪生面板（ThreeView）
const currentTab = ref('three')

const switchTab = (tab) => {
  currentTab.value = tab
}

</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  background: #000;
}

/* Tab 切换栏样式 */
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
  font-size: 14px;
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

/* 内容区域 */
.content-container {
  width: 100%;
  height: 100%;
  padding-top: 50px;
}
</style>
