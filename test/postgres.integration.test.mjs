import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { all, closeDatabase, get, initDatabase, pageQuery, run, tx } from '../server/api/lib/postgres.js'

const database = process.env.PGDATABASE || ''
if (!/_test$/i.test(database)) throw new Error('PostgreSQL integration tests require PGDATABASE ending in _test.')

test('migrations are repeatable without changing the applied migration ledger', async () => {
  await initDatabase()
  const before = await all('SELECT version, checksum FROM schema_migrations ORDER BY version')
  await initDatabase()
  const after = await all('SELECT version, checksum FROM schema_migrations ORDER BY version')
  assert.deepEqual(after, before)
  assert.equal(after.length, 3)
})

test('transactions roll back related writes and PostgreSQL enforces unique and cascade constraints', async () => {
  const username = `tx_${randomUUID().replaceAll('-', '').slice(0, 20)}`
  const now = new Date().toISOString()
  const rollbackMarker = new Error('expected rollback')

  await assert.rejects(tx(async () => {
    const user = await run(
      `INSERT INTO users (username, password_hash, salt, name, role, status, created_at, updated_at)
       VALUES (:username, 'fixture', 'fixture', 'Fixture', 'user', 'active', :now, :now)`,
      { username, now }
    )
    const session = await run(
      `INSERT INTO ai_sessions (user_id, username, title, created_at, updated_at)
       VALUES (:user_id, :username, 'fixture session', :now, :now)`,
      { user_id: user.lastInsertRowid, username, now }
    )
    await run(
      `INSERT INTO ai_messages (session_id, role, content, created_at)
       VALUES (:session_id, 'user', 'fixture message', :now)`,
      { session_id: session.lastInsertRowid, now }
    )
    await run('DELETE FROM ai_sessions WHERE id = :id', { id: session.lastInsertRowid })
    assert.equal(Number((await get('SELECT COUNT(*) AS total FROM ai_messages WHERE session_id = :id', { id: session.lastInsertRowid })).total), 0)
    throw rollbackMarker
  }), (error) => error === rollbackMarker)

  assert.equal(await get('SELECT id FROM users WHERE username = :username', { username }), undefined)

  const duplicateCode = (await get('SELECT code FROM signals ORDER BY id LIMIT 1'))?.code
  assert.ok(duplicateCode, 'integration test requires seeded signal fixtures')
  await assert.rejects(run(
    `INSERT INTO signals (code, name, created_at, updated_at) VALUES (:code, 'duplicate fixture', :now, :now)`,
    { code: duplicateCode, now }
  ), (error) => error.code === '23505')
})

test('bounded pagination returns stable disjoint pages', async () => {
  const first = await pageQuery({
    select: 'id', from: 'FROM signals', orderBy: 'id DESC', page: 1, pageSize: 10,
  })
  const lastPage = await pageQuery({
    select: 'id', from: 'FROM signals', orderBy: 'id DESC', page: first.totalPages, pageSize: 10,
  })
  assert.ok(first.pageSize <= 10)
  assert.ok(first.list.length > 0)
  assert.ok(lastPage.list.length > 0)
  assert.equal(new Set([...first.list, ...lastPage.list].map((row) => row.id)).size, first.list.length + lastPage.list.length)
  const capped = await pageQuery({ select: 'id', from: 'FROM signals', page: 1, pageSize: 1000 })
  assert.equal(capped.pageSize, 200)
})

test.after(async () => closeDatabase())
