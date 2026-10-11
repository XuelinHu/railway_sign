import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { DATABASE_NAME } from '../server/api/lib/paths.js'

const { Pool } = pg
const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'railway_sign_app',
  password: process.env.PGPASSWORD || '',
  database: DATABASE_NAME,
})

try {
  const sql = await readFile(fileURLToPath(new URL('../server/api/postgres/migrations/004_oidc_identity.sql', import.meta.url)), 'utf8')
  const checksum = createHash('sha256').update(sql).digest('hex')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('railway_sign:migrations:' || current_database(), 0))")
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    const existing = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', ['004_oidc_identity'])
    if (existing.rowCount && existing.rows[0].checksum !== checksum) throw new Error('Migration checksum changed: 004_oidc_identity')
    if (!existing.rowCount) {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', ['004_oidc_identity', checksum])
    }
    await client.query('COMMIT')
    console.log(`OIDC identity schema is current: ${DATABASE_NAME}`)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
} finally {
  await pool.end()
}
