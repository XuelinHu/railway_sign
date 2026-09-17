<template>
  <Teleport to="body">
    <div class="toast-wrap">
      <transition-group name="toast">
        <div v-for="item in list" :key="item.id" :class="['toast', item.type]">
          <span class="icon">{{ icon(item.type) }}</span>
          <span class="text">{{ item.message }}</span>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<script>
// 全局轻提示：toast.success('...') / toast.error('...') / toast.info('...')
// 注意：具名导出必须放在普通 <script> 中，<script setup> 内不允许出现 ES 模块导出。
import { ref } from 'vue'

const toasts = ref([])
let seed = 0

const iconOf = (type) => (type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ')

const push = (message, type = 'info', duration = 2600) => {
  const id = ++seed
  toasts.value.push({ id, message: String(message), type })
  setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }, duration)
}

export const toast = {
  success: (message, duration) => push(message, 'success', duration),
  error: (message, duration) => push(message, 'error', duration ?? 3600),
  info: (message, duration) => push(message, 'info', duration),
}
</script>

<script setup>
// 普通 <script> 的模块级绑定不会进入模板作用域，这里引入给模板使用
const list = toasts
const icon = iconOf

defineExpose({ push })
</script>

<style scoped>
.toast-wrap {
  position: fixed;
  top: 74px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--rs-radius);
  background: var(--rs-panel-bg-solid);
  border: 1px solid var(--rs-panel-border);
  color: var(--rs-text);
  font-size: 14px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  max-width: 70vw;
}

.toast.success {
  border-color: rgba(34, 197, 94, 0.6);
  color: #a7f3c4;
}

.toast.error {
  border-color: rgba(255, 77, 94, 0.6);
  color: #ffb3ba;
}

.toast .icon {
  font-weight: bold;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
