<template>
  <Teleport to="body">
    <transition name="agent">
      <div v-if="modelValue" class="agent-mask" @click.self="close">
        <div class="agent-dialog">
          <!-- 头部 -->
          <div class="dialog-head">
            <div class="title">
              <span class="logo">🤖</span>
              <div>
                <div class="name">铁路信号运维智能体</div>
                <div class="sub">
                  <span :class="['status-dot', { online: ollamaOnline }]" />
                  {{ ollamaOnline ? '模型服务在线' : '模型服务离线' }}
                  <span v-if="currentModel"> · {{ currentModel }}</span>
                </div>
              </div>
            </div>
            <div class="head-actions">
              <ModelPicker v-model="currentModel" @change="onModelChange" />
              <button class="icon-btn" type="button" title="历史会话" @click="toggleHistory">🕘</button>
              <button class="icon-btn" type="button" title="新会话" @click="newSession">✚</button>
              <button class="icon-btn" type="button" title="关闭" @click="close">✕</button>
            </div>
          </div>

          <div class="dialog-body">
            <!-- 历史会话抽屉 -->
            <div v-if="historyOpen" class="history">
              <div class="history-head">
                <span>历史会话</span>
                <button class="rs-btn small" type="button" @click="loadSessions">刷新</button>
              </div>
              <div class="history-list">
                <div v-if="sessionsLoading" class="hint">加载中…</div>
                <div v-else-if="!sessions.length" class="hint">暂无历史会话</div>
                <div
                  v-for="item in sessions"
                  :key="item.id"
                  :class="['history-item', { active: item.id === sessionId }]"
                  @click="openSession(item)"
                >
                  <div class="h-title">{{ item.title }}</div>
                  <div class="h-sub">{{ item.model }} · {{ item.message_count }} 条 · {{ shortTime(item.updated_at) }}</div>
                </div>
              </div>
            </div>

            <!-- 消息区 -->
            <div ref="scrollRef" class="messages">
              <div v-if="!messages.length" class="welcome">
                <div class="welcome-icon">🚦</div>
                <div class="welcome-title">你好，我是铁路信号运维智能体</div>
                <div class="welcome-sub">可以问我信号机实时状态、告警处置建议、工单安排等问题；也可以点右下角 🎙️ 直接语音提问。</div>
                <div class="samples">
                  <button v-for="sample in samples" :key="sample" class="sample" type="button" @click="askSample(sample)">
                    {{ sample }}
                  </button>
                </div>
              </div>

              <div v-for="(item, index) in messages" :key="index" :class="['msg', item.role]">
                <div class="bubble">
                  <div v-if="item.thinking" class="thinking">
                    <div class="thinking-head" @click="item.showThinking = !item.showThinking">
                      💭 思考过程（{{ item.thinking.length }} 字）{{ item.showThinking ? '收起' : '展开' }}
                    </div>
                    <pre v-if="item.showThinking" class="thinking-body">{{ item.thinking }}</pre>
                  </div>
                  <div class="content">{{ item.content }}<span v-if="item.streaming" class="caret">▊</span></div>
                  <div v-if="item.meta" class="msg-meta">{{ item.meta }}</div>
                </div>
                <button
                  v-if="item.role === 'assistant' && item.content && !item.streaming"
                  class="speak-btn"
                  type="button"
                  title="语音播报这条回答"
                  @click="speakMessage(item)"
                >
                  🔊
                </button>
              </div>

              <div v-if="error" class="error-banner">⚠️ {{ error }}</div>
            </div>
          </div>

          <!-- 语音面板 -->
          <div v-if="voiceOpen" class="voice-wrap">
            <VoicePanel :visible="voiceOpen" :continuous="continuous" @submit="sendVoice" @close="voiceOpen = false" />
          </div>

          <!-- 底部输入 -->
          <div class="dialog-foot">
            <textarea
              v-model="input"
              class="rs-textarea"
              rows="1"
              :placeholder="sending ? '正在生成回答…' : '输入问题，Enter 发送，Shift+Enter 换行'"
              :disabled="sending"
              @keydown.enter.exact.prevent="send()"
            />
            <div class="foot-actions">
              <button
                :class="['icon-btn', 'toggle', { on: ttsOn }]"
                type="button"
                :title="ttsOn ? '语音播报已开启' : '语音播报已关闭'"
                @click="toggleTts"
              >
                {{ ttsOn ? '🔊' : '🔇' }}
              </button>
              <button
                :class="['icon-btn', 'toggle', { on: voiceOpen }]"
                type="button"
                title="语音对话"
                @click="toggleVoice"
              >
                🎙️
              </button>
              <label class="continuous-switch" title="回答结束后自动开麦">
                <input v-model="continuous" type="checkbox" />
                连续对话
              </label>
              <button v-if="sending" class="rs-btn danger" type="button" @click="stop">停止</button>
              <button v-else class="rs-btn primary" type="button" :disabled="!input.trim()" @click="send()">发送</button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
