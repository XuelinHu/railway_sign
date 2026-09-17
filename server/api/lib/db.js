// 统一后台数据库层：node:sqlite（Node 内置，零第三方依赖）。
//
// 注意 Node 24.14 的 node:sqlite 约束（已实测）：
//   - 绑定 boolean / undefined 会抛 TypeError，Date 会静默存成 NULL，统一在 toSqlValue 里转换；
//   - 没有 db.transaction() 辅助方法，用 BEGIN/COMMIT/ROLLBACK；
//   - 数值默认按 REAL 绑定，因此建表必须显式声明列类型（INTEGER/TEXT/REAL）；
//   - 全部接口是同步阻塞的，查询保持短小，批量写入放进一个事务。

import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { hashPassword } from './secure.js'
import { DATA_DIR, DB_FILE } from './paths.js'

export { DATA_DIR, DB_FILE }

const nowIso = () => new Date().toISOString()

export const toSqlValue = (value) => {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  return value
}

const bindArgs = (params) => {
  if (params === undefined || params === null) return []
  if (Array.isArray(params)) return params.map(toSqlValue)
  const bag = {}
  for (const [key, value] of Object.entries(params)) bag[key] = toSqlValue(value)
  return [bag]
}

let db = null

export const openDatabase = () => {
  if (db) return db
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
  db = new DatabaseSync(DB_FILE, { timeout: 5000 })
  // 读多写少的 HTTP 场景：WAL 让读不被写阻塞，busy_timeout 避免瞬时锁报错。
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec('PRAGMA busy_timeout = 5000')
  return db
}

export const getDb = () => db || openDatabase()

export const all = (sql, params) => getDb().prepare(sql).all(...bindArgs(params))
export const get = (sql, params) => getDb().prepare(sql).get(...bindArgs(params))
export const run = (sql, params) => getDb().prepare(sql).run(...bindArgs(params))
export const exec = (sql) => getDb().exec(sql)

export const tx = (fn) => {
  const database = getDb()
  database.exec('BEGIN')
  try {
    const result = fn()
    database.exec('COMMIT')
    return result
  } catch (error) {
    try {
      database.exec('ROLLBACK')
    } catch (_) {
      // 回滚失败时保留原始错误
    }
    throw error
  }
}

// 统一的分页查询：所有管理台列表接口都走这里，保证返回结构一致。
export const pageQuery = ({ select = '*', from, where = '', params = {}, orderBy = 'id DESC', page = 1, pageSize = 10 }) => {
  const safePage = Math.max(1, Number(page) || 1)
  const safeSize = Math.min(200, Math.max(1, Number(pageSize) || 10))
  const totalRow = get(`SELECT COUNT(*) AS total ${from} ${where}`, params)
  const total = Number(totalRow?.total || 0)
  const list = all(
    `SELECT ${select} ${from} ${where} ORDER BY ${orderBy} LIMIT :page_limit OFFSET :page_offset`,
    { ...params, page_limit: safeSize, page_offset: (safePage - 1) * safeSize }
  )
  return {
    list,
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages: Math.max(1, Math.ceil(total / safeSize)),
  }
}

