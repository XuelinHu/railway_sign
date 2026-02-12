<template>
  <div class="cesium-view">
    <!-- 加载动画 -->
    <div v-if="loading" class="loading">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ loadingStatus }}</div>
      </div>
    </div>

    <!-- Cesium 容器 -->
    <div id="cesiumContainer" ref="cesiumContainer"></div>

    <!-- 控制按钮 -->
    <button class="reset-btn" @click="resetView">🎯 复位视角</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

// 设置 Cesium Ion 访问令牌
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1MGE2NjE5OC05YmU5LTRiMTctODYxOC1hZWE0YTU0NDJmM2UiLCJpZCI6Mzg5Mzg5LCJpYXQiOjE3NzA3NzE2MjR9.XlfsTRYLQkmlFzS3Z-rGNLnchNdPlNqZUfzdX4SHtWU'

// 响应式变量
const cesiumContainer = ref(null)
const loading = ref(true)
const loadingStatus = ref('正在初始化 Cesium...')

let viewer = null
let beaconPoints = []
let beaconPopups = []
let selectedBeacon = null

// 柳州火车站坐标
const LIUZHOU_STATION = {
  lon: 109.38871,
  lat: 24.30755,
  height: 500
}

// 更新加载状态
const updateLoadingStatus = (status) => {
  loadingStatus.value = status
}

// 初始化 Cesium
const initCesium = async () => {
  try {
    updateLoadingStatus('正在初始化 Cesium...')
    console.log('开始初始化 Cesium...')
    console.log('目标位置: 柳州火车站', LIUZHOU_STATION)

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
    }

    viewer = new Cesium.Viewer('cesiumContainer', viewerOptions)

    viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
      requestVertexNormals: true,
      requestWaterMask: true
    })

    console.log('已启用 Cesium World Terrain 3D 地形')

    // 添加 OSM Buildings 3D 建筑图层
    try {
      updateLoadingStatus('正在加载 3D 建筑图层...')
      const osmBuildings = await Cesium.createOsmBuildings()
      viewer.scene.primitives.add(osmBuildings)
      console.log('✅ 已添加 OSM Buildings 3D 建筑图层')
    } catch (error) {
      console.warn('⚠️ OSM Buildings 加载失败:', error)
    }

    console.log('Cesium Viewer 创建成功')
    updateLoadingStatus('Viewer 创建成功，正在添加地图图层...')

    // 开启大气效果
    viewer.scene.skyAtmosphere.show = true
    viewer.scene.skyAtmosphere.hueShift = 0.1
    viewer.scene.skyAtmosphere.saturationShift = 0.1
    viewer.scene.skyAtmosphere.brightnessShift = 0.1

    // 开启雾效
    viewer.scene.fog.enabled = true
    viewer.scene.fog.density = 0.0001

    // 启用地形照明
    viewer.scene.globe.enableLighting = true

    // 增强地形夸张度
    viewer.terrainExaggeration = 3.0
    console.log('地形夸张度设置为: 3.0倍')

    // 启用基于地形的遮挡检测
    viewer.scene.globe.depthTestAgainstTerrain = true

    viewer.scene.globe.alpha = 1.0

    viewer.scene.globe.atmosphereShift = 0.05

    console.log('Cesium 初始化成功')
    updateLoadingStatus('初始化完成！')

    return viewer
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
    updateLoadingStatus('初始化失败: ' + error.message)
    throw error
  }
}

// 相机飞入到柳州火车站
const flyToLiuZhou = () => {
  if (!viewer) return

  console.log('相机飞入到柳州火车站...')

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
    duration: 3.0,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
  })
}

