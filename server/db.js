const { Pool } = require('pg')
require('dotenv').config()

// 数据库连接池配置
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

// 测试数据库连接
pool.on('connect', () => {
  console.log('✅ PostgreSQL 数据库连接成功')
})

pool.on('error', (err) => {
  console.error('❌ PostgreSQL 数据库连接错误:', err)
})

// 查询函数
const query = async (text, params) => {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  console.log('执行SQL:', text.substring(0, 100), `耗时: ${duration}ms`)
  return res
}

// 获取客户端（用于事务）
const getClient = async () => {
  const client = await pool.connect()
  return client
}

module.exports = {
  pool,
  query,
  getClient
}
