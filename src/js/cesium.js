import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

// 设置 Cesium Ion 访问令牌
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1MGE2NjE5OC05YmU5LTRiMTctODYxOC1hZWE0YTU0NDJmM2UiLCJpZCI6Mzg5Mzg5LCJpYXQiOjE3NzA3NzE2MjR9.XlfsTRYLQkmlFzS3Z-rGNLnchNdPlNqZUfzdX4SHtWU'

// 全局变量
let viewer
let beaconPoints = []  // 存储所有信标点位
let beaconPopups = []  // 存储每个信标点的弹窗元素
let selectedBeacon = null  // 当前选中的信标

// 柳州火车站坐标
const LIUZHOU_STATION = {
  lon: 109.38871,  // 柳州火车站经度
  lat: 24.30755,   // 柳州火车站纬度
  height: 500
}

// 初始化 Cesium
export async function initCesium() {
  try {
    if (window.updateLoadingStatus) {
      window.updateLoadingStatus('正在初始化 Cesium...')
    }
    console.log('开始初始化 Cesium...')
    console.log('目标位置: 柳州火车站', LIUZHOU_STATION)

    // 创建基础 Viewer 配置
    const viewerOptions = {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: true,
      sceneModePicker: true,
      navigationHelpButton: false,
      fullscreenButton: true,
      infoBox: false,
      selectionIndicator: false
      // 不设置地形，使用默认的椭球体
    }

    // 创建 Viewer
    viewer = new Cesium.Viewer('cesiumContainer', viewerOptions)

    // 启用 Cesium World Terrain 3D 地形
    viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
      requestVertexNormals: true,
      requestWaterMask: true
    })

    console.log('已启用 Cesium World Terrain 3D 地形')

    // 添加 OSM Buildings 3D 建筑图层
    try {
      if (window.updateLoadingStatus) {
        window.updateLoadingStatus('正在加载 3D 建筑图层...')
      }

      const osmBuildings = await Cesium.createOsmBuildings()
      viewer.scene.primitives.add(osmBuildings)

      console.log('✅ 已添加 OSM Buildings 3D 建筑图层')
    } catch (error) {
      console.warn('⚠️ OSM Buildings 加载失败:', error)
      // 建筑图层加载失败不影响其他功能
    }

    console.log('Cesium Viewer 创建成功')
    if (window.updateLoadingStatus) {
      window.updateLoadingStatus('Viewer 创建成功，正在添加地图图层...')
    }

    // 开启大气效果
    viewer.scene.skyAtmosphere.show = true
    viewer.scene.skyAtmosphere.hueShift = 0.1
    viewer.scene.skyAtmosphere.saturationShift = 0.1
    viewer.scene.skyAtmosphere.brightnessShift = 0.1

    // 开启雾效
    viewer.scene.fog.enabled = true
    viewer.scene.fog.density = 0.0001

    // 启用地形照明 - 增强地形立体感
    viewer.scene.globe.enableLighting = true

    // 增强地形夸张度 - 使山地地形更明显
    viewer.terrainExaggeration = 3.0  // 地形夸张倍数，默认为1.0
    console.log('地形夸张度设置为: 3.0倍')

    // 启用基于地形的遮挡检测
    viewer.scene.globe.depthTestAgainstTerrain = true

    // 设置地面透明度（可选，设置为1表示不透明）
    viewer.scene.globe.alpha = 1.0

    // 启用动态大气光影
    viewer.scene.globe.atmosphereShift = 0.05

    console.log('Cesium 初始化成功')
    if (window.updateLoadingStatus) {
      window.updateLoadingStatus('初始化完成！');
    }
    return viewer
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
    if (window.updateLoadingStatus) {
      window.updateLoadingStatus('初始化失败: ' + error.message);
    }
    throw error
  }
}

// 相机飞入到柳州火车站
export function flyToLiuZhou() {
  if (!viewer) return

  console.log('相机飞入到柳州火车站...')

  // 使用 flyTo 实现平滑的飞入效果
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      LIUZHOU_STATION.lon,
      LIUZHOU_STATION.lat,
      LIUZHOU_STATION.height  // 飞行高度 500米
    ),
    orientation: {
      heading: Cesium.Math.toRadians(0),      // 朝向正北
      pitch: Cesium.Math.toRadians(-45),      // 俯视角度 -45度
      roll: 0.0
    },
    duration: 3.0,  // 飞行时长 3秒
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT  // 缓动函数
  })
}