// 复位视角
const resetView = () => {
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
const updatePositionDisplay = () => {
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

  const coordinatesEl = document.getElementById('coordinates')
  if (coordinatesEl) {
    const carto = viewer.camera.positionCartographic
    const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(4)
    const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(4)
    coordinatesEl.textContent = `${lon}, ${lat}`
  }
}

// 隐藏弹窗函数
const hidePopup = (beaconId) => {
  if (beaconPopups[beaconId]) {
    beaconPopups[beaconId].style.display = 'none'
  }
  selectedBeacon = null
}

// 设置交互事件
const setupInteractions = () => {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

  handler.setInputAction(function(click) {
    const pickedObject = viewer.scene.pick(click.position, 0, 0)

    if (Cesium.defined(pickedObject)) {
      for (let i = 0; i < beaconPoints.length; i++) {
        const beacon = beaconPoints[i]
        if (pickedObject.id === beacon.cylinder.id ||
            pickedObject.id === beacon.point.id ||
            pickedObject.id === beacon.wave.id) {
          const popup = beaconPopups[i]
          if (selectedBeacon === i) {
            popup.style.display = 'none'
            selectedBeacon = null
          } else {
            beaconPopups.forEach((p, idx) => {
              if (idx !== i) p.style.display = 'none'
            })
            popup.style.display = 'block'
            selectedBeacon = i
          }
          break
        }
      }
    } else {
      beaconPopups.forEach(p => p.style.display = 'none')
      selectedBeacon = null
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  viewer.scene.postRender.addEventListener(() => {
    updatePositionDisplay()
    updatePopupPositions()
  })
}

// 更新弹窗位置
const updatePopupPositions = () => {
  beaconPoints.forEach((beacon, index) => {
    const popup = beaconPopups[index]
    if (!popup || popup.style.display === 'none') {
      return
    }

    const position = Cesium.Cartesian3.fromDegrees(beacon.lon, beacon.lat, beacon.basePosition.height)
    const windowCoord = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
      viewer.scene,
      position
    )

    if (Cesium.defined(windowCoord)) {
      const x = windowCoord.x - popup.offsetWidth / 2
      const y = windowCoord.y - popup.offsetHeight - 50
      popup.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
    }
  })
}

// 更新仪表盘数据
const updateDashboardData = () => {
  const lastUpdate = document.getElementById('lastUpdate')
  if (lastUpdate) {
    const now = new Date()
    lastUpdate.textContent = now.toLocaleString('zh-CN')
  }
}

// 创建随机发光柱和光波动画
const createBeaconPoints = () => {
  const pointCount = Math.floor(Math.random() * 4) + 5

  for (let i = 0; i < pointCount; i++) {
    const lon = LIUZHOU_STATION.lon + (Math.random() - 0.5) * 0.1
    const lat = LIUZHOU_STATION.lat + (Math.random() - 0.5) * 0.1
    const height = 200 + Math.random() * 300

    const position = Cesium.Cartesian3.fromDegrees(lon, lat, height)

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

    const point = viewer.entities.add({
      position: position,
      point: {
        pixelSize: 15,
        color: Cesium.Color.CYAN.withAlpha(0.8),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      }
    })

    const groundPosition = Cesium.Cartesian3.fromDegrees(lon, lat, 0)

    const wave = viewer.entities.add({
      position: groundPosition,
      ellipse: {
        semiMinorAxis: 10,
        semiMajorAxis: 10,
        height: 2,
        material: Cesium.Color.fromCssColorString('#00d4ff').withAlpha(0.6),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.8),
        outlineWidth: 3,
        rotation: Cesium.Math.toRadians(Math.random() * 360)
      }
    })

    beaconPoints.push({
      cylinder: cylinder,
      point: point,
      wave: wave,
      basePosition: { lon, lat, height },
      waveRadius: 10,
      maxRadius: 200,
      waveSpeed: 20 + Math.random() * 30,
      waveAlpha: 0.6,
      waveStartTime: Date.now() + Math.random() * 2000,
      id: i,
      lon: lon,
      lat: lat,
      eventType: eventType,
      eventMessage: eventMessage
    })

    const popupDiv = document.createElement('div')
    popupDiv.className = 'beacon-popup'
    popupDiv.innerHTML = `
      <div class="popup-content">
        <div class="popup-title">🚨 信号灯 ${i + 1} - ${eventType}</div>
        <div class="popup-time">⏰ ${eventTime}</div>
        <div class="popup-message">${eventMessage}</div>
        <div class="popup-coord">📍 坐标: ${lon.toFixed(4)}, ${lat.toFixed(4)}</div>
        <div class="popup-close" onclick="event.stopPropagation(); window.vueHidePopup(${i})">✕</div>
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

// 更新光波动画
const updateWaveAnimation = () => {
  const currentTime = Date.now()

  beaconPoints.forEach((beacon, index) => {
    if (currentTime < beacon.waveStartTime) {
      return
    }

    const elapsedTime = (currentTime - beacon.waveStartTime) * 0.001
    const currentRadius = beacon.waveRadius + elapsedTime * beacon.waveSpeed

    if (currentRadius > beacon.maxRadius) {
      beacon.waveStartTime = currentTime
      beacon.wave.ellipse.semiMinorAxis = beacon.waveRadius
      beacon.wave.ellipse.semiMajorAxis = beacon.waveRadius
      beacon.wave.ellipse.material = Cesium.Color.fromCssColorString('#00d4ff').withAlpha(beacon.waveAlpha)
    } else {
      beacon.wave.ellipse.semiMinorAxis = currentRadius
      beacon.wave.ellipse.semiMajorAxis = currentRadius

      const progress = (currentRadius - beacon.waveRadius) / (beacon.maxRadius - beacon.waveRadius)
      const newAlpha = beacon.waveAlpha * (1 - progress * 0.9)
      beacon.wave.ellipse.material = Cesium.Color.fromCssColorString('#00d4ff').withAlpha(newAlpha)
    }

    const pulseTime = currentTime * 0.003
    const pulseSize = 12 + Math.sin(pulseTime + index * 2) * 5
    beacon.point.point.pixelSize = pulseSize
  })
}

// 组件挂载时初始化
onMounted(async () => {
  try {
    console.log('=== Cesium 大地图初始化开始 ===')

    await initCesium()
    createBeaconPoints()

    updateLoadingStatus('正在飞向柳州火车站...')

    setTimeout(() => {
      flyToLiuZhou()
    }, 500)

    setupInteractions()

    viewer.clock.onTick.addEventListener(updateWaveAnimation)

    setInterval(updateDashboardData, 1000)

    setTimeout(() => {
      loading.value = false
      console.log('=== Cesium 大地图初始化完成 ===')
    }, 2000)

  } catch (error) {
    console.error('初始化失败:', error)
    updateLoadingStatus('初始化失败: ' + error.message)
  }

  // 全局暴露隐藏弹窗函数
  window.vueHidePopup = hidePopup
})

// 组件卸载时清理资源
onBeforeUnmount(() => {
  if (viewer) {
    viewer.destroy()
  }
})
</script>

<style scoped>
.cesium-view {
  width: 100%;
  height: 100%;
  position: relative;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
}

.reset-btn {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: rgba(0, 20, 40, 0.85);
  border: 2px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  color: #00d4ff;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
  z-index: 100;
}

.reset-btn:hover {
  background: rgba(0, 40, 80, 0.9);
  box-shadow: 0 0 15px rgba(0, 200, 255, 0.5);
  transform: translateX(-50%) translateY(-2px);
}

.loading {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loading-content {
  text-align: center;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(0, 200, 255, 0.3);
  border-top-color: #00d4ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: #00d4ff;
  font-size: 18px;
}
</style>
