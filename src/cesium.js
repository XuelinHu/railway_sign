import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

// 设置 Cesium Ion 访问令牌
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg5ODI3Mn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk'

// 全局变量
let viewer
let signals = []
let trainEntity = null
let isTrainRunning = false

// 山区铁道中心点 - 中国云南山区
const CENTER = {
  lon: 102.7,
  lat: 25.0,
  height: 2000
}

// 初始化 Cesium
export function initCesium() {
  try {
    viewer = new Cesium.Viewer('cesiumContainer', {
      // 不使用地形，避免加载问题
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      // 使用默认的影像图层
      baseLayer: Cesium.ImageryLayer.fromProviderAsync(
        Cesium.IonImageryProvider.fromAssetId(2)
      ),
      animation: false,
      timeline: false,
      baseLayerPicker: true,
      geocoder: false,
      homeButton: true,
      sceneModePicker: true,
      navigationHelpButton: false,
      fullscreenButton: true,
      infoBox: false,
      selectionIndicator: false
    })

    // 设置初始视角到中国云南
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        CENTER.lon,
        CENTER.lat,
        200000
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0
      }
    })

    // 开启大气效果
    viewer.scene.skyAtmosphere.show = true
    viewer.scene.skyAtmosphere.hueShift = 0.1
    viewer.scene.skyAtmosphere.saturationShift = 0.1
    viewer.scene.skyAtmosphere.brightnessShift = 0.1

    // 开启雾效
    viewer.scene.fog.enabled = true
    viewer.scene.fog.density = 0.0001

    // 设置光照
    viewer.scene.light = new Cesium.DirectionalLight({
      direction: Cesium.Cartesian3.fromDegrees(CENTER.lon + 10, CENTER.lat + 10, 1000000)
    })

    console.log('Cesium 初始化成功')
    return viewer
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
    throw error
  }
}

// 生成铁道路径
function generateRailwayPath() {
  const points = []
  const startLon = CENTER.lon - 0.5
  const startLat = CENTER.lat - 0.5

  for (let i = 0; i <= 100; i++) {
    const t = i / 100
    const lon = startLon + t * 1.0 + Math.sin(t * Math.PI * 4) * 0.15
    const lat = startLat + t * 1.0 + Math.cos(t * Math.PI * 3) * 0.1
    const height = 2800 + Math.sin(t * Math.PI * 6) * 200 + Math.cos(t * Math.PI * 4) * 150
    points.push(Cesium.Cartesian3.fromDegrees(lon, lat, height))
  }

  return points
}

// 创建铁道
function createRailway() {
  const points = generateRailwayPath()

  viewer.entities.add({
    name: '山区铁道',
    polyline: {
      positions: points,
      width: 8,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.3,
        color: Cesium.Color.CYAN.withAlpha(0.8)
      }),
      clampToGround: false
    }
  })

  const offsetPoints1 = points.map(p => {
    const carto = Cesium.Cartographic.fromCartesian(p)
    return Cesium.Cartesian3.fromRadians(
      carto.longitude + 0.00005,
      carto.latitude,
      carto.height
    )
  })

  const offsetPoints2 = points.map(p => {
    const carto = Cesium.Cartographic.fromCartesian(p)
    return Cesium.Cartesian3.fromRadians(
      carto.longitude - 0.00005,
      carto.latitude,
      carto.height
    )
  })

  viewer.entities.add({
    name: '铁轨1',
    polyline: {
      positions: offsetPoints1,
      width: 2,
      material: Cesium.Color.GRAY,
      clampToGround: false
    }
  })

  viewer.entities.add({
    name: '铁轨2',
    polyline: {
      positions: offsetPoints2,
      width: 2,
      material: Cesium.Color.GRAY,
      clampToGround: false
    }
  })

  return points
}

