/**
 * 大数据面板 Mock 数据服务
 * 提供各种传感器、气象、设备监控等模拟数据
 */

import { severeWeatherEnabled, severeWeatherStartedAt } from './simulationState.js'

// 随机数生成工具
const random = (min, max, decimal = 0) => {
  const value = Math.random() * (max - min) + min
  return decimal > 0 ? parseFloat(value.toFixed(decimal)) : Math.floor(value)
}

// 随机选择数组元素
const randomChoice = (arr) => arr[random(0, arr.length)]

// 生成时间序列数据
const generateTimeSeries = (length, min, max, decimal = 1) => {
  return Array.from({ length }, () => random(min, max, decimal))
}

// 气象数据
const risingSeries = (length, start, end, jitter = 0.6, decimal = 1) => {
  if (length <= 1) return [Number(end.toFixed(decimal))]
  return Array.from({ length }, (_, i) => {
    const t = i / (length - 1)
    const base = start + (end - start) * t
    // 增加小幅波动：在整体上升的基础上加入轻微正弦扰动
    const wave = Math.sin(t * Math.PI * 4) * (jitter * 0.55)
    return Math.max(0, Math.min(100, random(base + wave - jitter, base + wave + jitter, decimal)))
  })
}

export const getWeatherData = () => {
  const enabled = Boolean(severeWeatherEnabled.value)

  if (!enabled) {
    return {
      temperature: random(-5, 35, 1),
      humidity: random(15, 30, 1),
      windSpeed: random(0, 25, 1),
      windDirection: randomChoice(['北', '东北', '东', '东南', '南', '西南', '西', '西北']),
      pressure: random(990, 1030, 1),
      visibility: random(1, 30, 1),
      precipitation: random(0, 50, 1),
      uvIndex: random(0, 11),
      airQuality: random(0, 300),
      pm25: random(0, 150),
      pm10: random(0, 200),
      so2: random(0, 50, 2),
      no2: random(0, 100, 2),
      co: random(0, 2, 2),
      o3: random(0, 200, 1),
      weatherType: randomChoice(['晴', '多云', '阴', '小雨', '中雨', '大雨', '雷阵雨', '小雪', '中雪', '大雪', '雾', '霾']),
      temperatureTrend: generateTimeSeries(24, -5, 35, 1),
      humidityTrend: generateTimeSeries(24, 15, 30, 1),
      forecast: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() + i * 86400000).toLocaleDateString('zh-CN', { weekday: 'short' }),
        high: random(15, 35),
        low: random(-5, 20),
        weather: randomChoice(['晴', '多云', '阴', '小雨', '中雨', '雷阵雨'])
      }))
    }
  }

  // 恶劣天气：湿度从约 20% 快速上升到 92%，并触发橙/红告警阈值
  const startedAt = severeWeatherStartedAt.value || Date.now()
  const elapsed = Math.max(0, Date.now() - startedAt)
  const durationMs = 60000 // 约 1 分钟：20 -> 92
  const t = Math.max(0, Math.min(1, elapsed / durationMs))
  const humidity = Number((20 + 72 * t).toFixed(1))

  return {
    temperature: random(12, 28, 1),
    humidity,
    windSpeed: random(10, 25, 1),
    windDirection: randomChoice(['东北', '东', '东南', '北']),
    pressure: random(985, 1008, 1),
    visibility: random(1, 6, 1),
    precipitation: random(20, 50, 1),
    uvIndex: random(0, 3),
    airQuality: random(160, 260),
    pm25: random(110, 180),
    pm10: random(160, 240),
    so2: random(10, 35, 2),
    no2: random(60, 120, 2),
    co: random(0.6, 1.6, 2),
    o3: random(80, 160, 1),
    weatherType: randomChoice(['大雨', '暴雨', '雷阵雨', '霾']),
    temperatureTrend: generateTimeSeries(24, 10, 28, 1),
    humidityTrend: risingSeries(24, 20, 92, 1.2, 1),
    forecast: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() + i * 86400000).toLocaleDateString('zh-CN', { weekday: 'short' }),
      high: random(18, 28),
      low: random(10, 18),
      weather: randomChoice(['中雨', '大雨', '雷阵雨', '阴'])
    }))
  }
}

