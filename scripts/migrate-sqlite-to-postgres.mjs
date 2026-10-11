import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { all, closeDatabase, exec, get, initDatabase, run, tx } from '../server/api/lib/postgres.js'
import { DB_FILE } from '../server/api/lib/paths.js'

const tables = [
  'roles', 'users', 'signals', 'alarms', 'work_orders', 'telemetry_records',
  'ai_sessions', 'ai_messages', 'ai_models', 'login_logs', 'op_logs',
  'password_resets', 'system_configs',
]
const businessTables = [
  'users', 'signals', 'alarms', 'work_orders', 'telemetry_records',
  'ai_sessions', 'ai_messages', 'login_logs', 'op_logs', 'password_resets',
]
const pgDatabase = process.env.PGDATABASE || ''
const sourcePath = process.argv.includes('--source')
  ? process.argv[process.argv.indexOf('--source') + 1]
  : process.env.API_SQLITE_SOURCE || DB_FILE

if (!/(?:_test)$/i.test(pgDatabase)) throw new Error('SQLite import is restricted to a PGDATABASE ending in _test.')
if (!sourcePath || sourcePath.startsWith('--')) throw new Error('Provide a SQLite source file with --source <path>.')
const resolvedSource = fs.realpathSync(sourcePath)
const sourceStat = fs.statSync(resolvedSource)
if (!sourceStat.isFile()) throw new Error('SQLite source must be a regular file.')

const sqlite = new DatabaseSync(resolvedSource, { readOnly: true, timeout: 5000 })
try {
  const integrity = sqlite.prepare('PRAGMA integrity_check').get()
  if (Object.values(integrity || {})[0] !== 'ok') throw new Error('SQLite integrity_check failed.')
  const names = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name))
  for (const table of tables) if (!names.has(table)) throw new Error(`SQLite source is missing table ${table}.`)
  sqlite.exec('BEGIN')

  try {
    await initDatabase()
    const businessCounts = {}
    for (const table of businessTables) {
      const row = await get(`SELECT COUNT(*) AS total FROM ${table}`)
      businessCounts[table] = Number(row.total)
      if (businessCounts[table] !== 0) throw new Error(`Refusing import: target table ${table} is not empty.`)
    }

    const sourceRows = new Map()
    for (const table of tables) sourceRows.set(table, sqlite.prepare(`SELECT * FROM ${table}`).all())
    const sourceCounts = Object.fromEntries([...sourceRows].map(([table, rows]) => [table, rows.length]))

    await tx(async () => {
      for (const table of tables) {
        const rows = sourceRows.get(table)
        if (!rows.length) continue
        const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name)
        const quotedColumns = columns.map((column) => `"${column}"`).join(', ')
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
        const conflictKey = columns.includes('id') ? 'id' : 'key'
        const updateColumns = columns.filter((column) => column !== conflictKey)
        const conflictUpdate = updateColumns.length
          ? `("${conflictKey}") DO UPDATE SET ${updateColumns.map((column) => `"${column}" = EXCLUDED."${column}"`).join(', ')}`
          : `("${conflictKey}") DO NOTHING`
        const insert = `INSERT INTO "${table}" (${quotedColumns}) OVERRIDING SYSTEM VALUE VALUES (${placeholders}) ON CONFLICT ${conflictUpdate}`
        for (const sourceRow of rows) {
          const values = columns.map((column) => {
            const value = sourceRow[column]
            if (table === 'roles' && column === 'permissions' && typeof value === 'string') return JSON.stringify(JSON.parse(value))
            return value
          })
          await run(insert, values)
        }
      }

      for (const table of tables) {
        if (!sqlite.prepare(`PRAGMA table_info(${table})`).all().some((column) => column.name === 'id')) continue
        await exec(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), GREATEST(COALESCE(MAX(id), 1), 1), COUNT(*) > 0) FROM "${table}"`,
          [`public.${table}`]
        )
      }

      for (const table of tables) {
        const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name)
        const key = columns.includes('id') ? 'id' : 'key'
        const imported = await all(`SELECT * FROM "${table}" ORDER BY "${key}"`)
        const normalize = (row) => Object.fromEntries(columns.map((column) => {
          let value = row[column]
          if (column.endsWith('_at') && value !== null && value !== undefined) value = new Date(value).toISOString()
          if (table === 'roles' && column === 'permissions' && typeof value === 'string') value = JSON.parse(value)
          return [column, value]
        }))
        assert.deepEqual(imported.map(normalize), sourceRows.get(table).map(normalize), `Content verification failed for ${table}.`)
      }
    })

    sqlite.exec('COMMIT')
    console.log(`SQLite import verified in isolated database ${pgDatabase}: ${JSON.stringify(sourceCounts)}`)
  } catch (error) {
    sqlite.exec('ROLLBACK')
    throw error
  }
} finally {
  sqlite.close()
  await closeDatabase()
}