// 智能体弹框：流式实时问答 + 语音播报 + 语音对话（安卓端走原生桥）。
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import ModelPicker from './ModelPicker.vue'
import VoicePanel from './VoicePanel.vue'
import * as ai from '../../services/ai.js'
import * as voice from '../../services/voice.js'
import { authState } from '../../services/auth.js'
import { toast } from '../common/AppToast.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const messages = ref([])
const input = ref('')
const sending = ref(false)
const error = ref('')
const sessionId = ref(0)
const currentModel = ref('')
const ollamaOnline = ref(false)
const ttsOn = ref(false)
const voiceOpen = ref(false)
const continuous = ref(false)
const historyOpen = ref(false)
const sessions = ref([])
const sessionsLoading = ref(false)
const scrollRef = ref(null)
let controller = null
let voicePanel = ref(null)

const samples = ['当前有哪些未处理告警？', '信号机 1495 现在状态如何？', '高湿环境下信号机该怎么巡检？']

const shortTime = (value) => (value ? String(value).replace('T', ' ').slice(5, 16) : '-')

const scrollToBottom = async () => {
  await nextTick()
  if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
}

const checkHealth = async () => {
  try {
    const data = await ai.health()
    ollamaOnline.value = Boolean(data?.ollama?.online)
  } catch (_) {
    ollamaOnline.value = false
  }
}

const send = async (text) => {
  const content = String(text ?? input.value).trim()
  if (!content || sending.value) return
  error.value = ''
  input.value = ''
  messages.value.push({ role: 'user', content })
  const answer = { role: 'assistant', content: '', streaming: true, thinking: '', showThinking: false, meta: '' }
  messages.value.push(answer)
  sending.value = true
  await scrollToBottom()

  controller = new AbortController()
  const startedAt = Date.now()
  try {
    const result = await ai.chat({
      message: content,
      model: currentModel.value,
      sessionId: sessionId.value,
      signal: controller.signal,
      onMeta: (payload) => {
        sessionId.value = payload.sessionId
        answer.meta = `模型 ${payload.model}`
      },
      onThinking: (chunk) => {
        answer.thinking += chunk
      },
      onDelta: (chunk) => {
        answer.content += chunk
        scrollToBottom()
      },
      onDone: (payload) => {
        answer.meta = `模型 ${currentModel.value} · ${payload.tokens || 0} tokens · ${((payload.latencyMs || Date.now() - startedAt) / 1000).toFixed(1)}s`
      },
    })
    answer.streaming = false
    if (!answer.content) answer.content = result.aborted ? '（已停止生成）' : '（模型没有返回内容）'
    await scrollToBottom()
    if (ttsOn.value && answer.content && !result.aborted) await speakMessage(answer)
    if (continuous.value && !result.aborted) {
      voiceOpen.value = true
      await nextTick()
      voicePanel.value?.start?.()
    }
  } catch (e) {
    answer.streaming = false
    if (e.name === 'AbortError' || controller?.signal.aborted) {
      if (!answer.content) messages.value = messages.value.filter((item) => item !== answer)
    } else {
      error.value = e.message
      if (!answer.content) messages.value = messages.value.filter((item) => item !== answer)
    }
  } finally {
    sending.value = false
    controller = null
  }
}

