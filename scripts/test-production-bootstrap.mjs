import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import net from 'node:net'
import pg from 'pg'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { verifyPassword } from '../server/api/lib/secure.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const database = process.env.PGDATABASE || ''
const demoPassword = 'DemoSmoke@2026Strong'
const adminPassword = 'BootstrapSmoke@2026Strong'
if (!/_test$/i.test(database)) throw new Error('Bootstrap integration test requires a dedicated PGDATABASE ending in _test.')
if (!process.env.PGPASSWORD) throw new Error('Set PGPASSWORD for the isolated PostgreSQL test role.')

const pool = new pg.Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database,
  user: process.env.PGUSER || 'railway_sign_app',
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: true } : undefined,
})
let api
let apiOutput = ''

const freePort = async () => {
  const listener = net.createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  await new Promise((resolve) => listener.close(resolve))
  return port
}

const runNode = (script, env) => spawnSync(process.execPath, [script], {
  cwd: root,
  env: { ...process.env, ...env },
  encoding: 'utf8',
  timeout: 30000,
})

const stopApi = async () => {
  if (!api || api.exitCode !== null) return
  const exited = once(api, 'exit')
  api.kill()
  await exited
  api = null
}

const captchaCode = async (base) => {
  const result = await fetch(`${base}/api/auth/captcha`).then((response) => response.json())
  return {
    id: result.data.id,
    code: [...result.data.svg.matchAll(/>([A-Z0-9])<\/text>/g)].map((match) => match[1]).join(''),
  }
}

try {
  await pool.query('SELECT 1')
  const before = await pool.query('SELECT COUNT(*)::int AS total FROM users').catch((error) => {
    if (error.code === '42P01') throw new Error('Initialize this empty test database with npm run db:migrate first.')
    throw error
  })
  assert.equal(before.rows[0].total, 0, 'refusing to seed a test database that already has users')

  const seeded = runNode('scripts/seed-test-data.mjs', {
    NODE_ENV: 'test',
    API_ENABLE_DEMO_SEED: '1',
    API_DEMO_PASSWORD: demoPassword,
  })
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout)

  const bootstrap = runNode('scripts/bootstrap-admin.mjs', {
    NODE_ENV: 'production',
    API_BOOTSTRAP_ADMIN_PASSWORD: adminPassword,
  })
  assert.equal(bootstrap.status, 0, bootstrap.stderr || bootstrap.stdout)
  assert.ok(!bootstrap.stdout.includes(adminPassword), 'bootstrap must not print the password')

  const accounts = (await pool.query('SELECT username, password_hash, salt, role, status, remark FROM users')).rows
  const admin = accounts.find((user) => user.username === 'admin')
  assert.equal(admin.role, 'admin')
  assert.equal(admin.status, 'active')
  assert.equal(admin.remark, '生产管理员（安全引导）')
  assert.equal(await verifyPassword(adminPassword, admin.password_hash, admin.salt), true)
  assert.equal(accounts.filter((user) => user.username !== 'admin' && user.status === 'active').length, 0)

  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  api = spawn(process.execPath, ['server/api-server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      API_HOST: '127.0.0.1',
      API_PORT: String(port),
      API_JWT_SECRET: 'test-only-admin-bootstrap-jwt-secret',
      API_INGEST_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  api.stdout.setEncoding('utf8').on('data', (chunk) => { apiOutput = (apiOutput + chunk).slice(-6000) })
  api.stderr.setEncoding('utf8').on('data', (chunk) => { apiOutput = (apiOutput + chunk).slice(-6000) })
  let ready = false
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (api.exitCode !== null) throw new Error(`API exited during startup:\n${apiOutput}`)
    try {
      if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(400) })).ok) { ready = true; break }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75))
  }
  assert.equal(ready, true, `production API did not become ready:\n${apiOutput}`)

  const captcha = await captchaCode(base)
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: adminPassword, captchaId: captcha.id, captchaCode: captcha.code }),
  })
  assert.equal(login.status, 200)

  const blockedCaptcha = await captchaCode(base)
  const demoLogin = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'operator', password: demoPassword, captchaId: blockedCaptcha.id, captchaCode: blockedCaptcha.code }),
  })
  assert.equal(demoLogin.status, 401)
  await stopApi()

  const weak = runNode('scripts/bootstrap-admin.mjs', {
    NODE_ENV: 'production',
    API_BOOTSTRAP_ADMIN_PASSWORD: 'weak-password',
  })
  assert.notEqual(weak.status, 0)
  assert.match(weak.stderr || weak.stdout, /16-128 characters/)
  console.log('Production admin bootstrap tests passed on isolated PostgreSQL: password rotation, test-account disablement, login, and weak-password rejection.')
} finally {
  await stopApi()
  await pool.end()
}
