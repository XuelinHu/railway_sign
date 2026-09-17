<template>
  <div class="model-picker">
    <div class="current" @click="toggle">
      <span class="dot" :class="{ online: ollamaOnline }" />
      <span class="name">{{ currentLabel }}</span>
      <span class="arrow">{{ open ? '▲' : '▼' }}</span>
    </div>

    <div v-if="open" class="dropdown">
      <div class="dropdown-head">
        <input v-model="keyword" class="rs-input search" placeholder="搜索模型" />
        <button class="rs-btn small" type="button" :disabled="loading" @click="load(true)">刷新</button>
      </div>

      <div class="list">
        <div v-if="loading" class="hint">正在读取模型列表…</div>
        <div v-else-if="!filtered.length" class="hint">没有匹配的模型</div>
        <div
          v-for="item in filtered"
          :key="item.name"
          :class="['item', { active: item.name === modelValue }]"
          @click="choose(item)"
        >
          <div class="item-main">
            <div class="item-title">
              <span class="name">{{ item.display_name || item.name }}</span>
              <span v-if="item.installed" class="rs-tag green">已安装</span>
              <span v-else class="rs-tag gray">未下载</span>
              <span v-if="item.name === defaultModel" class="rs-tag blue">默认</span>
            </div>
            <div class="item-sub">
              <span>{{ item.name }}</span>
              <span v-if="item.parameter_size">· {{ item.parameter_size }}</span>
              <span v-if="item.size_label">· {{ item.size_label }}</span>
              <span v-if="item.description" class="desc">· {{ item.description }}</span>
            </div>
          </div>

          <div v-if="!item.installed" class="item-action" @click.stop>
            <button v-if="pulling !== item.name" class="rs-btn small" type="button" @click="startPull(item.name)">
              下载
            </button>
            <div v-else class="progress-wrap">
              <div class="progress"><div class="bar" :style="{ width: `${percent}%` }" /></div>
              <span class="pct">{{ percent }}%</span>
              <button class="rs-btn small danger" type="button" @click="cancelPull">取消</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pulling" class="pull-status">
        <span class="spinner" /> 正在下载 {{ pulling }}：{{ statusText || '准备中' }}（{{ percent }}%）
      </div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
// 模型下拉：合并 Ollama 本机已装模型与推荐目录，未下载的一键拉取（SSE 进度）。
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { listModels, pullModel } from '../../services/ai.js'
import { toast } from '../common/AppToast.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const loading = ref(false)
const list = ref([])
const defaultModel = ref('')
const ollamaOnline = ref(false)
const keyword = ref('')
const pulling = ref('')
const percent = ref(0)
const statusText = ref('')
const error = ref('')
let controller = null

const currentLabel = computed(() => {
  const hit = list.value.find((item) => item.name === props.modelValue)
  if (!hit) return props.modelValue || '选择模型'
  return `${hit.display_name || hit.name}${hit.installed ? '' : '（未下载）'}`
})

const filtered = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  const rows = key
    ? list.value.filter((item) => `${item.name} ${item.display_name || ''} ${item.description || ''}`.toLowerCase().includes(key))
    : list.value
  // 已安装的排前面，其余保持目录顺序
  return [...rows].sort((a, b) => Number(b.installed) - Number(a.installed))
})

