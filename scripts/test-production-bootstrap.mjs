import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { verifyPassword } from '../server/api/lib/secure.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'railway-sign-admin-bootstrap-'))
const demoPassword = 'LegacyDemoSeed@Pass2026'
const adminPassword = 'ProdAdminBootstrap@2026'
let child
let childOutput = ''

const freePort = async () => {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

const startApi = async (env) => {
  const port = await freePort()
  const api = spawn(process.execPath, ['server/api-server.js'], {
    cwd: root,
    env: { ...process.env, ...env, API_HOST: '127.0.0.1', API_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  childOutput = ''
  api.stdout.setEncoding('utf8').on('data', (chunk) => { childOutput = (childOutput + chunk).slice(-6000) })
  api.stderr.setEncoding('utf8').on('data', (chunk) => { childOutput = (childOutput + chunk).slice(-6000) })
  const base = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (api.exitCode !== null) throw new Error(`API exited during startup:\n${childOutput}`)
    try {
      if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(400) })).ok) return { api, base }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75))
  }
  api.kill()
  throw new Error(`API did not become ready:\n${childOutput}`)
}

const stopApi = async (api) => {
  if (!api || api.exitCode !== null) return
  const exited = once(api, 'exit')
  api.kill()
  await exited
}

const runBootstrap = (env) => spawnSync(process.execPath, ['scripts/bootstrap-admin.mjs'], {
  cwd: root,
  env: { ...process.env, ...env },
  encoding: 'utf8',
  timeout: 30000,
})

const baseEnv = {
  API_DATA_DIR: tempDir,
  API_DB_FILE: path.join(tempDir, 'bootstrap-test.sqlite'),
  API_JWT_SECRET: 'test-only-admin-bootstrap-jwt-secret',
  API_INGEST_URL: '',
}

try {
  const legacy = await startApi({
    ...baseEnv,
    NODE_ENV: 'test',
    API_ENABLE_DEMO_SEED: '1',
    API_DEMO_PASSWORD: demoPassword,
  })
  await stopApi(legacy.api)

  const database = new DatabaseSync(baseEnv.API_DB_FILE)
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM users').get().total, 51)
  database.close()

  const bootstrap = runBootstrap({
    ...baseEnv,
    NODE_ENV: 'production',
    API_BOOTSTRAP_ADMIN_PASSWORD: adminPassword,
  })
  assert.equal(bootstrap.status, 0, bootstrap.stderr || bootstrap.stdout)
  assert.ok(!bootstrap.stdout.includes(adminPassword), 'bootstrap must not print the password')

  const verified = new DatabaseSync(baseEnv.API_DB_FILE)
  const accounts = verified.prepare('SELECT username, password_hash, salt, role, status, remark FROM users').all()
  const admin = accounts.find((user) => user.username === 'admin')
  assert.equal(admin.role, 'admin')
  assert.equal(admin.status, 'active')
  assert.equal(admin.remark, '生产管理员（安全引导）')
  assert.equal(await verifyPassword(adminPassword, admin.password_hash, admin.salt), true)
  assert.equal(accounts.filter((user) => user.username !== 'admin' && user.status === 'active').length, 0)
  verified.close()

  const production = await startApi({
    ...baseEnv,
    NODE_ENV: 'production',
    API_ENABLE_DEMO_SEED: '1',
    API_DEMO_PASSWORD: demoPassword,
  })
  child = production.api

  const captcha = await fetch(`${production.base}/api/auth/captcha`).then((response) => response.json())
  const code = [...captcha.data.svg.matchAll(/>([A-Z0-9])<\/text>/g)].map((match) => match[1]).join('')
  const login = await fetch(`${production.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: adminPassword, captchaId: captcha.data.id, captchaCode: code }),
  })
  assert.equal(login.status, 200)

  const secondCaptcha = await fetch(`${production.base}/api/auth/captcha`).then((response) => response.json())
  const secondCode = [...secondCaptcha.data.svg.matchAll(/>([A-Z0-9])<\/text>/g)].map((match) => match[1]).join('')
  const demoLogin = await fetch(`${production.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'operator', password: demoPassword, captchaId: secondCaptcha.data.id, captchaCode: secondCode }),
  })
  assert.equal(demoLogin.status, 401)
  await stopApi(child)
  child = null

  const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'railway-sign-admin-required-'))
  const freshPort = await freePort()
  const fresh = spawn(process.execPath, ['server/api-server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      API_DATA_DIR: freshDir,
      API_JWT_SECRET: 'test-only-empty-admin-jwt-secret',
      API_HOST: '127.0.0.1',
      API_PORT: String(freshPort),
      API_INGEST_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let freshOutput = ''
  fresh.stdout.setEncoding('utf8').on('data', (chunk) => { freshOutput += chunk })
  fresh.stderr.setEncoding('utf8').on('data', (chunk) => { freshOutput += chunk })
  const [exitCode] = await once(fresh, 'exit')
  assert.equal(exitCode, 1)
  assert.match(freshOutput, /npm run admin:bootstrap/)
  const freshDatabase = new DatabaseSync(path.join(freshDir, 'railway_sign.db'))
  assert.equal(freshDatabase.prepare('SELECT COUNT(*) AS total FROM users').get().total, 0)
  freshDatabase.close()

  const weakDir = await fs.mkdtemp(path.join(os.tmpdir(), 'railway-sign-admin-weak-password-'))
  const weakBootstrap = runBootstrap({
    NODE_ENV: 'production',
    API_DATA_DIR: weakDir,
    API_BOOTSTRAP_ADMIN_PASSWORD: 'weak-password',
  })
  assert.notEqual(weakBootstrap.status, 0)
  await assert.rejects(fs.access(path.join(weakDir, 'railway_sign.db')))

  console.log('Production admin bootstrap tests passed: no default users, seeded-account rotation, and login checks.')
} finally {
  await stopApi(child)
}
