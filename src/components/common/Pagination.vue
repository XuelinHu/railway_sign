<template>
  <div class="pager">
    <div class="pager-info">
      共 <b>{{ total }}</b> 条 · 第 <b>{{ page }}</b>/{{ Math.max(1, totalPages) }} 页
    </div>

    <div class="pager-ctrl">
      <button class="rs-btn small" :disabled="page <= 1" @click="go(1)">首页</button>
      <button class="rs-btn small" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
      <button
        v-for="item in pages"
        :key="item.key"
        :class="['rs-btn', 'small', 'num', { active: item.value === page }]"
        :disabled="item.value === null"
        @click="item.value && go(item.value)"
      >
        {{ item.label }}
      </button>
      <button class="rs-btn small" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
      <button class="rs-btn small" :disabled="page >= totalPages" @click="go(totalPages)">末页</button>

      <select class="rs-select size-select" :value="pageSize" @change="changeSize($event.target.value)">
        <option v-for="size in sizeOptions" :key="size" :value="size">{{ size }} 条/页</option>
      </select>

      <span class="jump">
        跳至
        <input class="rs-input jump-input" type="number" min="1" :max="Math.max(1, totalPages)" :value="jumpValue" @input="jumpValue = $event.target.value" @keyup.enter="jump" />
        页
        <button class="rs-btn small" @click="jump">Go</button>
      </span>
    </div>
  </div>
</template>

<script setup>
// 分页控件：服务端分页，页码窗口最多 7 个，支持改每页条数与跳页。
import { computed, ref, watch } from 'vue'

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  total: { type: Number, default: 0 },
  totalPages: { type: Number, default: 1 },
  sizeOptions: { type: Array, default: () => [10, 20, 50, 100] },
})
const emit = defineEmits(['update:page', 'update:pageSize', 'change'])

const jumpValue = ref(props.page)
watch(() => props.page, (value) => { jumpValue.value = value })

const pages = computed(() => {
  const last = Math.max(1, props.totalPages)
  const current = Math.min(Math.max(1, props.page), last)
  const items = []
  if (last <= 7) {
    for (let i = 1; i <= last; i++) items.push({ key: i, label: String(i), value: i })
    return items
  }
  const push = (value) => items.push({ key: value, label: String(value), value })
  const gap = (key) => items.push({ key, label: '…', value: null })
  push(1)
  if (current > 3) gap('start-gap')
  for (let i = Math.max(2, current - 1); i <= Math.min(last - 1, current + 1); i++) push(i)
  if (current < last - 2) gap('end-gap')
  push(last)
  return items
})

const go = (target) => {
  const last = Math.max(1, props.totalPages)
  const next = Math.min(Math.max(1, Number(target) || 1), last)
  if (next === props.page) return
  emit('update:page', next)
  emit('change', { page: next, pageSize: props.pageSize })
}

const changeSize = (value) => {
  const size = Number(value) || 10
  emit('update:pageSize', size)
  emit('update:page', 1)
  emit('change', { page: 1, pageSize: size })
}

const jump = () => {
  go(Number(jumpValue.value))
}
</script>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 4px 2px;
  font-size: 13px;
  color: var(--rs-text-dim);
}

.pager-info b {
  color: var(--rs-primary);
  font-weight: bold;
}

.pager-ctrl {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.rs-btn.num {
  min-width: 34px;
  padding: 5px 6px;
}

.rs-btn.num.active {
  background: var(--rs-gradient);
  border-color: var(--rs-primary);
  color: #fff;
  font-weight: bold;
}

.size-select {
  width: auto;
  padding: 5px 8px;
  font-size: 12px;
}

.jump {
  display: flex;
  align-items: center;
  gap: 5px;
}

.jump-input {
  width: 58px;
  padding: 5px 8px;
  font-size: 12px;
  text-align: center;
}
</style>