const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length]
const between = (rng, min, max, digits = 1) => {
  const factor = 10 ** digits
  return Math.round((min + rng() * (max - min)) * factor) / factor
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  avatar TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  login_count INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  last_login_ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  permissions TEXT NOT NULL DEFAULT '[]',
  built_in INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  station TEXT NOT NULL DEFAULT '',
  kilometer TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '进站信号机',
  status TEXT NOT NULL DEFAULT 'green',
  temperature REAL NOT NULL DEFAULT 0,
  humidity REAL NOT NULL DEFAULT 0,
  voltage REAL NOT NULL DEFAULT 0,
  current REAL NOT NULL DEFAULT 0,
  light_intensity REAL NOT NULL DEFAULT 0,
  signal_strength REAL NOT NULL DEFAULT 0,
  online INTEGER NOT NULL DEFAULT 1,
  lamp_hours INTEGER NOT NULL DEFAULT 0,
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alarms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  signal_code TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT 'signal',
  level TEXT NOT NULL DEFAULT 'minor',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  suggestion TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT '系统自检',
  occurred_at TEXT NOT NULL,
  handled_by TEXT NOT NULL DEFAULT '',
  handled_at TEXT,
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '故障处理',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  assignee TEXT NOT NULL DEFAULT '',
  station TEXT NOT NULL DEFAULT '',
  alarm_code TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS telemetry_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL DEFAULT 'unknown',
  device TEXT NOT NULL DEFAULT 'unknown',
  distance_cm REAL,
  distance_m REAL,
  water_active INTEGER,
  wifi_ip TEXT NOT NULL DEFAULT '',
  uptime_ms INTEGER,
  ts_ms INTEGER,
  raw TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL DEFAULT 0,
  username TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '新会话',
  model TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'agent',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'ollama',
  family TEXT NOT NULL DEFAULT '',
  parameter_size TEXT NOT NULL DEFAULT '',
  quantization TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'catalog',
  is_default INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL DEFAULT 0,
  username TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  success INTEGER NOT NULL DEFAULT 1,
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS op_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL DEFAULT 0,
  username TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alarms_status ON alarms(status);
CREATE INDEX IF NOT EXISTS idx_alarms_occurred ON alarms(occurred_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_created ON telemetry_records(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_op_logs_created ON op_logs(created_at);
`

const ROLE_SEED = [
  {
    code: 'admin',
    name: '超级管理员',
    description: '拥有全部管理台菜单与操作权限',
    permissions: ['*'],
    built_in: 1,
    sort: 1,
  },
  {
    code: 'operator',
    name: '运维人员',
    description: '可查看监测数据、处理告警与工单',
    permissions: ['dashboard:view', 'signals:view', 'alarms:view', 'alarms:handle', 'work-orders:view', 'work-orders:edit', 'telemetry:view', 'ai:use'],
    built_in: 1,
    sort: 2,
  },
  {
    code: 'user',
    name: '普通用户',
    description: '仅可查看可视化大屏与使用智能体',
    permissions: ['dashboard:view', 'ai:use'],
    built_in: 1,
    sort: 3,
  },
]

const MODEL_SEED = [
  {
    name: 'qwen3:30b-a3b',
    display_name: 'Qwen3 30B-A3B（MoE）',
    family: 'qwen3',
    parameter_size: '30.5B',
    quantization: 'Q4_K_M',
    size_bytes: 18600000000,
    description: '阿里通义千问三代 MoE 模型，激活参数仅 3B，中文能力最强，24G 显存可跑且响应快。',
    tags: '推荐,MoE,中文,通用',
    is_default: 1,
    sort: 1,
  },
  {
    name: 'deepseek-r1:14b',
    display_name: 'DeepSeek-R1 14B（蒸馏）',
    family: 'deepseek-r1',
    parameter_size: '14.8B',
    quantization: 'Q4_K_M',
    size_bytes: 9000000000,
    description: 'DeepSeek 开源推理模型蒸馏版，带思维链，适合故障研判与推理类问答。',
    tags: '推理,思维链,中文',
    is_default: 0,
    sort: 2,
  },
  {
    name: 'qwen3:14b',
    display_name: 'Qwen3 14B',
    family: 'qwen3',
    parameter_size: '14.8B',
    quantization: 'Q4_K_M',
    size_bytes: 9276198565,
    description: '通义千问三代 14B 稠密模型，综合能力均衡，本机已预装。',
    tags: '中文,通用',
    is_default: 0,
    sort: 3,
  },
  {
    name: 'qwen3:8b',
    display_name: 'Qwen3 8B',
    family: 'qwen3',
    parameter_size: '8.2B',
    quantization: 'Q4_K_M',
    size_bytes: 5220000000,
    description: '轻量快速版本，适合并发问答或显存紧张时的快速模式。',
    tags: '快速,轻量',
    is_default: 0,
    sort: 4,
  },
  {
    name: 'deepseek-r1:8b',
    display_name: 'DeepSeek-R1 8B（蒸馏）',
    family: 'deepseek-r1',
    parameter_size: '8.2B',
    quantization: 'Q4_K_M',
    size_bytes: 5200000000,
    description: 'DeepSeek-R1 轻量蒸馏版，推理链完整、占用更低。',
    tags: '推理,轻量',
    is_default: 0,
    sort: 5,
  },
  {
    name: 'qwen2.5:7b',
    display_name: 'Qwen2.5 7B',
    family: 'qwen2.5',
    parameter_size: '7.6B',
    quantization: 'Q4_K_M',
    size_bytes: 4700000000,
    description: '通义千问 2.5 代经典模型，稳定成熟，兼容性好。',
    tags: '经典,稳定',
    is_default: 0,
    sort: 6,
  },
  {
    name: 'glm4:9b',
    display_name: '智谱 GLM-4 9B',
    family: 'glm4',
    parameter_size: '9.4B',
    quantization: 'Q4_K_M',
    size_bytes: 5500000000,
    description: '智谱 AI 开源中文模型，中文指令跟随与写作表现好。',
    tags: '中文,写作',
    is_default: 0,
    sort: 7,
  },
  {
    name: 'gemma3:12b',
    display_name: 'Gemma 3 12B',
    family: 'gemma3',
    parameter_size: '12.2B',
    quantization: 'Q4_K_M',
    size_bytes: 8100000000,
    description: 'Google 开源多模态系列，中英文通用，作为对照模型。',
    tags: '多模态,对照',
    is_default: 0,
    sort: 8,
  },
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

const ALARM_TEMPLATES = [
  {
    device_type: 'signal',
    level: 'critical',
    title: '信号机内部温度异常',
    content: '点灯单元内部温度超过阈值，疑似漏电严重，存在灭灯风险。',
    suggestion: '建议携带工具箱、密封圈及 LED 信号机点灯单元前往处理。',
  },
  {
    device_type: 'signal',
    level: 'major',
    title: '信号机主灯丝断丝告警',
    content: '主灯丝回路电流跌落，已切换至副灯丝工作。',
    suggestion: '请安排更换灯泡并检查灯座接触电阻。',
  },
  {
    device_type: 'track',
    level: 'critical',
    title: '调谐单元电容受潮容值漂移',
    content: '监测到调谐单元（FS）内部电容受潮容值改变，谐振频率偏离设计值。',
    suggestion: '请携带调谐单元备件及工具箱前往 K149+525 处进行更换作业。',
  },
  {
    device_type: 'track',
    level: 'major',
    title: '轨道电路电压跌落',
    content: '轨道电路接收端电压低于门限，可能影响区段占用检查。',
    suggestion: '检查钢轨接续线、绝缘节与送受电端设备。',
  },
  {
    device_type: 'switch',
    level: 'major',
    title: '道岔表示电路异常',
    content: '道岔转换后表示电压未达标准值，存在卡阻隐患。',
    suggestion: '检查尖轨密贴、转辙机接点与表示杆缺口。',
  },
  {
    device_type: 'power',
    level: 'minor',
    title: '电源屏输出电压波动',
    content: '电源屏交流输出电压波动超过允许范围，已自动稳压。',
    suggestion: '观察稳压模块与输入电源质量，必要时切换备用回路。',
  },
  {
    device_type: 'signal',
    level: 'minor',
    title: '信号机箱体湿度偏高',
    content: '箱体内部湿度偏高，建议巡检密封状态。',
    suggestion: '建议核查箱体密封、引线接头与排水条件。',
  },
  {
    device_type: 'track',
    level: 'info',
    title: '区段占用检测恢复正常',
    content: '该区段占用检测已恢复正常，告警自动消除。',
    suggestion: '无需处理，保持观察。',
  },
]

const STATIONS = ['K148+200', 'K148+800', 'K149+100', 'K149+525', 'K150+050', 'K150+600']
const DIRECTIONS = ['上行', '下行']
const SIGNAL_STATUS = ['green', 'red', 'yellow', 'off']

const seedUsers = async (rng) => {
  const existing = get('SELECT COUNT(*) AS total FROM users')
  if (Number(existing?.total || 0) > 0) return
  const now = nowIso()
  const rows = [
    { username: 'admin', password: 'Admin@123', name: '系统管理员', role: 'admin', phone: '13800000001', email: 'admin@railway.local' },
    { username: 'operator', password: 'Operator@123', name: '值班运维员', role: 'operator', phone: '13800000002', email: 'operator@railway.local' },
    { username: 'user', password: 'User@123', name: '演示用户', role: 'user', phone: '13800000003', email: 'user@railway.local' },
  ]
  const surnames = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭']
  const given = ['伟', '芳', '娜', '强', '磊', '洋', '静', '敏', '杰', '涛', '明', '超', '霞', '平', '刚', '丽']
  for (let i = 0; i < 48; i += 1) {
    const role = i % 11 === 0 ? 'operator' : 'user'
    const name = `${pick(rng, surnames)}${pick(rng, given)}${i % 3 === 0 ? pick(rng, given) : ''}`
    rows.push({
      username: `demo${String(i + 1).padStart(2, '0')}`,
      password: 'Demo@123',
      name,
      role,
      phone: `139${String(10000000 + Math.floor(rng() * 8999999))}`,
      email: `demo${i + 1}@railway.local`,
    })
  }
  // scrypt 走线程池（异步），先把全部口令哈希算好，再进同步事务写库。
  const prepared = []
  for (const row of rows) {
    const { hash, salt } = await hashPassword(row.password)
    prepared.push({ ...row, hash, salt })
  }
  tx(() => {
    prepared.forEach((row, index) => {
      const { hash, salt } = row
      const createdAt = new Date(Date.now() - (rows.length - index) * 36e5 * 7).toISOString()
      run(
        `INSERT INTO users (username, password_hash, salt, name, phone, email, role, status, remark, created_at, updated_at)
         VALUES (:username, :hash, :salt, :name, :phone, :email, :role, :status, :remark, :created_at, :updated_at)`,
        {
          username: row.username,
          hash,
          salt,
          name: row.name,
          phone: row.phone,
          email: row.email,
          role: row.role,
          status: index % 17 === 5 ? 'disabled' : 'active',
          remark: index < 3 ? '系统内置演示账号' : '',
          created_at: createdAt,
          updated_at: createdAt,
        }
      )
      const created = get('SELECT id FROM users WHERE username = :username', { username: row.username })
      for (let n = 0; n < 3; n += 1) {
        run(
          `INSERT INTO login_logs (user_id, username, ip, user_agent, success, message, created_at)
           VALUES (:user_id, :username, :ip, :ua, 1, '登录成功', :created_at)`,
          {
            user_id: created?.id || 0,
            username: row.username,
            ip: `192.168.1.${20 + Math.floor(rng() * 200)}`,
            ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',
            created_at: new Date(Date.now() - Math.floor(rng() * 30) * 864e5 - n * 36e5).toISOString(),
          }
        )
      }
    })
    run(
      `INSERT INTO login_logs (user_id, username, ip, user_agent, success, message, created_at)
       VALUES (0, 'unknown', '203.0.113.45', 'curl/8.5.0', 0, '用户名或密码错误', :created_at)`,
      { created_at: now }
    )
    run(
      `INSERT INTO op_logs (user_id, username, action, target_type, target_id, detail, ip, created_at)
       VALUES (1, 'admin', '系统初始化', 'system', 'init', '首次启动自动建表并写入演示数据', '127.0.0.1', :created_at)`,
      { created_at: now }
    )
  })
}

const seedSignals = () => {
  const existing = get('SELECT COUNT(*) AS total FROM signals')
  if (Number(existing?.total || 0) > 0) return
  const rng = mulberry32(20260418)
  const now = nowIso()
  // 主演示信号机（与前端孪生面板一致）+ 其余区间信号机，保证列表分页有数据。
  const primary = ['1491', '1493', '1495', '1497']
  const codes = [...primary]
  // 其余信号机编号与演示编号错开，避免 UNIQUE 冲突
  for (let i = 0; i < 20; i += 1) codes.push(String(1451 + i * 2))
  tx(() => {
    codes.forEach((code, index) => {
      const status = primary.includes(code) ? SIGNAL_STATUS[index % 3] : pick(rng, SIGNAL_STATUS)
      const offline = status === 'off'
      run(
        `INSERT INTO signals (code, name, station, kilometer, direction, type, status, temperature, humidity,
           voltage, current, light_intensity, signal_strength, online, lamp_hours, remark, created_at, updated_at)
         VALUES (:code, :name, :station, :kilometer, :direction, :type, :status, :temperature, :humidity,
           :voltage, :current, :light_intensity, :signal_strength, :online, :lamp_hours, :remark, :created_at, :updated_at)`,
        {
          code,
          name: `${code}信号机`,
          station: `${code.slice(0, 2)}站`,
          kilometer: pick(rng, STATIONS),
          direction: index % 2 === 0 ? DIRECTIONS[0] : DIRECTIONS[1],
          type: index % 4 === 0 ? '进站信号机' : index % 4 === 1 ? '出站信号机' : index % 4 === 2 ? '通过信号机' : '调车信号机',
          status,
          temperature: offline ? 0 : between(rng, 22, 46, 1),
          humidity: offline ? 0 : between(rng, 40, 88, 1),
          voltage: offline ? 0 : between(rng, 205, 231, 1),
          current: offline ? 0 : between(rng, 1.2, 3.9, 2),
          light_intensity: offline ? 0 : Math.round(between(rng, 400, 1800, 0)),
          signal_strength: offline ? -95 : Math.round(between(rng, -72, -40, 0)),
          online: offline ? 0 : 1,
          lamp_hours: Math.round(between(rng, 1200, 26000, 0)),
          remark: primary.includes(code) ? '演示重点监测信号机' : '',
          created_at: new Date(Date.now() - (codes.length - index) * 864e5).toISOString(),
          updated_at: now,
        }
      )
    })
  })
}

const seedAlarms = () => {
  const existing = get('SELECT COUNT(*) AS total FROM alarms')
  if (Number(existing?.total || 0) > 0) return
  const rng = mulberry32(20260419)
  const now = nowIso()
  const signalRows = all('SELECT code FROM signals ORDER BY id')
  const codes = signalRows.map((row) => row.code)
  const statuses = ['pending', 'pending', 'handling', 'resolved', 'resolved', 'closed']
  const handlers = ['张伟', '李强', '王芳', '刘洋', '']
  tx(() => {
    for (let i = 0; i < 96; i += 1) {
      const template = ALARM_TEMPLATES[i % ALARM_TEMPLATES.length]
      const status = i < 6 ? 'pending' : pick(rng, statuses)
      const occurredAt = new Date(Date.now() - Math.floor(rng() * 20 * 864e5) - i * 36e5).toISOString()
      const handled = status === 'pending' ? '' : pick(rng, handlers)
      run(
        `INSERT INTO alarms (code, signal_code, device_type, level, title, content, suggestion, status,
           source, occurred_at, handled_by, handled_at, remark, created_at, updated_at)
         VALUES (:code, :signal_code, :device_type, :level, :title, :content, :suggestion, :status,
           :source, :occurred_at, :handled_by, :handled_at, :remark, :created_at, :updated_at)`,
        {
          code: `AL${String(20260000 + i + 1)}`,
          signal_code: codes[i % codes.length] || '1495',
          device_type: template.device_type,
          level: template.level,
          title: template.title,
          content: template.content,
          suggestion: template.suggestion,
          status,
          source: pick(rng, ['系统自检', '遥测上报', '人工上报', '阈值告警']),
          occurred_at: occurredAt,
          handled_by: handled,
          handled_at: handled ? new Date(new Date(occurredAt).getTime() + 36e5).toISOString() : null,
          remark: handled ? '已现场确认并处理' : '',
          created_at: occurredAt,
          updated_at: now,
        }
      )
    }
  })
}

const seedWorkOrders = () => {
  const existing = get('SELECT COUNT(*) AS total FROM work_orders')
  if (Number(existing?.total || 0) > 0) return
  const rng = mulberry32(20260420)
  const now = nowIso()
  const alarms = all('SELECT code, title, signal_code FROM alarms ORDER BY id LIMIT 42')
  const assignees = ['张伟', '李强', '王芳', '刘洋', '陈静', '赵磊']
  const types = ['故障处理', '计划检修', '巡检任务', '备件更换']
  const priorities = ['high', 'medium', 'low']
  const statuses = ['pending', 'processing', 'finished', 'closed']
  tx(() => {
    alarms.forEach((alarm, index) => {
      const status = pick(rng, statuses)
      const createdAt = new Date(Date.now() - Math.floor(rng() * 25 * 864e5)).toISOString()
      run(
        `INSERT INTO work_orders (code, title, type, priority, status, assignee, station, alarm_code,
           description, remark, created_at, updated_at, finished_at)
         VALUES (:code, :title, :type, :priority, :status, :assignee, :station, :alarm_code,
           :description, :remark, :created_at, :updated_at, :finished_at)`,
        {
          code: `WO${String(20260000 + index + 1)}`,
          title: `${alarm.signal_code} ${alarm.title}`,
          type: pick(rng, types),
          priority: pick(rng, priorities),
          status,
          assignee: pick(rng, assignees),
          station: pick(rng, STATIONS),
          alarm_code: alarm.code,
          description: `依据告警 ${alarm.code} 生成的现场处置工单。`,
          remark: status === 'finished' || status === 'closed' ? '现场已恢复，参数正常' : '',
          created_at: createdAt,
          updated_at: now,
          finished_at: status === 'finished' || status === 'closed' ? new Date(new Date(createdAt).getTime() + 72e5).toISOString() : null,
        }
      )
    })
  })
}

const seedTelemetry = () => {
  const existing = get('SELECT COUNT(*) AS total FROM telemetry_records')
  if (Number(existing?.total || 0) > 0) return
  const rng = mulberry32(20260421)
  const devices = [
    { device_id: 'esp32-1491', device: '行人预警雷达-1491' },
    { device_id: 'esp32-1493', device: '行人预警雷达-1493' },
    { device_id: 'esp32-1495', device: '行人预警雷达-1495' },
    { device_id: 'esp32-1497', device: '行人预警雷达-1497' },
  ]
  tx(() => {
    for (let i = 0; i < 180; i += 1) {
      const device = devices[i % devices.length]
      const distanceCm = between(rng, 35, 620, 1)
      const ts = Date.now() - (180 - i) * 6e4
      run(
        `INSERT INTO telemetry_records (device_id, device, distance_cm, distance_m, water_active,
           wifi_ip, uptime_ms, ts_ms, raw, created_at)
         VALUES (:device_id, :device, :distance_cm, :distance_m, :water_active,
           :wifi_ip, :uptime_ms, :ts_ms, :raw, :created_at)`,
        {
          device_id: device.device_id,
          device: device.device,
          distance_cm: distanceCm,
          distance_m: Math.round((distanceCm / 100) * 100) / 100,
          water_active: rng() > 0.75 ? 1 : 0,
          wifi_ip: `192.168.1.${60 + (i % 4) * 3}`,
          uptime_ms: 3600000 + i * 60000,
          ts_ms: ts,
          raw: JSON.stringify({ device: device.device, distance_cm: distanceCm, ts_ms: ts }),
          created_at: new Date(ts).toISOString(),
        }
      )
    }
  })
}

const seedAi = () => {
  const existing = get('SELECT COUNT(*) AS total FROM ai_sessions')
  if (Number(existing?.total || 0) > 0) return
  const now = nowIso()
  const samples = [
    { username: 'admin', user_id: 1, title: '1495信号机温度异常如何处置', model: 'qwen3:14b' },
    { username: 'admin', user_id: 1, title: '调谐单元电容漂移的排查步骤', model: 'qwen3:14b' },
    { username: 'operator', user_id: 2, title: '电源屏电压波动是否影响信号机', model: 'qwen3:8b' },
    { username: 'user', user_id: 3, title: '本平台有哪些可视化功能', model: 'qwen3:14b' },
    { username: 'operator', user_id: 2, title: '轨道电路区段占用异常分析', model: 'deepseek-r1:14b' },
  ]
  tx(() => {
    samples.forEach((sample, index) => {
      const createdAt = new Date(Date.now() - (samples.length - index) * 36e5 * 5).toISOString()
      const inserted = run(
        `INSERT INTO ai_sessions (user_id, username, title, model, message_count, source, created_at, updated_at)
         VALUES (:user_id, :username, :title, :model, 2, 'agent', :created_at, :updated_at)`,
        { ...sample, created_at: createdAt, updated_at: createdAt }
      )
      const sessionId = Number(inserted.lastInsertRowid)
      run(
        `INSERT INTO ai_messages (session_id, role, content, model, tokens, latency_ms, created_at)
         VALUES (:session_id, 'user', :content, '', 0, 0, :created_at)`,
        { session_id: sessionId, content: sample.title, created_at: createdAt }
      )
      run(
        `INSERT INTO ai_messages (session_id, role, content, model, tokens, latency_ms, created_at)
         VALUES (:session_id, 'assistant', :content, :model, :tokens, :latency, :created_at)`,
        {
          session_id: sessionId,
          content: '这是演示会话记录，用于管理台「智能体会话」菜单的分页展示。',
          model: sample.model,
          tokens: 64,
          latency: 1500,
          created_at: now,
        }
      )
    })
  })
}

const seedModelsAndConfigs = () => {
  const now = nowIso()
  tx(() => {
    MODEL_SEED.forEach((model) => {
      run(
        `INSERT INTO ai_models (name, display_name, provider, family, parameter_size, quantization, size_bytes,
           description, tags, source, is_default, sort, created_at, updated_at)
         VALUES (:name, :display_name, 'ollama', :family, :parameter_size, :quantization, :size_bytes,
           :description, :tags, 'catalog', :is_default, :sort, :created_at, :updated_at)
         ON CONFLICT(name) DO UPDATE SET
           display_name = excluded.display_name,
           description = excluded.description,
           tags = excluded.tags,
           size_bytes = excluded.size_bytes,
           updated_at = excluded.updated_at`,
        { ...model, created_at: now, updated_at: now }
      )
    })
    ROLE_SEED.forEach((role) => {
      run(
        `INSERT INTO roles (code, name, description, permissions, built_in, sort, created_at, updated_at)
         VALUES (:code, :name, :description, :permissions, :built_in, :sort, :created_at, :updated_at)
         ON CONFLICT(code) DO NOTHING`,
        { ...role, permissions: JSON.stringify(role.permissions), created_at: now, updated_at: now }
      )
    })
    CONFIG_SEED.forEach(([key, value, description]) => {
      run(
        `INSERT INTO system_configs (key, value, description, updated_at)
         VALUES (:key, :value, :description, :updated_at)
         ON CONFLICT(key) DO NOTHING`,
        { key, value, description, updated_at: now }
      )
    })
  })
}

export const initDatabase = async () => {
  openDatabase()
  exec(SCHEMA)
  seedModelsAndConfigs()
  await seedUsers(mulberry32(20260417))
  seedSignals()
  seedAlarms()
  seedWorkOrders()
  seedTelemetry()
  seedAi()
  return { dbFile: DB_FILE, dataDir: DATA_DIR }
}

export const getConfig = (key, fallback = '') => {
  const row = get('SELECT value FROM system_configs WHERE key = :key', { key })
  return row ? row.value : fallback
}

export const setConfig = (key, value, description = '') => {
  run(
    `INSERT INTO system_configs (key, value, description, updated_at)
     VALUES (:key, :value, :description, :updated_at)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, description = excluded.description, updated_at = excluded.updated_at`,
    { key, value, description, updated_at: nowIso() }
  )
}

export default {
  openDatabase,
  getDb,
  all,
  get,
  run,
  exec,
  tx,
  pageQuery,
  initDatabase,
  getConfig,
  setConfig,
  DB_FILE,
  DATA_DIR,
}