// 传感器数据
export const getSensorData = () => {
  const sensors = []
  const sensorTypes = [
    { type: '温度传感器', unit: '°C', min: -20, max: 60, icon: 'thermometer' },
    { type: '湿度传感器', unit: '%', min: 0, max: 100, icon: 'droplet' },
    { type: '压力传感器', unit: 'MPa', min: 0, max: 10, decimal: 2, icon: 'gauge' },
    { type: '振动传感器', unit: 'mm/s', min: 0, max: 50, decimal: 2, icon: 'activity' },
    { type: '电流传感器', unit: 'A', min: 0, max: 100, decimal: 2, icon: 'zap' },
    { type: '电压传感器', unit: 'V', min: 200, max: 250, decimal: 1, icon: 'bolt' },
    { type: '位移传感器', unit: 'mm', min: 0, max: 100, decimal: 3, icon: 'move' },
    { type: '流量传感器', unit: 'm³/h', min: 0, max: 1000, decimal: 1, icon: 'flow' },
    { type: '转速传感器', unit: 'RPM', min: 0, max: 3000, icon: 'rotate' },
    { type: '噪音传感器', unit: 'dB', min: 20, max: 120, icon: 'volume' },
    { type: '烟雾传感器', unit: 'ppm', min: 0, max: 500, decimal: 1, icon: 'smoke' },
    { type: '光照传感器', unit: 'lux', min: 0, max: 100000, icon: 'sun' }
  ]

  for (let i = 1; i <= 24; i++) {
    const config = sensorTypes[(i - 1) % sensorTypes.length]
    const status = Math.random() > 0.1 ? 'normal' : (Math.random() > 0.5 ? 'warning' : 'error')
    sensors.push({
      id: `SENSOR-${String(i).padStart(3, '0')}`,
      name: `${config.type}-${i}`,
      type: config.type,
      value: random(config.min, config.max, config.decimal || 0),
      unit: config.unit,
      status,
      icon: config.icon,
      location: randomChoice(['A区', 'B区', 'C区', 'D区', '主站', '信号楼', '调度中心']),
      updateTime: new Date().toLocaleTimeString(),
      threshold: {
        min: config.min + (config.max - config.min) * 0.1,
        max: config.max - (config.max - config.min) * 0.1
      },
      history: generateTimeSeries(30, config.min, config.max, config.decimal || 0)
    })
  }
  return sensors
}

// 设备监控数据
export const getEquipmentData = () => {
  const equipments = []
  const equipmentTypes = [
    { type: '信号机', icon: 'signal', count: 45 },
    { type: '道岔', icon: 'switch', count: 32 },
    { type: '轨道电路', icon: 'track', count: 128 },
    { type: 'UPS电源', icon: 'battery', count: 16 },
    { type: '通信设备', icon: 'network', count: 24 },
    { type: '监控摄像头', icon: 'camera', count: 86 },
    { type: '列车检测器', icon: 'train', count: 18 },
    { type: '防雷设备', icon: 'lightning', count: 42 }
  ]

  equipmentTypes.forEach(({ type, icon, count }) => {
    const normal = random(Math.floor(count * 0.7), count)
    const warning = random(0, count - normal)
    const error = count - normal - warning
    equipments.push({
      type,
      icon,
      total: count,
      normal,
      warning,
      error,
      onlineRate: ((normal / count) * 100).toFixed(1),
      maintenanceCount: random(0, 5),
      avgRunningTime: random(100, 10000)
    })
  })
  return equipments
}