// 复位视角
window.resetView = function() {
  if (!viewer) return

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      LIUZHOU_STATION.lon,
      LIUZHOU_STATION.lat,
      LIUZHOU_STATION.height
    ),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-45),
      roll: 0.0
    },
    duration: 2.0
  })
}

// 更新位置信息显示
function updatePositionDisplay() {
  const lonEl = document.getElementById('longitude')
  const latEl = document.getElementById('latitude')
  const altEl = document.getElementById('altitude')

  if (lonEl && latEl && altEl) {
    const cameraPosition = viewer.camera.positionCartographic
    const lon = Cesium.Math.toDegrees(cameraPosition.longitude).toFixed(4)
    const lat = Cesium.Math.toDegrees(cameraPosition.latitude).toFixed(4)
    const alt = (cameraPosition.height * 1000).toFixed(0)

    lonEl.textContent = lon + '°E'
    latEl.textContent = lat + '°N'
    altEl.textContent = alt + 'm'
  }

  // 更新坐标显示
  const coordinatesEl = document.getElementById('coordinates')
  if (coordinatesEl) {
    const carto = viewer.camera.positionCartographic
    const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(4)
    const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(4)
    coordinatesEl.textContent = `${lon}, ${lat}`
  }
}

// 隐藏弹窗函数
window.hidePopup = function(beaconId) {
  if (beaconPopups[beaconId]) {
    beaconPopups[beaconId].style.display = 'none'
  }
  selectedBeacon = null
}

