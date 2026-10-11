import { closeDatabase, get, initDatabase, run, tx } from '../server/api/lib/postgres.js'
import { hashPassword, meetsStrongBootstrapPasswordPolicy } from '../server/api/lib/secure.js'

const database = process.env.PGDATABASE || ''
const password = process.env.API_DEMO_PASSWORD || ''
if (process.env.NODE_ENV === 'production') throw new Error('Test seeding is disabled in production.')
if (process.env.API_ENABLE_DEMO_SEED !== '1') throw new Error('Set API_ENABLE_DEMO_SEED=1 to enable test seeding.')
if (!/(?:_test)$/i.test(database)) throw new Error('Test seeding requires a PGDATABASE ending in _test.')
if (!meetsStrongBootstrapPasswordPolicy(password)) throw new Error('API_DEMO_PASSWORD must meet the strong test-password policy.')

await initDatabase()
const existing = await get('SELECT COUNT(*) AS total FROM users')
if (Number(existing?.total || 0) > 0) throw new Error('Refusing to seed a database that already contains users.')

const accounts = [
  ['admin', '系统管理员', 'admin'],
  ['operator', '运维人员', 'operator'],
  ['user', '测试用户', 'user'],
]
for (let index = 1; index <= 48; index += 1) {
  accounts.push([`demo${String(index).padStart(2, '0')}`, `隔离测试用户${index}`, index % 11 === 0 ? 'operator' : 'user'])
}

const preparedAccounts = []
for (let index = 0; index < accounts.length; index += 1) {
  const [username, name, role] = accounts[index]
  const { hash, salt } = await hashPassword(password)
  preparedAccounts.push({ username, name, role, hash, salt, index })
}