// 告警数据
export const getAlarmData = () => {
  const alarms = []
  const alarmTypes = [
    { level: 'critical', title: '设备严重故障', desc: '信号机XS-012通信中断' },
    { level: 'critical', title: '轨道电路异常', desc: 'GJ-003区段电压异常' },
    { level: 'warning', title: '温度超限预警', desc: '机房温度超过35°C' },
    { level: 'warning', title: 'UPS电量不足', desc: 'UPS-02电量低于20%' },
    { level: 'info', title: '设备维护提醒', desc: '道岔DC-008即将到期检修' },
    { level: 'info', title: '系统升级通知', desc: '计划于今晚22:00进行系统升级' },
    { level: 'warning', title: '网络延迟预警', desc: '主网络延迟超过50ms' },
    { level: 'critical', title: '安全事件', desc: '检测到异常访问尝试' }
  ]

  for (let i = 0; i < 15; i++) {
    const alarm = randomChoice(alarmTypes)
    alarms.push({
      id: `ALM-${Date.now()}-${i}`,
      ...alarm,
      time: new Date(Date.now() - random(0, 86400000)).toLocaleString('zh-CN'),
      source: randomChoice(['A区', 'B区', 'C区', '调度中心', '信号楼']),
      handled: Math.random() > 0.7
    })
  }

  return alarms.sort((a, b) => new Date(b.time) - new Date(a.time))
}

// 列车运行数据
export const getTrainData = () => ({
  totalTrains: random(50, 200),
  runningTrains: random(20, 80),
  delayedTrains: random(0, 10),
  avgDelay: random(0, 15, 1),
  punctualityRate: random(85, 99.9, 1),
  todayTrips: random(200, 500),
  passengerFlow: random(50000, 200000),
  freightTonnage: random(1000, 10000),
  avgSpeed: random(60, 120, 1),
  trainsByLine: [
    { line: '京沪线', count: random(10, 30) },
    { line: '京广线', count: random(10, 30) },
    { line: '沪昆线', count: random(10, 30) },
    { line: '陇海线', count: random(10, 30) },
    { line: '京哈线', count: random(10, 30) }
  ],
  trainsByType: [
    { type: '高铁', count: random(20, 50), color: '#00d4ff' },
    { type: '动车', count: random(15, 40), color: '#00ff88' },
    { type: '普快', count: random(30, 60), color: '#ffaa00' },
    { type: '货运', count: random(40, 80), color: '#ff6b6b' }
  ],
  realtimePositions: Array.from({ length: 20 }, (_, i) => ({
    id: `G${1000 + i}`,
    line: randomChoice(['京沪', '京广', '沪昆', '陇海', '京哈']),
    position: [random(115, 125, 4), random(30, 45, 4)],
    speed: random(80, 350),
    status: randomChoice(['正常运行', '即将到站', '正在发车', '临时停车'])
  }))
})

// 能耗数据
export const getEnergyData = () => ({
  totalConsumption: random(50000, 100000),
  dailyConsumption: generateTimeSeries(24, 1000, 5000),
  monthlyConsumption: generateTimeSeries(12, 50000, 150000),
  powerLoad: random(1000, 5000, 1),
  peakLoad: random(4000, 6000, 1),
  valleyLoad: random(500, 1500, 1),
  loadRate: random(60, 95, 1),
  energyByType: [
    { type: '牵引供电', value: random(40, 60), color: '#00d4ff' },
    { type: '信号设备', value: random(10, 20), color: '#00ff88' },
    { type: '照明系统', value: random(5, 15), color: '#ffaa00' },
    { type: '空调系统', value: random(15, 25), color: '#ff6b6b' },
    { type: '其他设备', value: random(5, 10), color: '#aa88ff' }
  ],
  carbonEmission: random(100, 500, 1),
  energySavingRate: random(5, 20, 1)
})

