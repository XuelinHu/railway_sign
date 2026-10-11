import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { AsyncLocalStorage } from 'node:async_hooks'
import pg from 'pg'
import { DATA_DIR, DATABASE_NAME } from './paths.js'

export { DATABASE_NAME }

const { Pool, types } = pg
types.setTypeParser(20, (value) => {
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : value
})

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'railway_sign_app',
  password: process.env.PGPASSWORD || '',
  database: DATABASE_NAME,
  max: Math.min(30, Math.max(1, Number(process.env.PGPOOL_MAX || 10))),
  ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: true } : undefined,
  application_name: 'railway_sign_api',
})

const transactionContext = new AsyncLocalStorage()
const ID_TABLES = new Set([
  'users', 'roles', 'signals', 'alarms', 'work_orders', 'telemetry_records',
  'ai_sessions', 'ai_messages', 'ai_models', 'login_logs', 'op_logs', 'password_resets',
])

export function bindParameters(sql, params = []) {
  const values = []
  const named = !Array.isArray(params)
  if (!named) {
    const nativeIndexes = [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]))
    if (nativeIndexes.length) {
      const maxIndex = Math.max(...nativeIndexes)
      if (maxIndex !== params.length || new Set(nativeIndexes).size !== maxIndex) {
        throw new Error('SQL parameter count does not match placeholders.')
      }
      return { text: sql, values: [...params] }
    }
  }
  const names = new Map()
  let text = ''
  let quote = null
  let lineComment = false
  let blockComment = false
  let positional = 0

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]
    if (lineComment) {
      text += char
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      text += char
      if (char === '*' && next === '/') { text += next; index += 1; blockComment = false }
      continue
    }
    if (quote) {
      text += quote === '`' && char === '`' ? '"' : char
      if (char === quote && next === quote) { text += next; index += 1 }
      else if (char === quote) quote = null
      continue
    }
    if ((char === '-' && next === '-') || (char === '/' && next === '*')) {
      text += char + next
      index += 1
      if (char === '-') lineComment = true
      else blockComment = true
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      text += char === '`' ? '"' : char
      continue
    }
    if (!named && char === '?') {
      positional += 1
      values.push(params[positional - 1] ?? null)
      text += `$${values.length}`
      continue
    }
    if (named && char === ':' && next !== ':' && sql[index - 1] !== ':' && /[A-Za-z_]/.test(next || '')) {
      const match = sql.slice(index + 1).match(/^[A-Za-z_][A-Za-z0-9_]*/)
      const name = match[0]
      if (!Object.hasOwn(params, name)) throw new Error(`Missing SQL parameter: ${name}`)
      if (!names.has(name)) { values.push(params[name] ?? null); names.set(name, values.length) }
      text += `$${names.get(name)}`
      index += name.length
      continue
    }
    text += char
  }
  if (!named && positional !== params.length) throw new Error('SQL parameter count does not match placeholders.')
  return { text, values }
}

function prepare(sql, params) {
  const insert = sql.match(/^\s*INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)/i)
  const statement = insert && ID_TABLES.has(insert[1].toLowerCase()) && !/\bRETURNING\b/i.test(sql)
    ? `${sql.trim().replace(/;$/, '')} RETURNING id`
    : sql
  return bindParameters(statement, params)
}

async function queryOn(client, sql, params = []) {
  const { text, values: rawValues } = prepare(sql, params)
  const values = rawValues.map((value) => {
    if (typeof value === 'boolean') return value ? 1 : 0
    if (value instanceof Date) return value.toISOString()
    return value
  })
  const result = values.length ? await client.query(text, values) : await client.query(text)
  return {
    rows: result.rows || [],
    rowCount: result.rowCount || 0,
    lastInsertRowid: result.rows?.[0]?.id,
  }
}

export const openDatabase = async () => {
  await pool.query('SELECT 1')
  return pool
}

export const getDb = () => pool

export const all = async (sql, params) => (await queryOn(transactionContext.getStore()?.client || pool, sql, params)).rows
export const get = async (sql, params) => (await queryOn(transactionContext.getStore()?.client || pool, sql, params)).rows[0]
export const run = async (sql, params) => {
  const { rowCount, lastInsertRowid } = await queryOn(transactionContext.getStore()?.client || pool, sql, params)
  return { changes: rowCount, rowCount, lastInsertRowid }
}
export const exec = async (sql, params) => queryOn(transactionContext.getStore()?.client || pool, sql, params)

