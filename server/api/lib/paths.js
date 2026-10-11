// 统一的路径解析：数据目录固定落在项目根目录下的 .data/（已 gitignore）。
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT_DIR = fileURLToPath(new URL('../../../', import.meta.url))

export const DATA_DIR = path.resolve(ROOT_DIR, process.env.API_DATA_DIR || '.data')

export const DB_FILE = process.env.API_DB_FILE || path.join(DATA_DIR, 'railway_sign.db')

export const DATABASE_NAME = process.env.PGDATABASE || 'railway_sign'

if (!/^[a-z][a-z0-9_]{0,62}$/i.test(DATABASE_NAME)) {
  throw new Error('PGDATABASE must be a valid PostgreSQL database identifier.')
}

export default { ROOT_DIR, DATA_DIR, DB_FILE, DATABASE_NAME }