const askSample = (text) => send(text)

const sendVoice = (text) => {
  send(text)
}

const stop = () => {
  controller?.abort()
  sending.value = false
}

const speakMessage = async (item) => {
  const result = await voice.speak(item.content)
  if (!result.ok) toast.error('语音播报失败，请检查语音服务或浏览器语音支持')
  return result
}

const toggleTts = () => {
  ttsOn.value = !ttsOn.value
  if (!ttsOn.value) voice.stopSpeaking()
  toast.info(ttsOn.value ? '语音播报已开启' : '语音播报已关闭')
}

const toggleVoice = () => {
  const caps = voice.capabilities()
  if (!caps.input) {
    toast.error('当前环境不支持语音输入（需安卓端桥接或支持录音的浏览器）')
    return
  }
  voiceOpen.value = !voiceOpen.value
  if (!voiceOpen.value) voice.stopListening()
}

const onModelChange = (name) => {
  toast.info(`已切换模型：${name}`)
}

const newSession = () => {
  sessionId.value = 0
  messages.value = []
  error.value = ''
  historyOpen.value = false
  toast.success('已开启新会话')
}

const toggleHistory = async () => {
  historyOpen.value = !historyOpen.value
  if (historyOpen.value) await loadSessions()
}

const loadSessions = async () => {
  sessionsLoading.value = true
  try {
    const data = await ai.listSessions({ page: 1, pageSize: 20 })
    sessions.value = data.list || []
  } catch (e) {
    toast.error(e.message)
  } finally {
    sessionsLoading.value = false
  }
}

const openSession = async (item) => {
  try {
    const data = await ai.sessionMessages(item.id, { page: 1, pageSize: 100 })
    sessionId.value = item.id
    currentModel.value = item.model || currentModel.value
    messages.value = (data.list || []).map((row) => ({
      role: row.role,
      content: row.content,
      thinking: '',
      showThinking: false,
      meta: row.role === 'assistant' ? `模型 ${row.model} · ${row.tokens || 0} tokens` : '',
    }))
    historyOpen.value = false
    await scrollToBottom()
  } catch (e) {
    toast.error(e.message)
  }
}

const close = () => {
  stop()
  voice.stopSpeaking()
  voice.stopListening()
  voiceOpen.value = false
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  async (value) => {
    if (!value) return
    if (!currentModel.value) currentModel.value = authState.config.defaultModel || ''
    await checkHealth()
    await scrollToBottom()
  }
)

onBeforeUnmount(() => {
  controller?.abort()
  voice.stopSpeaking()
  voice.stopListening()
})

defineExpose({ send })
</script>

<style scoped>
.agent-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 8, 18, 0.55);
  backdrop-filter: blur(3px);
  z-index: 2500;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 20px 22px 96px;
}

.agent-dialog {
  width: 760px;
  max-width: 94vw;
  height: 78vh;
  max-height: 860px;
  display: flex;
  flex-direction: column;
  background: var(--rs-panel-bg-solid);
  border: 1px solid var(--rs-panel-border-strong);
  border-radius: 12px;
  box-shadow: 0 18px 60px rgba(0, 120, 200, 0.4);
  overflow: hidden;
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--rs-panel-border);
  background: rgba(0, 60, 100, 0.3);
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title .logo {
  font-size: 24px;
}

.title .name {
  font-size: 15px;
  font-weight: bold;
  color: var(--rs-text-strong);
}

.title .sub {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--rs-text-dim);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--rs-danger);
}