export const tx = async (callback) => {
  if (transactionContext.getStore()) return callback()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await transactionContext.run({ client }, callback)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try { await client.query('ROLLBACK') } catch (_) { /* Keep the original transaction error. */ }
    throw error
  } finally {
    client.release()
  }
}

export const pageQuery = async ({ select = '*', from, where = '', params = {}, orderBy = 'id DESC', page = 1, pageSize = 10 }) => {
  const safePage = Math.max(1, Math.trunc(Number(page) || 1))
  const safeSize = Math.min(200, Math.max(1, Math.trunc(Number(pageSize) || 10)))
  const totalRow = await get(`SELECT COUNT(*) AS total ${from} ${where}`, params)
  const total = Number(totalRow?.total || 0)
  const list = await all(
    `SELECT ${select} ${from} ${where} ORDER BY ${orderBy} LIMIT :page_limit OFFSET :page_offset`,
    { ...params, page_limit: safeSize, page_offset: (safePage - 1) * safeSize }
  )
  return { list, total, page: safePage, pageSize: safeSize, totalPages: Math.max(1, Math.ceil(total / safeSize)) }
}

const migrationFiles = [
  ['001_initial_schema', fileURLToPath(new URL('../postgres/schema.sql', import.meta.url))],
  ['002_query_indexes', fileURLToPath(new URL('../postgres/migrations/002_query_indexes.sql', import.meta.url))],
  ['003_telemetry_raw_text', fileURLToPath(new URL('../postgres/migrations/003_telemetry_raw_text.sql', import.meta.url))],
  ['004_oidc_identity', fileURLToPath(new URL('../postgres/migrations/004_oidc_identity.sql', import.meta.url))],
]