// 系统状态数据
export const getSystemStatus = () => ({
  cpuUsage: random(20, 80, 1),
  memoryUsage: random(30, 70, 1),
  diskUsage: random(40, 90, 1),
  networkIn: random(10, 1000, 1),
  networkOut: random(10, 500, 1),
  activeConnections: random(100, 1000),
  requestPerSecond: random(100, 5000),
  avgResponseTime: random(10, 200, 1),
  uptime: random(100, 365),
  services: [
    { name: '主服务器', status: 'running', cpu: random(10, 50, 1), memory: random(20, 60, 1) },
    { name: '数据库服务', status: 'running', cpu: random(10, 40, 1), memory: random(30, 70, 1) },
    { name: '缓存服务', status: 'running', cpu: random(5, 30, 1), memory: random(40, 80, 1) },
    { name: '消息队列', status: 'running', cpu: random(5, 25, 1), memory: random(20, 50, 1) },
    { name: '文件服务', status: Math.random() > 0.1 ? 'running' : 'warning', cpu: random(5, 20, 1), memory: random(10, 40, 1) }
  ],
  recentLogs: Array.from({ length: 10 }, (_, i) => ({
    time: new Date(Date.now() - i * 60000).toLocaleTimeString(),
    level: randomChoice(['INFO', 'WARN', 'ERROR', 'DEBUG']),
    message: randomChoice([
      '用户登录成功',
      '数据同步完成',
      'API请求超时',
      '数据库连接池已满',
      '缓存命中率: 95.2%',
      '定时任务执行完毕',
      '收到MQTT消息',
      'WebSocket连接建立'
    ])
  }))
})

// 安全监控数据
export const getSecurityData = () => ({
  intrusionAttempts: random(0, 50),
  blockedIPs: random(100, 500),
  activeUsers: random(50, 200),
  failedLogins: random(0, 20),
  securityScore: random(70, 100),
  firewallStatus: 'active',
  lastScanTime: new Date(Date.now() - random(0, 3600000)).toLocaleString('zh-CN'),
  vulnerabilities: {
    critical: random(0, 3),
    high: random(0, 10),
    medium: random(0, 20),
    low: random(0, 50)
  },
  recentEvents: Array.from({ length: 8 }, (_, i) => ({
    time: new Date(Date.now() - i * 1800000).toLocaleTimeString(),
    type: randomChoice(['登录', '登出', '权限变更', '配置修改', '文件访问']),
    user: `user${random(1, 100)}`,
    ip: `${random(1, 255)}.${random(1, 255)}.${random(1, 255)}.${random(1, 255)}`,
    status: randomChoice(['成功', '失败', '待审核'])
  }))
})

// 运维工单数据
export const getWorkOrderData = () => ({
  pending: random(5, 20),
  processing: random(10, 30),
  completed: random(50, 100),
  overdue: random(0, 5),
  avgProcessTime: random(2, 48, 1),
  satisfaction: random(85, 99, 1),
  ordersByType: [
    { type: '设备故障', count: random(10, 30), color: '#ff6b6b' },
    { type: '日常巡检', count: random(20, 50), color: '#00d4ff' },
    { type: '预防维护', count: random(15, 40), color: '#00ff88' },
    { type: '升级改造', count: random(5, 15), color: '#ffaa00' },
    { type: '应急抢修', count: random(0, 10), color: '#aa88ff' }
  ],
  recentOrders: Array.from({ length: 8 }, (_, i) => ({
    id: `WO-${Date.now()}-${i}`,
    title: randomChoice([
      '信号机故障维修',
      '道岔润滑保养',
      'UPS电池更换',
      '摄像头清洁',
      '网络设备巡检',
      '软件版本升级',
      '安全漏洞修复',
      '设备参数调整'
    ]),
    priority: randomChoice(['紧急', '高', '中', '低']),
    assignee: `工程师${random(1, 20)}`,
    status: randomChoice(['待处理', '处理中', '已完成', '已关闭']),
    createTime: new Date(Date.now() - random(0, 86400000 * 3)).toLocaleString('zh-CN')
  }))
})