// 设置交互事件
function setupInteractions() {
  // 添加点击事件监听器
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

  handler.setInputAction(function(click) {
    // 拾取场景中的对象
    const pickedObject = viewer.scene.pick(click.position, 0, 0)

    if (Cesium.defined(pickedObject)) {
      // 检查是否点击了信标
      for (let i = 0; i < beaconPoints.length; i++) {
        const beacon = beaconPoints[i]
        if (pickedObject.id === beacon.cylinder.id ||
            pickedObject.id === beacon.point.id ||
            pickedObject.id === beacon.wave.id) {
          // 切换弹窗显示
          const popup = beaconPopups[i]
          if (selectedBeacon === i) {
            // 如果已选中，则隐藏
            popup.style.display = 'none'
            selectedBeacon = null
          } else {
            // 隐藏其他弹窗
            beaconPopups.forEach((p, idx) => {
              if (idx !== i) p.style.display = 'none'
            })
            // 显示当前弹窗
            popup.style.display = 'block'
            selectedBeacon = i
          }
          break
        }
      }
    } else {
      // 点击空白处，隐藏所有弹窗
      beaconPopups.forEach(p => p.style.display = 'none')
      selectedBeacon = null
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  // 监听场景渲染事件，更新弹窗位置和相机信息
  viewer.scene.postRender.addEventListener(() => {
    updatePositionDisplay()
    updatePopupPositions()
  })
}

// 更新弹窗位置，让它们跟随信标移动
function updatePopupPositions() {
  beaconPoints.forEach((beacon, index) => {
    const popup = beaconPopups[index]
    if (!popup || popup.style.display === 'none') {
      return  // 弹窗不存在或隐藏，跳过
    }

    // 转换3D坐标到屏幕坐标
    const position = Cesium.Cartesian3.fromDegrees(beacon.lon, beacon.lat, beacon.basePosition.height)
    const windowCoord = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
      viewer.scene,
      position
    )

    if (Cesium.defined(windowCoord)) {
      const x = windowCoord.x - popup.offsetWidth / 2
      const y = windowCoord.y - popup.offsetHeight - 50  // 向上偏移，避免遮挡信标
      popup.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
    }
  })
}

// 更新仪表盘数据
function updateDashboardData() {
  const lastUpdate = document.getElementById('lastUpdate')
  if (lastUpdate) {
    const now = new Date()
    lastUpdate.textContent = now.toLocaleString('zh-CN')
  }
}

// 创建随机发光柱和光波动画
function createBeaconPoints() {
  // 在柳州周边随机生成5-8个点位
  const pointCount = Math.floor(Math.random() * 4) + 5  // 5-8个点

  for (let i = 0; i < pointCount; i++) {
    // 在柳州火车站周围随机分布
    const lon = LIUZHOU_STATION.lon + (Math.random() - 0.5) * 0.1  // ±0.05度
    const lat = LIUZHOU_STATION.lat + (Math.random() - 0.5) * 0.1  // ±0.05度
    const height = 200 + Math.random() * 300  // 200-500米高度

    const position = Cesium.Cartesian3.fromDegrees(lon, lat, height)

    // 生成随机事件提醒信息
    const eventTypes = ['设备正常', '温度异常', '维护中', '离线', '电压异常']
    const eventMessages = [
      '信号灯运行正常，所有参数在范围内',
      '温度超过阈值，当前45°C，请检查设备',
      '设备正在维护，预计2小时后恢复',
      '设备离线，最后检查时间：10分钟前',
      '电压异常，当前220V，需要检查线路'
    ]
    const randomEventIndex = Math.floor(Math.random() * eventTypes.length)
    const eventType = eventTypes[randomEventIndex]
    const eventMessage = eventMessages[randomEventIndex]
    const eventTime = new Date().toLocaleString('zh-CN')

    // 1. 创建发光柱（圆柱体）
    const cylinder = viewer.entities.add({
      position: position,
      cylinder: {
        length: height,
        topRadius: 2,
        bottomRadius: 2,
        material: Cesium.Color.fromCssColorString('#00d4ff').withAlpha(0.6),
        outline: true,
        outlineColor: Cesium.Color.CYAN,
        outlineWidth: 2
      }
    })

    // 2. 创建顶部发光点
    const point = viewer.entities.add({
      position: position,
      point: {
        pixelSize: 15,
        color: Cesium.Color.CYAN.withAlpha(0.8),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      }
    })

    // 3. 创建光波动画（圆形扩散）- 定位在地面
    const groundPosition = Cesium.Cartesian3.fromDegrees(lon, lat, 0)  // 地面位置

    const wave = viewer.entities.add({
      position: groundPosition,  // 放置在地面而不是顶部
      ellipse: {
        semiMinorAxis: 10,  // 初始半径较小
        semiMajorAxis: 10,
        height: 2,  // 稍微离地一点，避免z-fighting
        material: Cesium.Color.fromCssColorString('#00d4ff').withAlpha(0.6),  // 初始更不透明
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.8),
        outlineWidth: 3,
        rotation: Cesium.Math.toRadians(Math.random() * 360)
      }
    })

    // 保存到数组中，用于动画更新
    beaconPoints.push({
      cylinder: cylinder,
      point: point,
      wave: wave,
      basePosition: { lon, lat, height },
      waveRadius: 10,  // 初始半径
      maxRadius: 200,  // 最大扩散半径
      waveSpeed: 20 + Math.random() * 30,  // 扩散速度（米/秒）
      waveAlpha: 0.6,  // 初始透明度
      waveStartTime: Date.now() + Math.random() * 2000,  // 随机延迟启动
      id: i,  // 信标ID
      lon: lon,  // 保存坐标用于弹窗
      lat: lat,
      eventType: eventType,  // 事件类型
      eventMessage: eventMessage  // 事件消息
    })

    // 创建事件提醒弹窗
    const popupDiv = document.createElement('div')
    popupDiv.className = 'beacon-popup'
    popupDiv.innerHTML = `
      <div class="popup-content">
        <div class="popup-title">🚨 信号灯 ${i + 1} - ${eventType}</div>
        <div class="popup-time">⏰ ${eventTime}</div>
        <div class="popup-message">${eventMessage}</div>
        <div class="popup-coord">📍 坐标: ${lon.toFixed(4)}, ${lat.toFixed(4)}</div>
        <div class="popup-close" onclick="event.stopPropagation(); hidePopup(${i})">✕</div>
      </div>
    `
    popupDiv.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      display: none;
      z-index: 1000;
      pointer-events: auto;
    `

    viewer.container.appendChild(popupDiv)
    beaconPopups.push(popupDiv)

    console.log(`创建信标点 ${i + 1}: [${lon.toFixed(4)}, ${lat.toFixed(4)}, ${height.toFixed(0)}m]`)
  }

  // 添加CSS样式到页面
  const style = document.createElement('style')
  style.textContent = `
    .beacon-popup {
      background: rgba(0, 20, 40, 0.95);
      border: 2px solid rgba(0, 200, 255, 0.6);
      border-radius: 8px;
      padding: 15px;
      min-width: 280px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      font-family: 'Microsoft YaHei', Arial, sans-serif;
    }
    .popup-content {
      color: #fff;
    }
    .popup-title {
      font-size: 16px;
      font-weight: bold;
      color: #00d4ff;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(0, 200, 255, 0.3);
    }
    .popup-time {
      font-size: 12px;
      color: #aaa;
      margin-bottom: 8px;
    }
    .popup-message {
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 10px;
    }
    .popup-coord {
      font-size: 11px;
      color: #888;
      font-family: monospace;
    }
    .popup-close {
      position: absolute;
      top: 8px;
      right: 8px;
      cursor: pointer;
      font-size: 18px;
      color: #ff6666;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .popup-close:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #ff3333;
    }
  `
  document.head.appendChild(style)
}

// 更新光波动画 - 像地震波一样从中心向外发散
function updateWaveAnimation() {
  const currentTime = Date.now()

  beaconPoints.forEach((beacon, index) => {
    // 检查是否到了该光波的启动时间
    if (currentTime < beacon.waveStartTime) {
      return  // 还没到启动时间，跳过
    }

    // 计算从启动开始经过的时间（秒）
    const elapsedTime = (currentTime - beacon.waveStartTime) * 0.001

    // 计算当前半径：从10米开始向外扩散
    const currentRadius = beacon.waveRadius + elapsedTime * beacon.waveSpeed

    // 如果超过最大半径，重置（循环效果）
    if (currentRadius > beacon.maxRadius) {
      beacon.waveStartTime = currentTime  // 重置启动时间
      beacon.wave.ellipse.semiMinorAxis = beacon.waveRadius
      beacon.wave.ellipse.semiMajorAxis = beacon.waveRadius
      beacon.wave.ellipse.material = Cesium.Color.fromCssColorString('#00d4ff').withAlpha(beacon.waveAlpha)
    } else {
      // 更新光波半径 - 从中心向外扩散
      beacon.wave.ellipse.semiMinorAxis = currentRadius
      beacon.wave.ellipse.semiMajorAxis = currentRadius

      // 透明度随半径增大而减小（扩散越远越透明）
      const progress = (currentRadius - beacon.waveRadius) / (beacon.maxRadius - beacon.waveRadius)
      const newAlpha = beacon.waveAlpha * (1 - progress * 0.9)  // 从0.6渐变到0.06
      beacon.wave.ellipse.material = Cesium.Color.fromCssColorString('#00d4ff').withAlpha(newAlpha)
    }

    // 顶部发光点脉冲效果（独立于光波）
    const pulseTime = currentTime * 0.003
    const pulseSize = 12 + Math.sin(pulseTime + index * 2) * 5  // 7-17像素
    beacon.point.point.pixelSize = pulseSize
  })
}

// 主初始化函数
export async function init() {
  try {
    console.log('=== Cesium 大地图初始化开始 ===')

    // 初始化 Cesium
    await initCesium()

    // 创建随机发光柱和光波
    createBeaconPoints()

    // 相机飞入到柳州火车站
    if (window.updateLoadingStatus) {
      window.updateLoadingStatus('正在飞向柳州火车站...')
    }

    setTimeout(() => {
      flyToLiuZhou()
    }, 500)

    // 设置交互
    setupInteractions()

    // 启动光波动画循环
    viewer.clock.onTick.addEventListener(updateWaveAnimation)

    // 定时更新仪表盘数据
    setInterval(updateDashboardData, 1000)

    // 隐藏加载动画
    setTimeout(() => {
      const loading = document.getElementById('loading')
      if (loading) loading.classList.add('hidden')
      console.log('=== Cesium 大地图初始化完成 ===')
    }, 2000)

  } catch (error) {
    console.error('初始化失败:', error)
    if (window.updateLoadingStatus) {
      window.updateLoadingStatus('初始化失败: ' + error.message);
    }
    const loading = document.getElementById('loading')
    if (loading) {
      loading.innerHTML = `
        <div style="color: #ff6666;">
          <div style="font-size: 24px; margin-bottom: 20px;">❌ 加载失败</div>
          <div style="font-size: 14px;">${error.message}</div>
          <div style="font-size: 12px; margin-top: 20px;">请打开浏览器控制台查看详细错误信息</div>
        </div>
      `
    }
  }
}

// 启动应用
init()