const users = []
await tx(async () => {
  for (const account of preparedAccounts) {
    users.push(await run(
      `INSERT INTO users (username, password_hash, salt, name, phone, email, role, status, remark, created_at, updated_at)
       VALUES (:username, :hash, :salt, :name, :phone, :email, :role, 'active', '系统内置演示账号', :now, :now)`,
      {
        ...account,
        phone: `139${String(10000000 + account.index).padStart(8, '0')}`,
        email: `${account.username}@railway.local`,
        now: new Date(Date.now() - account.index * 864e5).toISOString(),
      }
    ))
  }

  for (let index = 0; index < 24; index += 1) {
    const code = `T${String(1491 + index * 2)}`
    await run(
      `INSERT INTO signals (code, name, station, kilometer, direction, type, status, temperature, humidity, voltage, current, light_intensity, signal_strength, online, lamp_hours, remark, created_at, updated_at)
       VALUES (:code, :name, :station, :kilometer, :direction, :type, :status, :temperature, :humidity, :voltage, :current, :light, :strength, :online, :hours, '', :created, :now)`,
      {
        code,
        name: `${code}信号机`,
        station: `${index + 1}站`,
        kilometer: `K149+${String(index * 25).padStart(3, '0')}`,
        direction: index % 2 ? '下行' : '上行',
        type: '进站信号机',
        status: ['green', 'yellow', 'red', 'off'][index % 4],
        temperature: 22 + index % 20,
        humidity: 45 + index % 40,
        voltage: 210 + index % 20,
        current: 1.2 + index / 10,
        light: 400 + index * 20,
        strength: -70 + index % 20,
        online: index % 4 === 3 ? 0 : 1,
        hours: 1000 + index * 100,
        created: new Date(Date.now() - index * 864e5).toISOString(),
        now: new Date().toISOString(),
      }
    )
  }

  for (let index = 0; index < 96; index += 1) {
    const occurredAt = new Date(Date.now() - index * 3600e3).toISOString()
    const status = index < 12 ? 'pending' : ['handling', 'resolved', 'closed'][index % 3]
    await run(
      `INSERT INTO alarms (code, signal_code, device_type, level, title, content, suggestion, status, source, occurred_at, handled_by, handled_at, remark, created_at, updated_at)
       VALUES (:code, :signal, 'signal', :level, :title, '隔离测试告警', '完成检查', :status, '隔离测试', :occurred, :handler, :handled, '', :occurred, :now)`,
      {
        code: `ALTEST${String(index + 1).padStart(3, '0')}`,
        signal: `T${String(1491 + (index % 24) * 2)}`,
        level: ['critical', 'major', 'minor', 'info'][index % 4],
        title: `测试告警 ${index + 1}`,
        status,
        occurred: occurredAt,
        handler: status === 'pending' ? '' : '隔离测试人员',
        handled: status === 'pending' ? null : new Date(Date.parse(occurredAt) + 60000).toISOString(),
        now: new Date().toISOString(),
      }
    )
  }

  for (let index = 0; index < 42; index += 1) {
    const createdAt = new Date(Date.now() - index * 7200e3).toISOString()
    await run(
      `INSERT INTO work_orders (code, title, type, priority, status, assignee, station, alarm_code, description, remark, created_at, updated_at, finished_at)
       VALUES (:code, :title, '巡检任务', :priority, :status, :assignee, :station, :alarm, '隔离测试工单', '', :created, :created, :finished)`,
      {
        code: `WOTEST${String(index + 1).padStart(3, '0')}`,
        title: `测试工单 ${index + 1}`,
        priority: ['high', 'medium', 'low'][index % 3],
        status: ['pending', 'processing', 'finished'][index % 3],
        assignee: `测试人员${index % 6 + 1}`,
        station: `测试站${index % 6 + 1}`,
        alarm: `ALTEST${String(index + 1).padStart(3, '0')}`,
        created: createdAt,
        finished: index % 3 === 2 ? createdAt : null,
      }
    )
  }

  for (let index = 0; index < 180; index += 1) {
    const createdAt = new Date(Date.now() - index * 60e3).toISOString()
    await run(
      `INSERT INTO telemetry_records (device_id, device, distance_cm, distance_m, water_active, wifi_ip, uptime_ms, ts_ms, raw, created_at)
       VALUES (:device_id, :device, :distance_cm, :distance_m, :water, '127.0.0.1', :uptime, :ts, :raw, :created)`,
      {
        device_id: `test-radar-${index % 4 + 1}`,
        device: `隔离测试雷达-${index % 4 + 1}`,
        distance_cm: 80 + index % 400,
        distance_m: (80 + index % 400) / 100,
        water: index % 5 === 0 ? 1 : 0,
        uptime: index * 60000,
        ts: Date.now() - index * 60000,
        raw: JSON.stringify({ test: true, index }),
        created: createdAt,
      }
    )
  }

  for (let index = 0; index < 80; index += 1) {
    const userIndex = index % users.length
    await run(
      `INSERT INTO login_logs (user_id, username, ip, user_agent, success, message, created_at)
       VALUES (:user_id, :username, '127.0.0.1', 'isolated-test', :success, '隔离测试登录', :created)`,
      { user_id: users[userIndex].lastInsertRowid, username: accounts[userIndex][0], success: index % 7 ? 1 : 0, created: new Date(Date.now() - index * 3600e3).toISOString() }
    )
  }

  for (let index = 0; index < 30; index += 1) {
    await run(
      `INSERT INTO op_logs (user_id, username, action, target_type, target_id, detail, ip, created_at)
       VALUES (:user_id, :username, '隔离测试', 'test', :target_id, '隔离测试审计记录', '127.0.0.1', :created)`,
      { user_id: users[0].lastInsertRowid, username: 'admin', target_id: String(index + 1), created: new Date(Date.now() - index * 3600e3).toISOString() }
    )
  }

  for (let index = 0; index < 12; index += 1) {
    const userIndex = index % users.length
    const createdAt = new Date(Date.now() - index * 3600e3).toISOString()
    const session = await run(
      `INSERT INTO ai_sessions (user_id, username, title, model, message_count, source, created_at, updated_at)
       VALUES (:user_id, :username, :title, 'qwen3:14b', 2, 'agent', :created, :created)`,
      { user_id: users[userIndex].lastInsertRowid, username: accounts[userIndex][0], title: `隔离测试会话 ${index + 1}`, created: createdAt }
    )
    await run(
      `INSERT INTO ai_messages (session_id, role, content, model, tokens, latency_ms, created_at)
       VALUES (:session_id, 'user', '隔离测试问题', '', 0, 0, :created),
              (:session_id, 'assistant', '隔离测试回复', 'qwen3:14b', 12, 30, :created)`,
      { session_id: session.lastInsertRowid, created: createdAt }
    )
  }
})

console.log(`Seeded isolated smoke fixtures in ${database}: ${accounts.length} users, 24 signals, 96 alarms, 42 work orders, 180 telemetry rows.`)
await closeDatabase()
