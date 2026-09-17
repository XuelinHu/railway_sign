<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="modelValue" class="modal-mask" @click.self="onMaskClick">
        <div class="modal-box" :style="{ width, maxWidth: '92vw' }">
          <div class="modal-head">
            <h3>{{ title }}</h3>
            <button class="close-btn" type="button" @click="close">✕</button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-foot">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
// 通用弹窗：沿用既有演示面板的深色视觉（对应 RightPanel 的 .device-dialog 设计语言）。
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '520px' },
  closeOnMask: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue', 'close'])

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}

const onMaskClick = () => {
  if (props.closeOnMask) close()
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 8, 18, 0.65);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.modal-box {
  background: var(--rs-panel-bg-solid);
  border: 1px solid var(--rs-panel-border-strong);
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 120, 200, 0.35);
  display: flex;
  flex-direction: column;
  max-height: 86vh;
  overflow: hidden;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--rs-panel-border);
  background: rgba(0, 60, 100, 0.3);
}

.modal-head h3 {
  font-size: 16px;
  color: var(--rs-text-strong);
  font-weight: bold;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--rs-text-dim);
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  color: var(--rs-danger);
  background: rgba(255, 77, 94, 0.12);
}

.modal-body {
  padding: 18px 20px;
  overflow-y: auto;
  color: var(--rs-text);
  font-size: 14px;
}

.modal-foot {
  padding: 12px 20px;
  border-top: 1px solid var(--rs-panel-border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: rgba(0, 30, 55, 0.5);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