// 统计概览数据
export const getOverviewData = () => ({
  totalDevices: 391,
  onlineDevices: random(350, 390),
  alarmCount: random(5, 30),
  todayEvents: random(100, 500),
  dataPoints: random(1000000, 10000000),
  systemHealth: random(90, 99, 1),
  dataQuality: random(95, 99.9, 1),
  predictionAccuracy: random(85, 98, 1),
  keyMetrics: [
    { label: '设备在线率', value: random(95, 99.9, 1), unit: '%', trend: random(-2, 2, 1), color: '#00d4ff' },
    { label: '信号正常率', value: random(98, 99.9, 1), unit: '%', trend: random(-1, 1, 1), color: '#00ff88' },
    { label: '故障响应时间', value: random(5, 30, 0), unit: '分钟', trend: random(-5, 5, 1), color: '#ffaa00' },
    { label: '系统可用性', value: random(99, 99.99, 2), unit: '%', trend: random(-0.1, 0.1, 2), color: '#ff6b6b' }
  ],
  trendData: {
    week: generateTimeSeries(7, 80, 100, 1),
    month: generateTimeSeries(30, 80, 100, 1),
    year: generateTimeSeries(12, 80, 100, 1)
  }
})

// 地图热点数据
export const getMapHotspots = () => Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: randomChoice(['北京站', '上海站', '广州站', '深圳站', '成都站', '武汉站', '西安站', '郑州站', '南京站', '杭州站']),
  position: [random(100, 130, 4), random(20, 45, 4)],
  value: random(10, 100),
  status: randomChoice(['正常', '繁忙', '拥堵', '维护中']),
  trains: random(5, 30),
  passengers: random(1000, 50000)
}))

