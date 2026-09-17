// 统一的路径解析：数据目录固定落在项目根目录下的 .data/（已 gitignore）。
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT_DIR = fileURLToPath(new URL('../../../', import.meta.url))

export const DATA_DIR = process.env.API_DATA_DIR || path.join(ROOT_DIR, '.data')

export const DB_FILE = process.env.API_DB_FILE || path.join(DATA_DIR, 'railway_sign.db')

export default { ROOT_DIR, DATA_DIR, DB_FILE }