// 创建信号灯
function createSignalLights(railwayPoints) {
  const signalPositions = [
    railwayPoints[10],
    railwayPoints[30],
    railwayPoints[50],
    railwayPoints[70],
    railwayPoints[90]
  ]

  const signalStates = ['red', 'green', 'yellow', 'red', 'green']
  const signalNames = ['进站信号', '出站信号', '区间信号1', '区间信号2', '区间信号3']

  signalPositions.forEach((position, index) => {
    const carto = Cesium.Cartographic.fromCartesian(position)

    viewer.entities.add({
      name: `信号灯杆_${signalNames[index]}`,
      position: Cesium.Cartesian3.fromRadians(
        carto.longitude + 0.0001,
        carto.latitude,
        carto.height + 10
      ),
      cylinder: {
        length: 15,
        topRadius: 0.3,
        bottomRadius: 0.3,
        material: Cesium.Color.DARKGRAY,
        outline: true,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1
      }
    })

    const signalEntity = viewer.entities.add({
      name: signalNames[index],
      position: Cesium.Cartesian3.fromRadians(
        carto.longitude + 0.0001,
        carto.latitude,
        carto.height + 18
      ),
      ellipsoid: {
        radii: new Cesium.Cartesian3(1.5, 1.5, 1.5),
        material: getColorByState(signalStates[index]),
        outline: true,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2
      }
    })

    signals.push({
      entity: signalEntity,
      state: signalStates[index],
      name: signalNames[index],
      position: carto
    })

    viewer.entities.add({
      name: `光晕_${signalNames[index]}`,
      position: Cesium.Cartesian3.fromRadians(
        carto.longitude + 0.0001,
        carto.latitude,
        carto.height + 18
      ),
      ellipsoid: {
        radii: new Cesium.Cartesian3(3, 3, 3),
        material: getColorByState(signalStates[index]).withAlpha(0.3),
        outline: false
      }
    })
  })

  updateSignalUI()
}

function getColorByState(state) {
  switch (state) {
    case 'red': return Cesium.Color.RED
    case 'green': return Cesium.Color.GREEN
    case 'yellow': return Cesium.Color.YELLOW
    default: return Cesium.Color.GRAY
  }
}

function updateSignalUI() {
  const signalList = document.getElementById('signalList')
  if (!signalList) return

  const stateText = {
    'red': '禁止通行',
    'green': '允许通行',
    'yellow': '减速通行'
  }

  signalList.innerHTML = signals.map((signal) => `
    <div class="signal-item">
      <div class="signal-light signal-${signal.state}"></div>
      <div class="signal-info">
        <div class="signal-name">${signal.name}</div>
        <div class="signal-status">${stateText[signal.state]}</div>
      </div>
    </div>
  `).join('')

  document.getElementById('signalCount').textContent = signals.length
}

window.toggleSignals = function() {
  const states = ['red', 'green', 'yellow']
  signals.forEach((signal) => {
    const currentStateIndex = states.indexOf(signal.state)
    signal.state = states[(currentStateIndex + 1) % states.length]
    signal.entity.ellipsoid.material = getColorByState(signal.state)
  })
  updateSignalUI()
}

function createTrain() {
  const trainPosition = generateRailwayPath()[0]

  trainEntity = viewer.entities.add({
    name: '山区列车',
    position: trainPosition,
    point: {
      pixelSize: 20,
      color: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2
    },
    orientation: Cesium.Quaternion.IDENTITY
  })

  return trainEntity
}

window.trainSimulation = function() {
  if (!trainEntity) {
    createTrain()
  }

  isTrainRunning = !isTrainRunning

  if (isTrainRunning) {
    const railwayPoints = generateRailwayPath()
    let currentIndex = 0

    const interval = setInterval(() => {
      if (!isTrainRunning || currentIndex >= railwayPoints.length - 1) {
        clearInterval(interval)
        isTrainRunning = false
        return
      }

      currentIndex = (currentIndex + 1) % railwayPoints.length
      const position = railwayPoints[currentIndex]
      const nextPosition = railwayPoints[(currentIndex + 1) % railwayPoints.length]

      trainEntity.position = position

      const direction = Cesium.Cartesian3.subtract(
        nextPosition,
        position,
        new Cesium.Cartesian3()
      )
      Cesium.Cartesian3.normalize(direction, direction)

      const up = Cesium.Cartesian3.UNIT_Z
      const right = Cesium.Cartesian3.cross(direction, up, new Cesium.Cartesian3())
      const correctedUp = Cesium.Cartesian3.cross(right, direction, new Cesium.Cartesian3())

      const rotation = Cesium.Quaternion.fromRotationMatrix(
        new Cesium.Matrix3(
          direction.x, correctedUp.x, right.x,
          direction.y, correctedUp.y, right.y,
          direction.z, correctedUp.z, right.z
        )
      )

      trainEntity.orientation = rotation

      const carto = Cesium.Cartographic.fromCartesian(position)
      document.getElementById('coordinates').textContent =
        `${Cesium.Math.toDegrees(carto.longitude).toFixed(4)}, ${Cesium.Math.toDegrees(carto.latitude).toFixed(4)}`

    }, 100)
  }
}

window.resetView = function() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      CENTER.lon,
      CENTER.lat,
      50000
    ),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-45),
      roll: 0.0
    },
    duration: 2
  })
}

