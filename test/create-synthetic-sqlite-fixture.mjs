import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'

const outputPath = process.argv[2]
if (!outputPath) throw new Error('Usage: node test/create-synthetic-sqlite-fixture.mjs <output.sqlite>')
const sourceDatabase = process.env.PGDATABASE || ''
if (!/_test$/i.test(sourceDatabase)) throw new Error('Fixture source must be an isolated PostgreSQL _test database.')

const pool = new pg.Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: sourceDatabase,
  user: process.env.PGUSER || 'railway_sign_app',
  password: process.env.PGPASSWORD,
})
const sqlite = new DatabaseSync(outputPath)
const tables = [
  'roles', 'users', 'signals', 'alarms', 'work_orders', 'telemetry_records',
  'ai_sessions', 'ai_messages', 'ai_models', 'login_logs', 'op_logs',
  'password_resets', 'system_configs',
]

const sqliteType = (type, name) => name === 'id' ? 'INTEGER' : ({
  'smallint': 'INTEGER', 'integer': 'INTEGER', 'bigint': 'INTEGER',
  'double precision': 'REAL', 'boolean': 'INTEGER',
}[type] || 'TEXT')

try {
  for (const table of tables) {
    const { rows: columns } = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [table]
    )
    const definitions = columns.map(({ column_name, data_type }) =>
      `"${column_name}" ${sqliteType(data_type, column_name)}${column_name === 'id' ? ' PRIMARY KEY' : ''}`
    )
    sqlite.exec(`CREATE TABLE "${table}" (${definitions.join(', ')})`)
    if (['roles', 'ai_models', 'system_configs'].includes(table)) {
      const { rows } = await pool.query(`SELECT * FROM "${table}" ORDER BY ${table === 'system_configs' ? 'key' : 'id'}`)
      if (!rows.length) throw new Error(`Reference data missing from source test DB: ${table}`)
      const names = columns.map(({ column_name }) => column_name)
      const insert = sqlite.prepare(`INSERT INTO "${table}" (${names.map((name) => `"${name}"`).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
      for (const row of rows) insert.run(...names.map((name) => {
        const value = row[name]
        if (value instanceof Date) return value.toISOString()
        if (value && typeof value === 'object') return JSON.stringify(value)
        return value ?? null
      }))
    }
  }

  const now = new Date().toISOString()
  sqlite.prepare(`INSERT INTO users (
    id, username, password_hash, salt, name, phone, email, role, status, avatar, remark,
    login_count, last_login_at, last_login_ip, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    90001, 'import_fixture', 'not-loginable-fixture', 'fixture-salt', 'Synthetic Import Fixture', '',
    'fixture@example.invalid', 'user', 'disabled', '', 'synthetic importer fixture', 0, null, '', now, now
  )
} finally {
  sqlite.close()
  await pool.end()
}