async function applyMigrations() {
  const client = await pool.connect()
  const lockName = `railway_sign:migrate:${DATABASE_NAME}`
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [lockName])
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    for (const [version, file] of migrationFiles) {
      const sql = await fs.readFile(file, 'utf8')
      const checksum = crypto.createHash('sha256').update(sql).digest('hex')
      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', [version])
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Migration checksum changed: ${version}`)
        continue
      }
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [version, checksum])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [lockName]) } finally { client.release() }
  }
}

const ROLE_SEED = [
  ['admin', '超级管理员', '拥有全部管理台菜单与操作权限', ['*'], 1],
  ['operator', '运维人员', '可查看监测数据、处理告警与工单', ['dashboard:view', 'signals:view', 'alarms:view', 'alarms:handle', 'work-orders:view', 'work-orders:edit', 'telemetry:view', 'ai:use'], 2],
  ['user', '普通用户', '仅可查看可视化大屏与使用智能体', ['dashboard:view', 'ai:use'], 3],
]

const MODEL_SEED = [
  ['qwen3:30b-a3b', 'Qwen3 30B-A3B（MoE）', 'qwen3', '30.5B', 'Q4_K_M', 18600000000, '阿里通义千问三代 MoE 模型，激活参数仅 3B，中文能力最强，24G 显存可跑且响应快。', '推荐,MoE,中文,通用', 1, 1],
  ['deepseek-r1:14b', 'DeepSeek-R1 14B（蒸馏）', 'deepseek-r1', '14.8B', 'Q4_K_M', 9000000000, 'DeepSeek 开源推理模型蒸馏版，带思维链，适合故障研判与推理类问答。', '推理,思维链,中文', 0, 2],
  ['qwen3:14b', 'Qwen3 14B', 'qwen3', '14.8B', 'Q4_K_M', 9276198565, '通义千问三代 14B 稠密模型，综合能力均衡，本机已预装。', '中文,通用', 0, 3],
  ['qwen3:8b', 'Qwen3 8B', 'qwen3', '8.2B', 'Q4_K_M', 5220000000, '轻量快速版本，适合并发问答或显存紧张时的快速模式。', '快速,轻量', 0, 4],
  ['deepseek-r1:8b', 'DeepSeek-R1 8B（蒸馏）', 'deepseek-r1', '8.2B', 'Q4_K_M', 5200000000, 'DeepSeek-R1 轻量蒸馏版，推理链完整、占用更低。', '推理,轻量', 0, 5],
  ['qwen2.5:7b', 'Qwen2.5 7B', 'qwen2.5', '7.6B', 'Q4_K_M', 4700000000, '通义千问 2.5 代经典模型，稳定成熟，兼容性好。', '经典,稳定', 0, 6],
  ['glm4:9b', '智谱 GLM-4 9B', 'glm4', '9.4B', 'Q4_K_M', 5500000000, '智谱 AI 开源中文模型，中文指令跟随与写作表现好。', '中文,写作', 0, 7],
  ['gemma3:12b', 'Gemma 3 12B', 'gemma3', '12.2B', 'Q4_K_M', 8100000000, 'Google 开源多模态系列，中英文通用，作为对照模型。', '多模态,对照', 0, 8],
]

const CONFIG_SEED = [
  ['system.site_name', '铁路信号机数字孪生监测与可视化分析平台', '平台名称'],
  ['system.copyright', 'V1.0', '版本号'],
  ['system.page_size', '10', '管理台默认每页条数'],
  ['ai.default_model', 'qwen3:14b', '智能体默认模型'],
  ['ai.system_prompt', '你是铁路信号设备运维智能助手，回答要专业、简洁、面向现场作业。', '智能体系统提示词'],
  ['ai.max_history', '10', '发送给模型的历史消息条数'],
  ['ai.context_enabled', '1', '是否向模型注入实时监测上下文'],
  ['voice.tts_voice', 'zh-CN-XiaoxiaoNeural', '语音播报音色'],
  ['voice.asr_enabled', '1', '是否启用语音识别'],
  ['voice.tts_enabled', '1', '是否启用服务端语音播报'],
]

async function seedReferenceData() {
  const now = new Date().toISOString()
  await tx(async () => {
    for (const [code, name, description, permissions, sort] of ROLE_SEED) {
      await run(
        `INSERT INTO roles (code, name, description, permissions, built_in, sort, created_at, updated_at)
         VALUES (:code, :name, :description, :permissions::jsonb, 1, :sort, :now, :now)
         ON CONFLICT (code) DO NOTHING`,
        { code, name, description, permissions: JSON.stringify(permissions), sort, now }
      )
    }
    for (const [name, display_name, family, parameter_size, quantization, size_bytes, description, tags, is_default, sort] of MODEL_SEED) {
      await run(
        `INSERT INTO ai_models (name, display_name, provider, family, parameter_size, quantization, size_bytes, description, tags, source, is_default, sort, created_at, updated_at)
         VALUES (:name, :display_name, 'ollama', :family, :parameter_size, :quantization, :size_bytes, :description, :tags, 'catalog', :is_default, :sort, :now, :now)
         ON CONFLICT (name) DO NOTHING`,
        { name, display_name, family, parameter_size, quantization, size_bytes, description, tags, is_default, sort, now }
      )
    }
    for (const [key, value, description] of CONFIG_SEED) {
      await run(
        `INSERT INTO system_configs (key, value, description, updated_at)
         VALUES (:key, :value, :description, :now)
         ON CONFLICT (key) DO NOTHING`,
        { key, value, description, now }
      )
    }
  })
}

export const initDatabase = async () => {
  await openDatabase()
  await applyMigrations()
  await seedReferenceData()
  return { database: DATABASE_NAME, dataDir: DATA_DIR }
}

export const getConfig = async (key, fallback = '') => {
  const row = await get('SELECT value FROM system_configs WHERE key = :key', { key })
  return row ? row.value : fallback
}

export const setConfig = async (key, value, description = '') => run(
  `INSERT INTO system_configs (key, value, description, updated_at)
   VALUES (:key, :value, :description, :updated_at)
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = EXCLUDED.updated_at`,
  { key, value, description, updated_at: new Date().toISOString() }
)

export const closeDatabase = () => pool.end()

export default { openDatabase, getDb, all, get, run, exec, tx, pageQuery, initDatabase, getConfig, setConfig, closeDatabase, DATABASE_NAME }