function setupInteractions() {
  viewer.screenSpaceEventHandler.setInputAction((movement) => {
    const cartesian = viewer.camera.pickEllipsoid(
      movement.endPosition,
      viewer.scene.globe.ellipsoid
    )

    if (cartesian) {
      const carto = Cesium.Cartographic.fromCartesian(cartesian)
      const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(4)
      const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(4)
      document.getElementById('coordinates').textContent = `${lon}, ${lat}`
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

  viewer.screenSpaceEventHandler.setInputAction((click) => {
    const pickedObject = viewer.scene.pick(click.position)

    if (Cesium.defined(pickedObject)) {
      console.log('选中对象:', pickedObject.id?.name)
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

function autoCycleSignals() {
  setInterval(() => {
    const randomIndex = Math.floor(Math.random() * signals.length)
    const states = ['red', 'green', 'yellow']
    const signal = signals[randomIndex]
    const currentStateIndex = states.indexOf(signal.state)
    signal.state = states[(currentStateIndex + 1) % states.length]
    signal.entity.ellipsoid.material = getColorByState(signal.state)
    updateSignalUI()
  }, 5000)
}

function createTrafficChart() {
  const chartDom = document.getElementById('trafficChart')
  if (!chartDom) return

  const myChart = echarts.init(chartDom)

  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  const data = [
    1200, 800, 450, 300, 250, 400, 850, 1200, 1500, 1800, 1650, 1400,
    1300, 1450, 1600, 1750, 1900, 2100, 1950, 1700, 1400, 1100, 900, 650
  ]

  const option = {
    grid: { top: 10, right: 10, bottom: 20, left: 40 },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}<br/>流量: {c} 吨'
    },
    xAxis: {
      type: 'category',
      data: hours,
      axisLabel: { fontSize: 10, color: '#ccc' },
      axisLine: { lineStyle: { color: '#555' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#ccc' },
      axisLine: { lineStyle: { color: '#555' } },
      splitLine: { lineStyle: { color: '#333' } }
    },
    series: [{
      data: data,
      type: 'line',
      smooth: true,
      lineStyle: { color: '#00d4ff', width: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(0, 212, 255, 0.5)' },
          { offset: 1, color: 'rgba(0, 212, 255, 0.05)' }
        ])
      },
      itemStyle: { color: '#00d4ff' }
    }]
  }

  myChart.setOption(option)
  return myChart
}

function createOperationChart() {
  const chartDom = document.getElementById('operationChart')
  if (!chartDom) return

  const myChart = echarts.init(chartDom)

  const option = {
    grid: { top: 10, right: 10, bottom: 20, left: 10 },
    tooltip: { trigger: 'item' },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'center',
      textStyle: { fontSize: 11, color: '#ccc' }
    },
    series: [{
      name: '运营统计',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 5, borderColor: '#1a1a1a', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#fff' }
      },
      data: [
        { value: 128, name: '今日列车', itemStyle: { color: '#5470c6' } },
        { value: 75, name: '平均速度', itemStyle: { color: '#91cc75' } },
        { value: 98.5, name: '准点率%', itemStyle: { color: '#fac858' } },
        { value: 100, name: '设备在线%', itemStyle: { color: '#ee6666' } }
      ]
    }]
  }

  myChart.setOption(option)
  return myChart
}

function createDeviceTrendChart() {
  const chartDom = document.getElementById('deviceTrendChart')
  if (!chartDom) return

  const myChart = echarts.init(chartDom)

  const hours = Array.from({ length: 12 }, (_, i) => `${i * 2}:00`)

  const option = {
    grid: { top: 15, right: 10, bottom: 20, left: 40 },
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['信号机', '轨道电路', '通信系统'],
      top: 0,
      textStyle: { fontSize: 10, color: '#ccc' }
    },
    xAxis: {
      type: 'category',
      data: hours,
      axisLabel: { fontSize: 10, color: '#ccc' },
      axisLine: { lineStyle: { color: '#555' } }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%', fontSize: 10, color: '#ccc' },
      axisLine: { lineStyle: { color: '#555' } },
      splitLine: { lineStyle: { color: '#333' } }
    },
    series: [
      {
        name: '信号机',
        type: 'line',
        data: [100, 100, 98, 100, 100, 99, 100, 100, 98, 100, 100, 100],
        smooth: true,
        lineStyle: { color: '#5470c6', width: 2 },
        itemStyle: { color: '#5470c6' },
        symbol: 'circle',
        symbolSize: 4
      },
      {
        name: '轨道电路',
        type: 'line',
        data: [98, 97, 96, 98, 99, 98, 97, 98, 98, 99, 98, 98],
        smooth: true,
        lineStyle: { color: '#91cc75', width: 2 },
        itemStyle: { color: '#91cc75' },
        symbol: 'circle',
        symbolSize: 4
      },
      {
        name: '通信系统',
        type: 'line',
        data: [100, 100, 99, 100, 100, 100, 99, 100, 100, 100, 100, 100],
        smooth: true,
        lineStyle: { color: '#fac858', width: 2 },
        itemStyle: { color: '#fac858' },
        symbol: 'circle',
        symbolSize: 4
      }
    ]
  }

  myChart.setOption(option)
  return myChart
}

function createEnvGaugeChart() {
  const chartDom = document.getElementById('envGaugeChart')
  if (!chartDom) return

  const myChart = echarts.init(chartDom)

  const option = {
    grid: { top: 10, right: 10, bottom: 10, left: 10 },
    tooltip: { formatter: '{b}: {c}%' },
    series: [
      {
        type: 'gauge',
        center: ['25%', '55%'],
        radius: '70%',
        min: -20,
        max: 40,
        splitNumber: 6,
        axisLine: {
          lineStyle: {
            width: 6,
            color: [[0.3, '#5470c6'], [0.7, '#91cc75'], [1, '#ee6666']]
          }
        },
        pointer: { itemStyle: { color: 'auto' } },
        axisTick: { distance: -6, length: 4, lineStyle: { color: '#fff', width: 1 } },
        splitLine: { distance: -8, length: 8, lineStyle: { color: '#fff', width: 2 } },
        axisLabel: { color: 'auto', fontSize: 10, distance: 12 },
        detail: { valueAnimation: true, formatter: '{value}°C', fontSize: 14, offsetCenter: [0, '70%'], color: '#ccc' },
        data: [{ value: -5, name: '温度' }]
      },
      {
        type: 'gauge',
        center: ['75%', '55%'],
        radius: '70%',
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 6,
            color: [[0.6, '#5470c6'], [1, '#ee6666']]
          }
        },
        pointer: { itemStyle: { color: 'auto' } },
        axisTick: { distance: -6, length: 4, lineStyle: { color: '#fff', width: 1 } },
        splitLine: { distance: -8, length: 8, lineStyle: { color: '#fff', width: 2 } },
        axisLabel: { color: 'auto', fontSize: 10, distance: 12 },
        detail: { valueAnimation: true, formatter: '{value}%', fontSize: 14, offsetCenter: [0, '70%'], color: '#ccc' },
        data: [{ value: 65, name: '湿度' }]
      }
    ]
  }

  myChart.setOption(option)
  return myChart
}

