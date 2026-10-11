import { all, get, initDatabase, run, tx } from '../server/api/lib/db.js'
import {
  hashPassword,
  isBuiltInDemoAccount,
  meetsStrongBootstrapPasswordPolicy,
} from '../server/api/lib/secure.js'

const password = process.env.API_BOOTSTRAP_ADMIN_PASSWORD || ''
if (process.env.NODE_ENV !== 'production') {
  throw new Error('Admin bootstrap is restricted to NODE_ENV=production.')
}
if (!meetsStrongBootstrapPasswordPolicy(password)) {
  throw new Error('API_BOOTSTRAP_ADMIN_PASSWORD must be 16-128 characters with upper/lowercase letters, a digit, and a symbol.')
}

await initDatabase()
const users = all('SELECT id, username, role, email, remark FROM users')
const existingAdmin = users.find((user) => user.username.toLowerCase() === 'admin')
if (existingAdmin && !isBuiltInDemoAccount(existingAdmin)) {
  throw new Error('A non-demo admin account already exists; it was left unchanged.')
}
const otherActiveAdmins = users.filter((user) =>
  user.role === 'admin' && user.username.toLowerCase() !== 'admin' && !isBuiltInDemoAccount(user)
)
if (otherActiveAdmins.length) {
  throw new Error('A custom admin account already exists; it was left unchanged.')
}

const { hash, salt } = await hashPassword(password)
const now = new Date().toISOString()
let adminId = existingAdmin?.id

tx(() => {
  for (const user of users) {
    if (!isBuiltInDemoAccount(user) || user.id === adminId) continue
    run("UPDATE users SET status = 'disabled', updated_at = :now WHERE id = :id", { now, id: user.id })
  }

  if (existingAdmin) {
    run(
      `UPDATE users SET password_hash = :hash, salt = :salt, role = 'admin', status = 'active',
       remark = '生产管理员（安全引导）', updated_at = :now WHERE id = :id`,
      { hash, salt, now, id: existingAdmin.id }
    )
  } else {
    const inserted = run(
      `INSERT INTO users (username, password_hash, salt, name, role, status, remark, created_at, updated_at)
       VALUES ('admin', :hash, :salt, '系统管理员', 'admin', 'active', '生产管理员（安全引导）', :now, :now)`,
      { hash, salt, now }
    )
    adminId = Number(inserted.lastInsertRowid)
  }

  run(
    `INSERT INTO op_logs (user_id, username, action, target_type, target_id, detail, ip, created_at)
     VALUES (:id, 'admin', '管理员安全引导', 'user', :target, '初始化或轮换管理员口令并停用内置演示账号', '127.0.0.1', :now)`,
    { id: adminId, target: String(adminId), now }
  )
})

const result = get('SELECT username, role, status FROM users WHERE id = :id', { id: adminId })
console.log(`管理员安全引导完成：${result.username} / ${result.role} / ${result.status}。口令未输出。`)
