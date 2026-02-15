const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')
require('dotenv').config()

const { query, pool } = require('./db')

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// 静态文件服务 - 前端构建文件
app.use(express.static(path.join(__dirname, '../dist')))

// 静态文件服务 - 后台管理页面
app.use('/admin', express.static(path.join(__dirname, 'public/admin')))

// ==================== API 路由 ====================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ==================== 信号灯 API ====================

// 获取所有信号灯
app.get('/api/signals', async (req, res) => {
  try {
    const result = await query('SELECT * FROM signal_lights ORDER BY id')
    res.json({ success: true, data: result.rows })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取单个信号灯
app.get('/api/signals/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM signal_lights WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '信号灯不存在' })
    }
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 创建信号灯
app.post('/api/signals', async (req, res) => {
  try {
    const { name, longitude, latitude, altitude, status, temperature, humidity, light_intensity, voltage, current, signal_strength, event_type, event_message } = req.body
    const result = await query(`
      INSERT INTO signal_lights (name, longitude, latitude, altitude, status, temperature, humidity, light_intensity, voltage, current, signal_strength, event_type, event_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [name, longitude, latitude, altitude || 0, status || 'normal', temperature || 35, humidity || 65, light_intensity || 850, voltage || 220, current || 2.5, signal_strength || -45, event_type, event_message])
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 更新信号灯
app.put('/api/signals/:id', async (req, res) => {
  try {
    const { name, longitude, latitude, altitude, status, temperature, humidity, light_intensity, voltage, current, signal_strength, event_type, event_message } = req.body
    const result = await query(`
      UPDATE signal_lights
      SET name = COALESCE($1, name),
          longitude = COALESCE($2, longitude),
          latitude = COALESCE($3, latitude),
          altitude = COALESCE($4, altitude),
          status = COALESCE($5, status),
          temperature = COALESCE($6, temperature),
          humidity = COALESCE($7, humidity),
          light_intensity = COALESCE($8, light_intensity),
          voltage = COALESCE($9, voltage),
          current = COALESCE($10, current),
          signal_strength = COALESCE($11, signal_strength),
          event_type = COALESCE($12, event_type),
          event_message = COALESCE($13, event_message),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *
    `, [name, longitude, latitude, altitude, status, temperature, humidity, light_intensity, voltage, current, signal_strength, event_type, event_message, req.params.id])
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '信号灯不存在' })
    }
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 删除信号灯
app.delete('/api/signals/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM signal_lights WHERE id = $1 RETURNING *', [req.params.id])
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '信号灯不存在' })
    }
    res.json({ success: true, message: '删除成功' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 地震数据 API ====================

// 获取地震数据
app.get('/api/seismic', async (req, res) => {
  try {
    const { range = '24h' } = req.query
    let interval = '24 hours'
    if (range === 'week') interval = '7 days'
    if (range === 'month') interval = '30 days'

    const result = await query(`
      SELECT * FROM seismic_data
      WHERE recorded_at >= NOW() - INTERVAL '${interval}'
      ORDER BY recorded_at ASC
    `)
    res.json({ success: true, data: result.rows })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 添加地震数据
app.post('/api/seismic', async (req, res) => {
  try {
    const { level, location } = req.body
    const result = await query(`
      INSERT INTO seismic_data (level, recorded_at, location)
      VALUES ($1, NOW(), $2)
      RETURNING *
    `, [level, location || '柳州'])
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 天气数据 API ====================

// 获取天气数据
app.get('/api/weather', async (req, res) => {
  try {
    const { range = '24h' } = req.query
    let interval = '24 hours'
    if (range === 'week') interval = '7 days'
    if (range === 'month') interval = '30 days'

    const result = await query(`
      SELECT * FROM weather_data
      WHERE recorded_at >= NOW() - INTERVAL '${interval}'
      ORDER BY recorded_at ASC
    `)
    res.json({ success: true, data: result.rows })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取最新天气
app.get('/api/weather/current', async (req, res) => {
  try {
    const result = await query('SELECT * FROM weather_data ORDER BY recorded_at DESC LIMIT 1')
    res.json({ success: true, data: result.rows[0] || null })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 空气质量 API ====================

// 获取空气质量数据
app.get('/api/air-quality', async (req, res) => {
  try {
    const result = await query('SELECT * FROM air_quality ORDER BY recorded_at DESC LIMIT 1')
    res.json({ success: true, data: result.rows[0] || null })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 列车统计 API ====================

// 获取列车统计
app.get('/api/train-stats', async (req, res) => {
  try {
    const result = await query('SELECT * FROM train_stats ORDER BY stat_date DESC LIMIT 1')
    res.json({ success: true, data: result.rows[0] || null })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 更新列车统计
app.put('/api/train-stats', async (req, res) => {
  try {
    const { passed_count, total_count, on_time_rate, next_train } = req.body
    const today = new Date().toISOString().split('T')[0]
    const result = await query(`
      INSERT INTO train_stats (stat_date, passed_count, total_count, on_time_rate, next_train)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (stat_date)
      DO UPDATE SET passed_count = $2, total_count = $3, on_time_rate = $4, next_train = $5
      RETURNING *
    `, [today, passed_count, total_count, on_time_rate, next_train])
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 铁道信息 API ====================

// 获取铁道信息
app.get('/api/railway', async (req, res) => {
  try {
    const result = await query('SELECT * FROM railway_info LIMIT 1')
    res.json({ success: true, data: result.rows[0] || null })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 参数历史 API ====================

// 获取参数历史
app.get('/api/param-history', async (req, res) => {
  try {
    const { type = 'temperature', range = '24h', signal_id = 1 } = req.query
    let interval = '24 hours'
    let timeRange = '24h'
    if (range === 'week') { interval = '7 days'; timeRange = 'week' }
    if (range === 'month') { interval = '30 days'; timeRange = 'month' }
    if (range === '1h') { interval = '1 hour'; timeRange = '1h' }

    const result = await query(`
      SELECT * FROM param_history
      WHERE param_type = $1 AND signal_id = $2
        AND recorded_at >= NOW() - INTERVAL '${interval}'
      ORDER BY recorded_at ASC
    `, [type, signal_id])
    res.json({ success: true, data: result.rows })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== AI对话 API ====================

// 获取对话历史
app.get('/api/ai-conversations', async (req, res) => {
  try {
    const { session_id } = req.query
    let sql = 'SELECT * FROM ai_conversations'
    let params = []
    if (session_id) {
      sql += ' WHERE session_id = $1'
      params.push(session_id)
    }
    sql += ' ORDER BY created_at ASC LIMIT 100'
    const result = await query(sql, params)
    res.json({ success: true, data: result.rows })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 添加对话
app.post('/api/ai-conversations', async (req, res) => {
  try {
    const { session_id, role, content } = req.body
    const result = await query(`
      INSERT INTO ai_conversations (session_id, role, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [session_id, role, content])
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 系统日志 API ====================

// 获取日志
app.get('/api/logs', async (req, res) => {
  try {
    const { type, limit = 100 } = req.query
    let sql = 'SELECT * FROM system_logs'
    let params = []
    if (type) {
      sql += ' WHERE log_type = $1'
      params.push(type)
    }
    sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)}`
    const result = await query(sql, params)
    res.json({ success: true, data: result.rows })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 添加日志
app.post('/api/logs', async (req, res) => {
  try {
    const { log_type, log_level, message, details } = req.body
    const result = await query(`
      INSERT INTO system_logs (log_type, log_level, message, details)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [log_type, log_level || 'info', message, details])
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 仪表盘汇总 API ====================

app.get('/api/dashboard', async (req, res) => {
  try {
    // 并行获取所有数据
    const [signals, seismic, weather, airQuality, trainStats, railway] = await Promise.all([
      query('SELECT * FROM signal_lights'),
      query('SELECT * FROM seismic_data ORDER BY recorded_at DESC LIMIT 24'),
      query('SELECT * FROM weather_data ORDER BY recorded_at DESC LIMIT 1'),
      query('SELECT * FROM air_quality ORDER BY recorded_at DESC LIMIT 1'),
      query('SELECT * FROM train_stats ORDER BY stat_date DESC LIMIT 1'),
      query('SELECT * FROM railway_info LIMIT 1')
    ])

    res.json({
      success: true,
      data: {
        signals: signals.rows,
        seismic: seismic.rows,
        weather: weather.rows[0] || null,
        airQuality: airQuality.rows[0] || null,
        trainStats: trainStats.rows[0] || null,
        railway: railway.rows[0] || null
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 前端路由回退 ====================

// 所有其他请求返回前端应用
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

// ==================== 启动服务器 ====================

app.listen(PORT, () => {
  console.log('========================================')
  console.log(`🚀 服务器启动成功!`)
  console.log(`📡 API地址: http://localhost:${PORT}/api`)
  console.log(`🌐 前端地址: http://localhost:${PORT}`)
  console.log(`⚙️  后台管理: http://localhost:${PORT}/admin`)
  console.log('========================================')
})

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('正在关闭服务器...')
  await pool.end()
  process.exit(0)
})
