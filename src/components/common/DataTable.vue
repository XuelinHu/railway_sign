<template>
  <div class="table-wrap">
    <div class="table-scroll">
      <table class="rs-table">
        <thead>
          <tr>
            <th v-if="index" class="idx-col">#</th>
            <th
              v-for="col in columns"
              :key="col.key"
              :style="{ width: col.width, textAlign: col.align || 'left' }"
            >
              {{ col.title }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td :colspan="columns.length + (index ? 1 : 0)" class="state-cell">
              <span class="spinner" /> 正在加载…
            </td>
          </tr>
          <tr v-else-if="!rows.length">
            <td :colspan="columns.length + (index ? 1 : 0)" class="state-cell empty">暂无数据</td>
          </tr>
          <tr v-else v-for="(row, rowIndex) in rows" :key="rowKeyOf(row, rowIndex)">
            <td v-if="index" class="idx-col">{{ (indexBase ?? 0) + rowIndex + 1 }}</td>
            <td
              v-for="col in columns"
              :key="col.key"
              :style="{ textAlign: col.align || 'left' }"
              :title="col.tip ? textOf(row, col) : undefined"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="valueOf(row, col)" :index="rowIndex">
                <span :class="{ ellipsis: col.tip }">{{ textOf(row, col) }}</span>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
// 通用数据表格：粘性表头 + 行悬停（沿用 CenterPanel 的 .life-table-grid 视觉）。
const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  rowKey: { type: [String, Function], default: 'id' },
  index: { type: Boolean, default: true },
  indexBase: { type: Number, default: 0 },
})

const valueOf = (row, col) => (typeof col.key === 'function' ? col.key(row) : row?.[col.key])

const textOf = (row, col) => {
  const value = valueOf(row, col)
  if (typeof col.format === 'function') return col.format(value, row)
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

const rowKeyOf = (row, rowIndex) => {
  if (typeof props.rowKey === 'function') return props.rowKey(row, rowIndex)
  return row?.[props.rowKey] ?? rowIndex
}
</script>

<style scoped>
.table-wrap {
  width: 100%;
}

.table-scroll {
  overflow-x: auto;
  border: 1px solid var(--rs-panel-border);
  border-radius: var(--rs-radius);
  background: rgba(0, 25, 45, 0.5);
}

.rs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 640px;
}

.rs-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 11px 12px;
  background: rgba(0, 55, 95, 0.96);
  color: var(--rs-primary);
  font-weight: bold;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid var(--rs-panel-border-strong);
}

.rs-table tbody td {
  padding: 10px 12px;
  color: var(--rs-text);
  border-bottom: 1px solid rgba(0, 200, 255, 0.1);
  vertical-align: middle;
}

.rs-table tbody tr:hover td {
  background: rgba(0, 150, 220, 0.14);
}

.rs-table tbody tr:last-child td {
  border-bottom: none;
}

.idx-col {
  width: 52px;
  color: var(--rs-text-dim);
  text-align: center;
}

.state-cell {
  text-align: center;
  padding: 34px 12px;
  color: var(--rs-text-dim);
}

.state-cell.empty {
  color: rgba(127, 163, 184, 0.75);
}

.ellipsis {
  display: inline-block;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border: 2px solid rgba(0, 200, 255, 0.3);
  border-top-color: var(--rs-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: -2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
