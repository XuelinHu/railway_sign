import { closeDatabase, initDatabase } from '../server/api/lib/postgres.js'

try {
  const result = await initDatabase()
  console.log(`PostgreSQL schema is current: ${result.database}`)
} finally {
  await closeDatabase()
}
