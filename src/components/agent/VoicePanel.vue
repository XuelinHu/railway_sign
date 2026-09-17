<template>
  <!-- 语音输入面板：三种模式（安卓原生 / 浏览器识别 / 录音回传）统一在这里呈现 -->
  <div v-if="visible" class="voice-panel">
    <div class="head">
      <span class="title">
        <span class="mic" :class="state">{{ stateIcon }}</span>
        {{ stateText }}
      </span>
      <span class="cap">{{ capabilityText }}</span>
    </div>

    <div v-if="mode === 'record'" class="wave">
      <span v-for="i in 24" :key="i" class="bar" :style="{ height: `${barHeight(i)}px` }" />
    </div>

    <div v-if="transcript" class="transcript">
      <div class="label">识别结果（可编辑后发送）</div>
      <textarea v-model="editable" class="rs-textarea" rows="2" />
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div class="actions">
      <template v-if="mode === 'record' && state === 'recording'">
        <button class="rs-btn primary" type="button" @click="finish">说完了</button>
        <button class="rs-btn danger" type="button" @click="cancel">取消</button>
      </template>
      <template v-else-if="transcript">
        <button class="rs-btn primary" type="button" @click="submit">发送</button>
        <button class="rs-btn" type="button" @click="reset">重录</button>
      </template>
      <template v-else-if="state === 'idle'">
        <button class="rs-btn primary" type="button" @click="start">开始说话</button>
      </template>
      <span v-if="continuous" class="continuous-tip">连续对话已开启：回答完自动开麦</span>
    </div>
  </div>
</template>

<script setup>
// 语音对话面板：负责一次完整的"开麦 → 识别 → 回填文本"流程，识别结果允许人工修正后再发送。
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import * as voice from '../../services/voice.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  continuous: { type: Boolean, default: false },
})
const emit = defineEmits(['submit', 'close'])

const state = ref('idle') // idle | listening | recording | recognizing
const mode = ref('auto')
const transcript = ref('')
const editable = ref('')
const error = ref('')
const level = ref(0)
let session = null
let levelTimer = null

const caps = computed(() => voice.capabilities())

const capabilityText = computed(() => {
  if (caps.value.android) return '安卓原生麦克风'
  if (caps.value.recognition) return '浏览器语音识别'
  if (caps.value.recorder) return '录音上传识别'
  return '当前环境不支持语音输入'
})

const stateText = computed(
  () =>
    ({
      idle: '点击开始说话',
      listening: '正在聆听…',
      recording: '正在录音，请说话',
      recognizing: '正在识别…',
    })[state.value] || ''
)

const stateIcon = computed(
  () => ({ idle: '🎙️', listening: '👂', recording: '🔴', recognizing: '⏳' })[state.value] || '🎙️'
)

const barHeight = (index) => {
  const base = 4
  const factor = Math.sin((Date.now() / 120 + index) * 0.7) * 0.5 + 0.5
  const amplitude = Math.min(1, level.value * 6)
  return base + factor * amplitude * 26
}

const reset = () => {
  state.value = 'idle'
  transcript.value = ''
  editable.value = ''
  error.value = ''
  level.value = 0
  if (levelTimer) clearInterval(levelTimer)
  levelTimer = null
  session = null
}

const start = async () => {
  error.value = ''
  transcript.value = ''
  editable.value = ''
  try {
    const capsNow = voice.capabilities()
    if (!capsNow.input) throw new Error('当前环境不支持语音输入')
    state.value = capsNow.recognition && !capsNow.android ? 'listening' : 'recording'
    mode.value = capsNow.recognition && !capsNow.android ? 'recognition' : 'record'

    const result = await voice.listen({
      onLevel: (value) => {
        level.value = value
      },
    })

    if (result.source === 'record' && typeof result.finish === 'function') {
      // 录音模式：等待用户点"说完了"
      mode.value = 'record'
      state.value = 'recording'
      levelTimer = setInterval(() => {
        level.value = voice.recordLevel()
      }, 120)
      session = result
      return
    }

    state.value = 'recognizing'
    transcript.value = result.text
    editable.value = result.text
    state.value = 'idle'
    if (!result.text) error.value = '没有识别到内容，请重试'
  } catch (e) {
    // 浏览器识别失败但有录音能力时，自动改走录音上传
    if (caps.value.recorder && mode.value === 'recognition') {
      mode.value = 'record'
      try {
        session = await voice.listen({ prefer: 'record', onLevel: (value) => (level.value = value) })
        state.value = 'recording'
        levelTimer = setInterval(() => {
          level.value = voice.recordLevel()
        }, 120)
        return
      } catch (inner) {
        error.value = inner.message
        state.value = 'idle'
        return
      }
    }
    error.value = e.message
    state.value = 'idle'
  }
}

const finish = async () => {
  if (!session?.finish) return
  state.value = 'recognizing'
  if (levelTimer) clearInterval(levelTimer)
  try {
    const result = await session.finish()
    transcript.value = result.text
    editable.value = result.text
    if (!result.text) error.value = '没有识别到内容，请重试'
  } catch (e) {
    error.value = e.message
  } finally {
    session = null
    state.value = 'idle'
  }
}

const submit = () => {
  const text = editable.value.trim()
  if (!text) {
    error.value = '识别结果为空，无法发送'
    return
  }
  emit('submit', text)
  reset()
}

const cancel = () => {
  session?.cancel?.()
  voice.stopListening()
  reset()
  emit('close')
}

watch(
  () => props.visible,
  (value) => {
    if (!value) cancel()
  }
)

onBeforeUnmount(() => {
  if (levelTimer) clearInterval(levelTimer)
  session?.cancel?.()
  voice.stopListening()
})

defineExpose({ start, reset })
</script>

<style scoped>
.voice-panel {
  border: 1px solid var(--rs-panel-border-strong);
  border-radius: 10px;
  background: rgba(0, 30, 55, 0.92);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--rs-text-strong);
}

.cap {
  font-size: 11px;
  color: var(--rs-text-dim);
}

.mic.recording {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}

.wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 34px;
}

.wave .bar {
  width: 3px;
  background: var(--rs-gradient);
  border-radius: 2px;
  transition: height 0.12s;
}

.transcript .label {
  font-size: 12px;
  color: var(--rs-text-dim);
  margin-bottom: 6px;
}

.transcript .rs-textarea {
  font-size: 13px;
}

.error {
  font-size: 12px;
  color: #ffb3ba;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.continuous-tip {
  font-size: 11px;
  color: var(--rs-text-dim);
}
</style>
