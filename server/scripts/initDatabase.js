const { pool, query } = require('../db')

// 创建数据表
const createTables = async () => {
  console.log('开始创建数据表...')

  // 1. 信号灯表
  await query(`
    CREATE TABLE IF NOT EXISTS signal_lights (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      longitude DECIMAL(10, 6) NOT NULL,
      latitude DECIMAL(10, 6) NOT NULL,
      altitude DECIMAL(10, 2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'normal',
      temperature DECIMAL(5, 2) DEFAULT 35,
      humidity DECIMAL(5, 2) DEFAULT 65,
      light_intensity DECIMAL(10, 2) DEFAULT 850,
      voltage DECIMAL(6, 2) DEFAULT 220,
      current DECIMAL(5, 2) DEFAULT 2.5,
      signal_strength DECIMAL(5, 2) DEFAULT -45,
      event_type VARCHAR(50),
      event_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ signal_lights 表创建成功')

  // 2. 地震监测数据表
  await query(`
    CREATE TABLE IF NOT EXISTS seismic_data (
      id SERIAL PRIMARY KEY,
      level DECIMAL(4, 2) NOT NULL,
      recorded_at TIMESTAMP NOT NULL,
      location VARCHAR(100) DEFAULT '柳州',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ seismic_data 表创建成功')

  // 3. 天气数据表
  await query(`
    CREATE TABLE IF NOT EXISTS weather_data (
      id SERIAL PRIMARY KEY,
      temperature DECIMAL(5, 2) NOT NULL,
      humidity DECIMAL(5, 2),
      wind_speed VARCHAR(20),
      visibility VARCHAR(20),
      pressure VARCHAR(20),
      description VARCHAR(50),
      icon VARCHAR(10),
      location VARCHAR(100) DEFAULT '柳州市',
      recorded_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ weather_data 表创建成功')

  // 4. 空气质量表
  await query(`
    CREATE TABLE IF NOT EXISTS air_quality (
      id SERIAL PRIMARY KEY,
      aqi INTEGER NOT NULL,
      level VARCHAR(20),
      pm25 DECIMAL(8, 2),
      pm10 DECIMAL(8, 2),
      o3 DECIMAL(8, 2),
      no2 DECIMAL(8, 2),
      recorded_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ air_quality 表创建成功')

  // 5. 列车统计表
  await query(`
    CREATE TABLE IF NOT EXISTS train_stats (
      id SERIAL PRIMARY KEY,
      stat_date DATE NOT NULL,
      passed_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      on_time_rate DECIMAL(5, 2) DEFAULT 0,
      next_train VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(stat_date)
    )
  `)
  console.log('✅ train_stats 表创建成功')

  // 6. 铁道信息表
  await query(`
    CREATE TABLE IF NOT EXISTS railway_info (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      start_station VARCHAR(100),
      end_station VARCHAR(100),
      length_km DECIMAL(10, 2),
      status VARCHAR(20) DEFAULT '正常',
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ railway_info 表创建成功')

  // 7. 参数历史数据表
  await query(`
    CREATE TABLE IF NOT EXISTS param_history (
      id SERIAL PRIMARY KEY,
      signal_id INTEGER REFERENCES signal_lights(id),
      param_type VARCHAR(30) NOT NULL,
      param_value DECIMAL(10, 2) NOT NULL,
      recorded_at TIMESTAMP NOT NULL,
      time_range VARCHAR(20) DEFAULT '24h',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ param_history 表创建成功')

  // 8. AI对话记录表
  await query(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(100),
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ ai_conversations 表创建成功')

  // 9. 系统日志表
  await query(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY,
      log_type VARCHAR(30) NOT NULL,
      log_level VARCHAR(20) DEFAULT 'info',
      message TEXT,
      details JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ system_logs 表创建成功')
}

// 插入Mock数据
const insertMockData = async () => {
  console.log('开始插入Mock数据...')

  // 检查是否已有数据
  const checkSignal = await query('SELECT COUNT(*) FROM signal_lights')
  if (parseInt(checkSignal.rows[0].count) > 0) {
    console.log('⚠️ 数据库已有数据，跳过Mock数据插入')
    return
  }

  // 1. 插入信号灯数据
  const signalLights = [
    { name: '主信号灯', lon: 109.3887, lat: 24.3076, status: 'normal', event_type: '设备正常', event_message: '信号灯运行正常，所有参数在范围内' },
    { name: '信号灯A', lon: 109.3920, lat: 24.3100, status: 'warning', event_type: '温度异常', event_message: '温度超过阈值，当前45°C，请检查设备' },
    { name: '信号灯B', lon: 109.3850, lat: 24.3050, status: 'maintenance', event_type: '维护中', event_message: '设备正在维护，预计2小时后恢复' },
    { name: '信号灯C', lon: 109.3900, lat: 24.3020, status: 'offline', event_type: '离线', event_message: '设备离线，最后检查时间：10分钟前' },
    { name: '信号灯D', lon: 109.3950, lat: 24.3080, status: 'normal', event_type: '设备正常', event_message: '信号灯运行正常' },
    { name: '信号灯E', lon: 109.3820, lat: 24.3110, status: 'warning', event_type: '电压异常', event_message: '电压异常，当前235V，需要检查线路' }
  ]

  for (const signal of signalLights) {
    await query(`
      INSERT INTO signal_lights (name, longitude, latitude, altitude, status, temperature, humidity, light_intensity, voltage, current, signal_strength, event_type, event_message)
      VALUES ($1, $2, $3, 50, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      signal.name, signal.lon, signal.lat, signal.status,
      30 + Math.random() * 20, // temperature
      50 + Math.random() * 30, // humidity
      500 + Math.random() * 1000, // light_intensity
      210 + Math.random() * 20, // voltage
      1.5 + Math.random() * 2, // current
      -70 + Math.random() * 40, // signal_strength
      signal.event_type, signal.event_message
    ])
  }
  console.log('✅ 信号灯Mock数据插入成功')

  // 2. 插入地震监测数据（过去30天每小时一条）
  const now = new Date()
  for (let i = 0; i < 720; i++) {
    const recordedAt = new Date(now.getTime() - i * 60 * 60 * 1000)
    const level = 1.5 + Math.random() * 3
    await query(`
      INSERT INTO seismic_data (level, recorded_at, location)
      VALUES ($1, $2, $3)
    `, [level.toFixed(2), recordedAt.toISOString(), '柳州'])
  }
  console.log('✅ 地震监测Mock数据插入成功 (720条)')

  // 3. 插入天气数据（过去30天每小时一条）
  for (let i = 0; i < 720; i++) {
    const recordedAt = new Date(now.getTime() - i * 60 * 60 * 1000)
    const hour = recordedAt.getHours()
    let temp = 20 + Math.sin((hour - 6) * Math.PI / 12) * 10 + Math.random() * 3
    await query(`
      INSERT INTO weather_data (temperature, humidity, wind_speed, visibility, pressure, description, icon, location, recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      temp.toFixed(1),
      (60 + Math.random() * 25).toFixed(0) + '%',
      (2 + Math.random() * 4).toFixed(1) + 'm/s',
      (10 + Math.random() * 10).toFixed(0) + 'km',
      (1010 + Math.random() * 10).toFixed(0) + 'hPa',
      temp > 28 ? '晴' : temp > 22 ? '多云' : '阴',
      temp > 28 ? '☀️' : temp > 22 ? '⛅' : '☁️',
      '柳州市',
      recordedAt.toISOString()
    ])
  }
  console.log('✅ 天气Mock数据插入成功 (720条)')

  // 4. 插入空气质量数据
  for (let i = 0; i < 720; i++) {
    const recordedAt = new Date(now.getTime() - i * 60 * 60 * 1000)
    const aqi = Math.floor(20 + Math.random() * 80)
    let level = '优'
    if (aqi > 100) level = '轻度污染'
    else if (aqi > 50) level = '良'

    await query(`
      INSERT INTO air_quality (aqi, level, pm25, pm10, o3, no2, recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      aqi, level,
      (10 + Math.random() * 40).toFixed(1),
      (20 + Math.random() * 50).toFixed(1),
      (40 + Math.random() * 50).toFixed(1),
      (20 + Math.random() * 30).toFixed(1),
      recordedAt.toISOString()
    ])
  }
  console.log('✅ 空气质量Mock数据插入成功 (720条)')

  // 5. 插入列车统计数据
  for (let i = 0; i < 30; i++) {
    const statDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    statDate.setHours(0, 0, 0, 0)
    await query(`
      INSERT INTO train_stats (stat_date, passed_count, total_count, on_time_rate, next_train)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      statDate.toISOString().split('T')[0],
      Math.floor(40 + Math.random() * 20),
      58,
      (95 + Math.random() * 5).toFixed(1),
      'G1502 14:35'
    ])
  }
  console.log('✅ 列车统计Mock数据插入成功 (30条)')

  // 6. 插入铁道信息
  await query(`
    INSERT INTO railway_info (name, start_station, end_station, length_km, status, description)
    VALUES
      ('湘桂铁路', '柳州站', '南宁站', 255, '正常', '湘桂铁路是连接湖南和广西的重要铁路干线'),
      ('黔桂铁路', '贵阳站', '柳州站', 488, '正常', '黔桂铁路连接贵州和广西'),
      ('焦柳铁路', '焦作站', '柳州站', 1642, '正常', '焦柳铁路是南北向重要干线')
  `)
  console.log('✅ 铁道信息Mock数据插入成功')

  // 7. 插入参数历史数据
  const signalResult = await query('SELECT id FROM signal_lights LIMIT 1')
  const signalId = signalResult.rows[0]?.id || 1

  const paramTypes = ['temperature', 'humidity', 'light', 'voltage', 'current', 'signal']
  for (const paramType of paramTypes) {
    for (let i = 0; i < 168; i++) { // 7天的小时数据
      const recordedAt = new Date(now.getTime() - i * 60 * 60 * 1000)
      let value
      switch (paramType) {
        case 'temperature': value = 25 + Math.random() * 20; break
        case 'humidity': value = 50 + Math.random() * 40; break
        case 'light': value = 500 + Math.random() * 1500; break
        case 'voltage': value = 210 + Math.random() * 20; break
        case 'current': value = 1.5 + Math.random() * 2; break
        case 'signal': value = -70 + Math.random() * 40; break
        default: value = 50
      }
      await query(`
        INSERT INTO param_history (signal_id, param_type, param_value, recorded_at, time_range)
        VALUES ($1, $2, $3, $4, '24h')
      `, [signalId, paramType, value.toFixed(2), recordedAt.toISOString()])
    }
  }
  console.log('✅ 参数历史Mock数据插入成功')

  console.log('🎉 所有Mock数据插入完成!')
}

// 主函数
const initDatabase = async () => {
  try {
    console.log('========================================')
    console.log('开始初始化数据库...')
    console.log('========================================')

    await createTables()
    await insertMockData()

    console.log('========================================')
    console.log('✅ 数据库初始化完成!')
    console.log('========================================')
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
  } finally {
    await pool.end()
  }
}

initDatabase()