// 信号调度系统数据
export const getSignalDispatchData = () => {
  // 线路定义
  const lines = [
    { id: 'L1', name: '京沪高速线', color: '#00d4ff', length: 1318 },
    { id: 'L2', name: '京广高速线', color: '#00ff88', length: 2298 },
    { id: 'L3', name: '沪昆高速线', color: '#ffaa00', length: 2252 },
    { id: 'L4', name: '陇海线', color: '#ff6b6b', length: 1759 },
    { id: 'L5', name: '京哈线', color: '#aa88ff', length: 1249 }
  ]

  // 信号机状态
  const signalMachines = []
  const signalStates = ['开放', '关闭', '故障', '维护']
  const signalColors = { '开放': '#00ff88', '关闭': '#ff6b6b', '故障': '#ffaa00', '维护': '#888' }

  for (let i = 1; i <= 32; i++) {
    const state = randomChoice(signalStates)
    signalMachines.push({
      id: `XH-${String(i).padStart(3, '0')}`,
      name: `信号机${i}`,
      line: randomChoice(lines).id,
      state,
      color: signalColors[state],
      position: { x: random(50, 750), y: random(50, 350) },
      direction: randomChoice(['上行', '下行']),
      lastChange: new Date(Date.now() - random(0, 3600000)).toLocaleTimeString()
    })
  }

  // 道岔状态
  const switches = []
  const switchStates = ['定位', '反位', '四开', '故障']

  for (let i = 1; i <= 24; i++) {
    const state = randomChoice(switchStates)
    switches.push({
      id: `DC-${String(i).padStart(3, '0')}`,
      name: `道岔${i}`,
      line: randomChoice(lines).id,
      state,
      locked: Math.random() > 0.3,
      position: { x: random(50, 750), y: random(50, 350) },
      operationCount: random(10, 200)
    })
  }

  // 轨道区段
  const trackSections = []
  const trackStates = ['空闲', '占用', '锁闭', '故障']

  for (let i = 1; i <= 48; i++) {
    const state = randomChoice(trackStates)
    trackSections.push({
      id: `GJ-${String(i).padStart(3, '0')}`,
      name: `区段${i}`,
      line: randomChoice(lines).id,
      state,
      voltage: random(15, 25, 1),
      length: random(500, 2000),
      occupied: state === '占用',
      trainId: state === '占用' ? `G${random(1000, 9999)}` : null
    })
  }

  // 实时列车调度信息
  const trainDispatch = []
  const trainStates = ['正常运行', '等待信号', '减速运行', '临时停车', '晚点运行']

  for (let i = 1; i <= 15; i++) {
    const line = randomChoice(lines)
    trainDispatch.push({
      id: `G${1000 + i}`,
      line: line.id,
      lineName: line.name,
      lineColor: line.color,
      state: randomChoice(trainStates),
      position: { x: random(50, 750), y: random(50, 350) },
      speed: random(80, 350),
      direction: randomChoice(['上行', '下行']),
      nextStation: randomChoice(['北京南', '上海虹桥', '广州南', '武汉', '郑州东']),
      eta: random(5, 60),
      delay: random(-5, 15),
      signalAhead: randomChoice(['绿灯', '黄灯', '红灯', '双黄灯']),
      priority: random(1, 5)
    })
  }

  // 调度命令
  const dispatchCommands = []
  const commandTypes = ['发车', '停车', '变更进路', '临时限速', '恢复常速', '越站', '扣车']

  for (let i = 0; i < 8; i++) {
    dispatchCommands.push({
      id: `CMD-${Date.now()}-${i}`,
      type: randomChoice(commandTypes),
      trainId: `G${random(1000, 9999)}`,
      content: randomChoice([
        '准许从北京南站发车',
        '在济南西站临时停车',
        '变更进路至3道',
        '限速120km/h通过',
        '恢复正常速度运行',
        '越过南京南站不停车',
        '在站扣车等待'
      ]),
      status: randomChoice(['已执行', '执行中', '待执行', '已取消']),
      issuer: `调度员${random(1, 10)}`,
      time: new Date(Date.now() - random(0, 3600000)).toLocaleTimeString()
    })
  }

  // 进路信息
  const routes = []
  for (let i = 1; i <= 12; i++) {
    routes.push({
      id: `ROUTE-${String(i).padStart(2, '0')}`,
      name: `进路${i}`,
      from: randomChoice(['北京南', '上海虹桥', '广州南', '武汉', '郑州东', '西安北']),
      to: randomChoice(['北京南', '上海虹桥', '广州南', '武汉', '郑州东', '西安北']),
      status: randomChoice(['已建立', '已锁闭', '已解锁', '待建立']),
      signals: [`XH-${random(1, 32).toString().padStart(3, '0')}`, `XH-${random(1, 32).toString().padStart(3, '0')}`],
      switches: [`DC-${random(1, 24).toString().padStart(3, '0')}`, `DC-${random(1, 24).toString().padStart(3, '0')}`],
      sections: [`GJ-${random(1, 48).toString().padStart(3, '0')}`, `GJ-${random(1, 48).toString().padStart(3, '0')}`]
    })
  }

  return {
    lines,
    signalMachines,
    switches,
    trackSections,
    trainDispatch,
    dispatchCommands,
    routes,
    stats: {
      totalSignals: 32,
      openSignals: signalMachines.filter(s => s.state === '开放').length,
      closedSignals: signalMachines.filter(s => s.state === '关闭').length,
      faultSignals: signalMachines.filter(s => s.state === '故障').length,
      totalSwitches: 24,
      normalSwitches: switches.filter(s => s.state !== '故障').length,
      faultSwitches: switches.filter(s => s.state === '故障').length,
      totalSections: 48,
      occupiedSections: trackSections.filter(s => s.state === '占用').length,
      freeSections: trackSections.filter(s => s.state === '空闲').length,
      lockedSections: trackSections.filter(s => s.state === '锁闭').length,
      runningTrains: trainDispatch.filter(t => t.state === '正常运行').length,
      delayedTrains: trainDispatch.filter(t => t.delay > 0).length,
      activeRoutes: routes.filter(r => r.status === '已建立' || r.status === '已锁闭').length
    }
  }
}