.status-dot.online {
  background: var(--rs-success);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  background: rgba(0, 60, 100, 0.5);
  border: 1px solid var(--rs-panel-border);
  border-radius: 6px;
  color: var(--rs-text);
  font-size: 13px;
  padding: 5px 9px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  border-color: var(--rs-primary);
  color: var(--rs-primary);
}

.icon-btn.toggle.on {
  background: rgba(0, 200, 255, 0.2);
  border-color: var(--rs-primary);
  color: var(--rs-primary);
}

.dialog-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.history {
  width: 240px;
  border-right: 1px solid var(--rs-panel-border);
  display: flex;
  flex-direction: column;
  background: rgba(0, 25, 45, 0.6);
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--rs-text-dim);
  border-bottom: 1px solid var(--rs-panel-border);
}

.history-list {
  overflow-y: auto;
  padding: 6px;
}

.history-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
}

.history-item:hover {
  background: rgba(0, 150, 220, 0.16);
}

.history-item.active {
  background: rgba(0, 200, 255, 0.14);
}

.h-title {
  font-size: 13px;
  color: var(--rs-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.h-sub {
  font-size: 11px;
  color: var(--rs-text-dim);
  margin-top: 3px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.welcome {
  margin: auto;
  text-align: center;
  max-width: 460px;
  color: var(--rs-text-dim);
}

.welcome-icon {
  font-size: 40px;
}

.welcome-title {
  margin-top: 10px;
  font-size: 15px;
  color: var(--rs-text-strong);
}

.welcome-sub {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.7;
}

.samples {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sample {
  padding: 8px 12px;
  background: rgba(0, 100, 150, 0.25);
  border: 1px solid var(--rs-panel-border);
  border-radius: 8px;
  color: var(--rs-text);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}

.sample:hover {
  border-color: var(--rs-primary);
  color: var(--rs-primary);
}

.msg {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.msg.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 82%;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13.5px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg.user .bubble {
  background: linear-gradient(135deg, #0066cc, #00a0e0);
  color: #fff;
  border-bottom-right-radius: 2px;
}

.msg.assistant .bubble {
  background: rgba(0, 45, 75, 0.75);
  border: 1px solid var(--rs-panel-border);
  color: var(--rs-text);
  border-bottom-left-radius: 2px;
}

.msg-meta {
  margin-top: 6px;
  font-size: 11px;
  color: var(--rs-text-dim);
}

.caret {
  animation: blink 1s step-end infinite;
  color: var(--rs-primary);
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.thinking {
  margin-bottom: 8px;
  border-left: 2px solid rgba(0, 200, 255, 0.4);
  padding-left: 8px;
}

.thinking-head {
  font-size: 11px;
  color: var(--rs-text-dim);
  cursor: pointer;
}

.thinking-body {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(127, 163, 184, 0.9);
  white-space: pre-wrap;
  font-family: inherit;
}

.speak-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
  padding: 2px;
}

.speak-btn:hover {
  opacity: 1;
}

.error-banner {
  padding: 9px 12px;
  border: 1px solid rgba(255, 77, 94, 0.5);
  background: rgba(255, 77, 94, 0.12);
  border-radius: 8px;
  color: #ffb3ba;
  font-size: 12.5px;
}

.voice-wrap {
  padding: 0 14px 10px;
}

.dialog-foot {
  border-top: 1px solid var(--rs-panel-border);
  padding: 10px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(0, 30, 55, 0.5);
}

.dialog-foot .rs-textarea {
  min-height: 42px;
  max-height: 120px;
  font-size: 13px;
}

.foot-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.foot-actions .rs-btn {
  margin-left: auto;
}

.continuous-switch {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--rs-text-dim);
  cursor: pointer;
  user-select: none;
}

.agent-enter-active,
.agent-leave-active {
  transition: opacity 0.2s;
}

.agent-enter-from,
.agent-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .agent-mask {
    padding: 0;
    align-items: stretch;
  }
  .agent-dialog {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    max-height: none;
    border-radius: 0;
  }
}
</style>
