import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'railway-sign-db-maintenance-'))
const source = path.join(tempDir, 'source.sqlite')
const backup = path.join(tempDir, 'backups', 'source.snapshot.sqlite')
const target = path.join(tempDir, 'restored.sqlite')
const script = path.join(root, 'scripts', 'db-maintenance.mjs')

const createDatabase = (file, values) => {
  const database = new DatabaseSync(file)
  database.exec('PRAGMA journal_mode = WAL; CREATE TABLE records (value TEXT NOT NULL)')
  const insert = database.prepare('INSERT INTO records (value) VALUES (?)')
  for (const value of values) insert.run(value)
  return database
}

const run = (...args) => spawnSync(process.execPath, [script, ...args], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, API_DB_FILE: source },
})

const readValues = (file) => {
  const database = new DatabaseSync(file, { readOnly: true })
  try {
    assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
    return database.prepare('SELECT value FROM records ORDER BY rowid').all().map((row) => row.value)
  } finally {
    database.close()
  }
}

try {
  const sourceDb = createDatabase(source, ['committed-in-wal'])
  const backupResult = run('backup', '--destination', backup)
  assert.equal(backupResult.status, 0, backupResult.stderr)
  assert.deepEqual(readValues(backup), ['committed-in-wal'], 'backup includes committed WAL data')
  console.log('ok   VACUUM INTO creates and validates a consistent backup')

  sourceDb.prepare('INSERT INTO records (value) VALUES (?)').run('after-backup')
  sourceDb.close()
  assert.deepEqual(readValues(backup), ['committed-in-wal'], 'backup remains an immutable point-in-time snapshot')
  const overwriteResult = run('backup', '--destination', backup)
  assert.notEqual(overwriteResult.status, 0, 'backup must refuse to overwrite an existing file')
  assert.deepEqual(readValues(backup), ['committed-in-wal'])
  console.log('ok   backup is immutable and refuses to overwrite an existing file')

  const targetDb = createDatabase(target, ['old-target-data'])
  targetDb.close()
  const deniedRestore = run('restore', '--source', backup, '--target', target)
  assert.notEqual(deniedRestore.status, 0, 'restore must refuse replacement without explicit confirmation')
  assert.deepEqual(readValues(target), ['old-target-data'], 'refused restore leaves target untouched')
  console.log('ok   restore refuses to replace a database without --replace')

  const restoreResult = run('restore', '--source', backup, '--target', target, '--replace')
  assert.equal(restoreResult.status, 0, restoreResult.stderr)
  const restored = JSON.parse(restoreResult.stdout)
  assert.deepEqual(readValues(target), ['committed-in-wal'])
  assert.ok(restored.previous && fs.existsSync(restored.previous), 'restore retains the previous target as a rollback file')
  assert.deepEqual(readValues(restored.previous), ['old-target-data'])
  console.log('ok   confirmed restore replaces the target and retains a verified rollback copy')
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
}