const load = async (notify = false) => {
  loading.value = true
  error.value = ''
  try {
    const data = await listModels()
    list.value = data.list || []
    defaultModel.value = data.defaultModel || ''
    ollamaOnline.value = Boolean(data.ollamaOnline)
    if (!props.modelValue && defaultModel.value) {
      emit('update:modelValue', defaultModel.value)
      emit('change', defaultModel.value)
    }
    if (notify) toast.success(`已刷新，共 ${list.value.length} 个模型`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const toggle = async () => {
  open.value = !open.value
  if (open.value && !list.value.length) await load()
}

const choose = (item) => {
  emit('update:modelValue', item.name)
  emit('change', item.name)
  open.value = false
  if (!item.installed) toast.info(`${item.name} 尚未下载，可先点右侧「下载」`)
}

const startPull = async (name) => {
  if (pulling.value) return
  pulling.value = name
  percent.value = 0
  statusText.value = ''
  error.value = ''
  controller = new AbortController()
  try {
    await pullModel({
      name,
      signal: controller.signal,
      onProgress: (payload) => {
        percent.value = payload.percent || 0
        statusText.value = payload.status || ''
      },
      onDone: () => {
        toast.success(`${name} 下载完成`)
      },
    })
    if (!controller.signal.aborted) {
      await load()
      emit('update:modelValue', name)
      emit('change', name)
    }
  } catch (e) {
    if (!controller.signal.aborted) {
      error.value = e.message
      toast.error(e.message)
    }
  } finally {
    pulling.value = ''
    controller = null
  }
}

const cancelPull = () => {
  controller?.abort()
  pulling.value = ''
  toast.info('已中断下载（已下载的分片会保留，可稍后继续）')
}

const onDocClick = (event) => {
  if (!event.target.closest?.('.model-picker')) open.value = false
}

onMounted(() => {
  load()
  document.addEventListener('click', onDocClick)
})

onBeforeUnmount(() => {
  controller?.abort()
  document.removeEventListener('click', onDocClick)
})

defineExpose({ load })
</script>

<style scoped>
.model-picker {
  position: relative;
}

.current {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--rs-panel-border);
  border-radius: 6px;
  background: rgba(0, 40, 70, 0.6);
  color: var(--rs-text);
  font-size: 12px;
  cursor: pointer;
  max-width: 240px;
}

.current:hover {
  border-color: var(--rs-primary);
}

.current .name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--rs-danger);
  flex-shrink: 0;
}

.dot.online {
  background: var(--rs-success);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
}

.arrow {
  color: var(--rs-text-dim);
  font-size: 10px;
}

.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  width: 460px;
  max-width: 82vw;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background: var(--rs-panel-bg-solid);
  border: 1px solid var(--rs-panel-border-strong);
  border-radius: 10px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
  z-index: 20;
  overflow: hidden;
}

.dropdown-head {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--rs-panel-border);
}

.dropdown-head .search {
  flex: 1;
  padding: 6px 10px;
  font-size: 12px;
}

.list {
  overflow-y: auto;
  padding: 6px;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.item:hover {
  background: rgba(0, 150, 220, 0.16);
}

.item.active {
  background: rgba(0, 200, 255, 0.14);
  border: 1px solid rgba(0, 200, 255, 0.4);
}

.item-main {
  min-width: 0;
}

.item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--rs-text-strong);
}

.item-sub {
  margin-top: 3px;
  font-size: 11px;
  color: var(--rs-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-sub .desc {
  color: rgba(127, 163, 184, 0.85);
}

.item-action {
  flex-shrink: 0;
}

.progress-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.progress {
  width: 74px;
  height: 6px;
  background: rgba(0, 60, 100, 0.8);
  border-radius: 3px;
  overflow: hidden;
}

.progress .bar {
  height: 100%;
  background: var(--rs-gradient);
  transition: width 0.3s;
}

.pct {
  font-size: 11px;
  color: var(--rs-primary);
  width: 32px;
}

.pull-status {
  padding: 8px 12px;
  border-top: 1px solid var(--rs-panel-border);
  font-size: 12px;
  color: var(--rs-text-dim);
}

.hint {
  padding: 18px;
  text-align: center;
  color: var(--rs-text-dim);
  font-size: 12px;
}

.error {
  padding: 8px 12px;
  font-size: 12px;
  color: #ffb3ba;
  border-top: 1px solid rgba(255, 77, 94, 0.3);
}

.spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border: 2px solid rgba(0, 200, 255, 0.3);
  border-top-color: var(--rs-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: -1px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