// 信号设备分布（饼图数据）
export const getSignalDistribution = () => ({
  signalStatus: [
    { name: '开放', value: random(20, 28), color: '#00ff88' },
    { name: '关闭', value: random(2, 5), color: '#ff6b6b' },
    { name: '故障', value: random(0, 2), color: '#ffaa00' },
    { name: '维护', value: random(0, 2), color: '#888888' }
  ],
  switchStatus: [
    { name: '定位', value: random(15, 20), color: '#00d4ff' },
    { name: '反位', value: random(4, 8), color: '#00ff88' },
    { name: '四开', value: random(0, 2), color: '#ffaa00' },
    { name: '故障', value: random(0, 1), color: '#ff6b6b' }
  ],
  trackStatus: [
    { name: '空闲', value: random(30, 40), color: '#00ff88' },
    { name: '占用', value: random(5, 12), color: '#ff6b6b' },
    { name: '锁闭', value: random(2, 6), color: '#ffaa00' },
    { name: '故障', value: random(0, 2), color: '#aa88ff' }
  ],
  trainStatus: [
    { name: '正常运行', value: random(8, 12), color: '#00ff88' },
    { name: '等待信号', value: random(1, 3), color: '#ffaa00' },
    { name: '减速运行', value: random(0, 2), color: '#00d4ff' },
    { name: '临时停车', value: random(0, 1), color: '#ff6b6b' }
  ],
  lineLoad: [
    { name: '京沪线', value: random(25, 35), color: '#00d4ff' },
    { name: '京广线', value: random(20, 30), color: '#00ff88' },
    { name: '沪昆线', value: random(15, 25), color: '#ffaa00' },
    { name: '陇海线', value: random(10, 20), color: '#ff6b6b' },
    { name: '京哈线', value: random(10, 20), color: '#aa88ff' }
  ]
})

// 调度效率统计
export const getDispatchEfficiency = () => ({
  // 每小时调度列车数
  hourlyDispatch: generateTimeSeries(24, 15, 45),
  // 调度成功率
  successRate: random(95, 99.9, 1),
  // 平均响应时间
  avgResponseTime: random(3, 15, 1),
  // 进路建立时间
  avgRouteTime: random(5, 20, 1),
  // 调度命令执行率
  commandExecutionRate: random(90, 99, 1),
  // 今日调度统计
  todayStats: {
    totalCommands: random(200, 500),
    executedCommands: random(180, 480),
    cancelledCommands: random(5, 20),
    pendingCommands: random(5, 30),
    avgDelay: random(0, 8, 1),
    punctualityRate: 100
  },
  // 近7天趋势
  weeklyTrend: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
    trains: random(300, 500),
    commands: random(400, 700),
    successRate: random(94, 99, 1)
  }))
})

// 实时数据更新（模拟）
export const subscribeToRealtimeData = (callback, interval = 3000) => {
  const timer = setInterval(() => {
    callback({
      timestamp: Date.now(),
      weather: {
        temperature: random(-5, 35, 1),
        humidity: random(30, 95, 1),
        windSpeed: random(0, 25, 1)
      },
      system: {
        cpuUsage: random(20, 80, 1),
        memoryUsage: random(30, 70, 1),
        networkIn: random(10, 1000, 1),
        networkOut: random(10, 500, 1)
      },
      sensors: getSensorData().slice(0, 6).map(s => ({
        id: s.id,
        value: s.value,
        status: s.status
      }))
    })
  }, interval)

  return () => clearInterval(timer)
}

export default {
  getWeatherData,
  getSensorData,
  getEquipmentData,
  getAlarmData,
  getTrainData,
  getEnergyData,
  getSystemStatus,
  getSecurityData,
  getWorkOrderData,
  getOverviewData,
  getMapHotspots,
  getSignalDispatchData,
  getSignalDistribution,
  getDispatchEfficiency,
  subscribeToRealtimeData
}
