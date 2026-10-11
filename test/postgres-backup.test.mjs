import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  assertSafeRestoreTarget,
  decryptArchiveFile,
  encryptArchiveFile,
  parseBackupKey,
} from '../scripts/db-maintenance.mjs'
import { bindParameters } from '../server/api/lib/postgres.js'

const key = Buffer.alloc(32, 29)

test('backup key must be exactly 32 bytes of hexadecimal material', () => {
  assert.equal(parseBackupKey(key.toString('hex')).length, 32)
  assert.throws(() => parseBackupKey('short'), /64 hexadecimal/)
  assert.throws(() => parseBackupKey('z'.repeat(64)), /64 hexadecimal/)
})

test('SQL adapter preserves validated PostgreSQL positional parameters', () => {
  assert.deepEqual(bindParameters('INSERT INTO users (id, username) VALUES ($1, $2)', [7, 'fixture']), {
    text: 'INSERT INTO users (id, username) VALUES ($1, $2)', values: [7, 'fixture'],
  })
  assert.throws(() => bindParameters('SELECT $1, $2', ['only-one']), /parameter count/)
})

test('restore is restricted to a different _test database and explicit replacement', () => {
  const sourceDatabase = 'railway_sign'
  assert.doesNotThrow(() => assertSafeRestoreTarget({ sourceDatabase, targetDatabase: 'railway_sign_restore_test', replace: true }))
  assert.throws(() => assertSafeRestoreTarget({ sourceDatabase, targetDatabase: sourceDatabase, replace: true }), /differ/)
  assert.throws(() => assertSafeRestoreTarget({ sourceDatabase, targetDatabase: 'railway_sign_restore', replace: true }), /end in _test/)
  assert.throws(() => assertSafeRestoreTarget({ sourceDatabase, targetDatabase: 'railway_sign_restore_test', replace: false }), /explicit --replace/)
})

test('encrypted PostgreSQL archive authenticates contents and refuses overwrite', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'railway-sign-pg-backup-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const source = path.join(directory, 'source.dump')
  const archive = path.join(directory, 'snapshot.pgbak')
  const payload = Buffer.from('synthetic custom archive payload')
  const metadata = { format: 1, project: 'railway_sign', database: 'railway_sign_test', createdAt: new Date(0).toISOString() }
  await writeFile(source, payload)

  await encryptArchiveFile(source, archive, metadata, key)
  await assert.rejects(encryptArchiveFile(source, archive, metadata, key), { code: 'EEXIST' })
  const result = await decryptArchiveFile(archive, directory, key)
  try {
    assert.equal(result.metadata.database, metadata.database)
    assert.deepEqual(await readFile(result.archivePath), payload)
  } finally {
    await rm(result.directory, { recursive: true, force: true })
  }

  const contents = await readFile(archive)
  contents[contents.length - 1] ^= 0x01
  await writeFile(archive, contents)
  await assert.rejects(decryptArchiveFile(archive, directory, key), /authentication failed/i)
})

test('archive metadata cannot be reused for another project', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'railway-sign-pg-project-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const source = path.join(directory, 'source.dump')
  const archive = path.join(directory, 'snapshot.pgbak')
  await writeFile(source, 'synthetic archive')
  await encryptArchiveFile(source, archive, {
    format: 1, project: 'another-project', database: 'source_test',
  }, key)
  await assert.rejects(decryptArchiveFile(archive, directory, key), /another project/i)
})