function updateCharts() {
  // 更新环境数据
  const envChart = echarts.getInstanceByDom(document.getElementById('envGaugeChart'))
  if (envChart) {
    const option = envChart.getOption()
    option.series[0].data[0].value = -5 + Math.random() * 10 - 5
    option.series[1].data[0].value = 60 + Math.random() * 20
    envChart.setOption(option)
  }

  // 更新流量数据
  const trafficChart = echarts.getInstanceByDom(document.getElementById('trafficChart'))
  if (trafficChart) {
    const option = trafficChart.getOption()
    const lastValue = option.series[0].data[23]
    option.series[0].data.shift()
    option.series[0].data.push(lastValue + Math.random() * 400 - 200)
    trafficChart.setOption(option)
  }
}

function updateDashboardData() {
  const lastUpdate = document.getElementById('lastUpdate')
  if (lastUpdate) {
    const now = new Date()
    lastUpdate.textContent = now.toLocaleString('zh-CN')
  }

  const lonEl = document.getElementById('longitude')
  const latEl = document.getElementById('latitude')
  if (lonEl && latEl) {
    lonEl.textContent = CENTER.lon.toFixed(4) + '°E'
    latEl.textContent = CENTER.lat.toFixed(4) + '°N'
  }
}

setInterval(updateDashboardData, 1000)

// 主初始化函数
export async function init() {
  try {
    initCesium()
    const railwayPoints = createRailway()
    createSignalLights(railwayPoints)
    setupInteractions()
    autoCycleSignals()

    // 初始化所有 ECharts 图表
    createTrafficChart()
    createOperationChart()
    createDeviceTrendChart()
    createEnvGaugeChart()

    // 定时更新图表数据
    setInterval(updateCharts, 3000)

    updateDashboardData()

    const loading = document.getElementById('loading')
    if (loading) loading.classList.add('hidden')

    console.log('Cesium 大地图初始化完成')
  } catch (error) {
    console.error('初始化失败:', error)
    const loading = document.getElementById('loading')
    if (loading) loading.classList.add('hidden')
  }
}

init()
