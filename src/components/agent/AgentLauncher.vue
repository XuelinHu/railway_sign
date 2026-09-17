<template>
  <!-- 全站悬浮入口：点击弹出智能体对话框 -->
  <div class="agent-launcher">
    <button class="agent-fab" type="button" :title="tip" @click="open = true">
      <span class="icon">🤖</span>
      <span class="label">智能体</span>
      <span v-if="voiceReady" class="voice-dot" title="支持语音对话">🎙️</span>
    </button>
  </div>

  <AgentDialog v-model="open" />
</template>

<script setup>
// 登录后全站可见的智能体入口（右下角浮动按钮，z-index 高于业务标签栏）。
import { ref, computed } from 'vue'
import AgentDialog from './AgentDialog.vue'
import { capabilities } from '../../services/voice.js'

const open = ref(false)
const voiceReady = computed(() => capabilities().input)
const tip = computed(() => (voiceReady.value ? '打开智能体（支持语音问答）' : '打开智能体'))
</script>

<style scoped>
.agent-launcher {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 2000;
}

.agent-fab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-radius: 26px;
  border: 1px solid rgba(0, 200, 255, 0.55);
  background: linear-gradient(135deg, #0066cc, #00d4ff);
  color: #fff;
  font-size: 15px;
  font-weight: bold;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 6px 24px rgba(0, 180, 255, 0.45);
  transition: all 0.25s;
  position: relative;
}

.agent-fab:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 30px rgba(0, 200, 255, 0.6);
}

.agent-fab .icon {
  font-size: 20px;
}

.voice-dot {
  position: absolute;
  top: -6px;
  right: -4px;
  font-size: 14px;
  background: rgba(0, 25, 45, 0.95);
  border: 1px solid rgba(0, 200, 255, 0.5);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 640px) {
  .agent-launcher {
    right: 12px;
    bottom: 12px;
  }
  .agent-fab .label {
    display: none;
  }
}
</style>
