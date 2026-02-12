<template>
  <div class="three-view">
    <!-- 加载动画 -->
    <div v-if="loading" class="loading">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">加载中...</div>
      </div>
    </div>

    <!-- Three.js 容器 -->
    <div id="threeContainer" ref="threeContainer"></div>

    <!-- 控制按钮 -->
    <div class="control-panel">
      <button class="control-btn" @click="resetView">🎯 复位视角</button>
      <button class="control-btn" @click="toggleSignals">🚦 切换信号</button>
      <button class="control-btn" @click="trainAnimation">🚂 列车动画</button>
      <button class="control-btn" @click="toggleRotation">🔄 自动旋转</button>
    </div>

    <!-- 左侧数据面板 -->
    <div class="info-panel">
      <div class="panel-section">
        <h2 class="panel-title">🚦 信号灯监控</h2>
        <div id="signalList"></div>
      </div>

      <div class="panel-section">
        <h2 class="panel-title">⚡ 设备状态</h2>
        <div class="stat-item">
          <span class="stat-label">渲染帧率:</span>
          <span class="stat-value">60 FPS</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 100%"></div>
        </div>
        <div class="stat-item">
          <span class="stat-label">信号灯数量:</span>
          <span class="stat-value" id="signalCount">4</span>
        </div>
      </div>
    </div>

    <!-- 右侧数据面板 -->
    <div class="stats-panel">
      <div class="panel-section">
        <h2 class="panel-title">🎮 场景信息</h2>
        <div class="stat-item">
          <span class="stat-label">相机位置:</span>
          <span class="stat-value" id="cameraPos">--</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">运行时间:</span>
          <span class="stat-value" id="uptime">0s</span>
        </div>
      </div>

      <div class="panel-section">
        <h2 class="panel-title">🔧 系统状态</h2>
        <div class="stat-item">
          <span class="stat-label">最后更新:</span>
          <span class="stat-value" id="lastUpdate">--</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

const threeContainer = ref(null)
const loading = ref(true)

let scene, camera, renderer, controls, labelRenderer
let signals = []
let train = null
let isTrainRunning = false
let autoRotate = false
let clock = new THREE.Clock()
let startTime = Date.now()
let mixer = null
let gltfLoader = null
let modelLabels = []

const getColorByState = (state) => {
  switch (state) {
    case 'red': return 0xff3333
    case 'green': return 0x33ff33
    case 'yellow': return 0xffff33
    default: return 0x666666
  }
}

const init = () => {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)
  scene.fog = new THREE.Fog(0xf0f0f0, 100, 800)

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  )
  camera.position.set(80, 60, 80)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  document.getElementById('threeContainer').appendChild(renderer.domElement)

  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  document.body.appendChild(labelRenderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.maxPolarAngle = Math.PI / 2
  controls.minDistance = 20
  controls.maxDistance = 200

  setupLights()
  createGround()
  createMountains()
  createRailway()
  createSignalLights()
  createTrain()
  createTrees()

  window.addEventListener('resize', onWindowResize)

  setTimeout(() => {
    loading.value = false
  }, 1000)

  animate()
  updateUI()
  setInterval(updateUI, 1000)

  console.log('Three.js 小地图初始化完成')
}

const setupLights = () => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambientLight)

  const mainLight = new THREE.DirectionalLight(0xffffff, 1.5)
  mainLight.position.set(50, 100, 50)
  mainLight.castShadow = true
  mainLight.shadow.camera.left = -100
  mainLight.shadow.camera.right = 100
  mainLight.shadow.camera.top = 100
  mainLight.shadow.camera.bottom = -100
  mainLight.shadow.mapSize.width = 2048
  mainLight.shadow.mapSize.height = 2048
  scene.add(mainLight)

  const fillLight = new THREE.DirectionalLight(0xffeedd, 0.5)
  fillLight.position.set(-50, 50, -50)
  scene.add(fillLight)

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
  hemiLight.position.set(0, 200, 0)
  scene.add(hemiLight)
}

const createGround = () => {
  const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a8a6a,
    roughness: 0.9,
    metalness: 0.1
  })

  const vertices = groundGeometry.attributes.position.array
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i]
    const z = vertices[i + 2]
    vertices[i + 1] = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5
  }
  groundGeometry.computeVertexNormals()

  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
}

const createMountains = () => {
  const mountainGeometry = new THREE.ConeGeometry(30, 60, 8)
  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a9a8a,
    roughness: 0.95,
    metalness: 0.05
  })

  const positions = [
    { x: -80, z: -80 },
    { x: -100, z: 50 },
    { x: 80, z: -100 },
    { x: 100, z: 60 },
    { x: -60, z: 120 }
  ]

  positions.forEach(pos => {
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial)
    mountain.position.set(pos.x, 30, pos.z)
    mountain.scale.y = 1 + Math.random() * 0.5
    mountain.castShadow = true
    mountain.receiveShadow = true
    scene.add(mountain)
  })
}

const createRailway = () => {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }

  const railPositions = [
    { x: -80, z: -60, rotation: Math.PI / 3.6 },
    { x: -60, z: -45, rotation: Math.PI / 3.6 },
    { x: -40, z: -30, rotation: Math.PI / 3.6 },
    { x: -20, z: -15, rotation: Math.PI / 3.6 },
    { x: 0, z: 0, rotation: Math.PI / 3.6 },
    { x: 20, z: 15, rotation: Math.PI / 3.6 },
    { x: 40, z: 30, rotation: Math.PI / 3.6 },
    { x: 60, z: 45, rotation: Math.PI / 3.6 },
    { x: 80, z: 60, rotation: Math.PI / 3.6 }
  ]

  railPositions.forEach((pos, index) => {
    gltfLoader.load(
      '/assets/models/railway.glb',
      (gltf) => {
        const railway = gltf.scene
        railway.scale.set(12, 12, 12)
        railway.position.set(pos.x, 0, pos.z)
        railway.rotation.y = pos.rotation

        railway.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        scene.add(railway)
        console.log(`铁轨段 ${index + 1} 加载成功`)
      },
      (error) => {
        console.error(`铁轨段 ${index + 1} 加载失败:`, error)
      }
    )
  })
}

const createSignalLights = () => {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }

  const signalPositions = [
    { x: -40, z: -25 },
    { x: -10, z: -5 },
    { x: 20, z: 15 },
    { x: 40, z: 30 }
  ]

  const signalStates = ['red', 'green', 'yellow', 'green']
  const signalNames = ['进站信号', '出站信号', '区间信号1', '区间信号2']

  signalPositions.forEach((pos, index) => {
    gltfLoader.load(
      '/assets/models/sign.glb',
      (gltf) => {
        const signGroup = gltf.scene
        signGroup.scale.set(8, 8, 8)
        signGroup.position.set(pos.x, 0, pos.z)

        signGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        scene.add(signGroup)

        const color = getColorByState(signalStates[index])
        const light = new THREE.PointLight(color, 3, 40)
        light.position.set(pos.x, 5, pos.z)
        scene.add(light)

        signals.push({
          mesh: signGroup,
          light: light,
          state: signalStates[index],
          name: signalNames[index]
        })

        createModelLabel(signGroup, signalNames[index], 15, 65, 45, '109.3887, 24.3076')

        updateSignalUI()
        console.log(`信号灯 ${signalNames[index]} 加载成功`)
      },
      (error) => {
        console.error(`信号灯 ${signalNames[index]} 加载失败:`, error)
      }
    )
  })
}

const createTrain = () => {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }

  gltfLoader.load(
    '/assets/models/locomotive.glb',
    (gltf) => {
      train = gltf.scene
      train.scale.set(12, 12, 12)
      train.position.set(-60, 0.5, -40)
      train.rotation.y = Math.PI / 2

      train.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      scene.add(train)

      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(train)
        const action = mixer.clipAction(gltf.animations[0])
        action.play()
      }

      createModelLabel(train, '火车头', -5, 75, 60, '109.3900, 24.3100')

      console.log('火车头模型加载成功')
    },
    (error) => {
      console.error('火车头模型加载失败:', error)
    }
  )
}

const createModelLabel = (model, name, temperature, humidity, gpsLon, gpsLat) => {
  const div = document.createElement('div')
  div.className = 'model-label'

  let tempClass = 'temp-low'
  if (temperature < 0) tempClass = 'temp-low'
  else if (temperature < 20) tempClass = 'temp-medium'
  else tempClass = 'temp-high'

  const tempPercent = Math.min(Math.abs(temperature) / 40 * 100, 100)

  div.innerHTML = `
    <div class="label-title">${name}</div>
    <div class="label-row">
      <span>🌡️ 温度:</span>
      <span class="label-value">${temperature}°C</span>
    </div>
    <div class="label-row">
      <span>💧 湿度:</span>
      <span class="label-value">${humidity}%</span>
    </div>
    <div class="label-row">
      <span>📍 GPS:</span>
      <span class="label-value">${gpsLon}, ${gpsLat}</span>
    </div>
    <div class="label-row">
      <span style="flex: 1; margin-left: 10px;">
        <span>温度:</span>
        <span style="flex: 1; margin-left: auto;">
          <div class="progress-bg">
            <div class="temp-bar ${tempClass}" style="width: ${tempPercent}%"></div>
          </div>
        </span>
      </span>
    </div>
  `

  const label = new CSS2DObject(div)
  label.position.set(0, 0, 0)
  model.add(label)
  modelLabels.push({ object: model, label: label })
}

const createTrees = () => {
  const treeCount = 30

  for (let i = 0; i < treeCount; i++) {
    const treeGroup = new THREE.Group()

    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8)
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6a5a4a })
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
    trunk.position.y = 1.5
    trunk.castShadow = true
    treeGroup.add(trunk)

    const leavesGeometry = new THREE.ConeGeometry(2, 4, 8)
    const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x4a8a4a })
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial)
    leaves.position.y = 5
    leaves.castShadow = true
    treeGroup.add(leaves)

    const x = (Math.random() - 0.5) * 200
    const z = (Math.random() - 0.5) * 200
    treeGroup.position.set(x, 0, z)

    scene.add(treeGroup)
  }
}

const updateSignalUI = () => {
  const signalList = document.getElementById('signalList')
  if (!signalList) return

  const stateText = {
    'red': '禁止通行',
    'green': '允许通行',
    'yellow': '减速通行'
  }

  signalList.innerHTML = signals.map(signal => `
    <div class="signal-item">
      <div class="signal-light signal-${signal.state}"></div>
      <div class="signal-info">
        <div class="signal-name">${signal.name}</div>
        <div class="signal-status">${stateText[signal.state]}</div>
      </div>
    </div>
  `).join('')
}

const toggleSignals = () => {
  const states = ['red', 'green', 'yellow']
  signals.forEach(signal => {
    const currentStateIndex = states.indexOf(signal.state)
    signal.state = states[(currentStateIndex + 1) % states.length]
    const color = getColorByState(signal.state)

    signal.light.color.setHex(color)

    if (signal.mesh) {
      signal.mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          if (child.material.emissive) {
            child.material.emissive.setHex(color)
          }
          if (child.material.color) {
            child.material.color.setHex(color)
          }
        }
      })
    }
  })
  updateSignalUI()
}

const trainAnimation = () => {
  isTrainRunning = !isTrainRunning
}

const toggleRotation = () => {
  autoRotate = !autoRotate
}

const resetView = () => {
  camera.position.set(80, 60, 80)
  controls.target.set(0, 0, 0)
  controls.update()
}

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
}

const updateUI = () => {
  const lastUpdate = document.getElementById('lastUpdate')
  if (lastUpdate) {
    lastUpdate.textContent = new Date().toLocaleString('zh-CN')
  }

  const uptime = document.getElementById('uptime')
  if (uptime) {
    const seconds = Math.floor((Date.now() - startTime) / 1000)
    uptime.textContent = `${seconds}s`
  }

  const camPos = document.getElementById('cameraPos')
  if (camPos) {
    camPos.textContent = `${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)}`
  }
}

const animate = () => {
  requestAnimationFrame(animate)

  const delta = clock.getDelta()

  controls.update()

  if (autoRotate) {
    controls.autoRotate = true
    controls.autoRotateSpeed = 2.0
  } else {
    controls.autoRotate = false
  }

  if (isTrainRunning && train) {
    const time = clock.getElapsedTime() * 0.5
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-60, 0.5, -40),
      new THREE.Vector3(-30, 0.5, -20),
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(30, 0.5, 20),
      new THREE.Vector3(60, 0.5, 40)
    ])
    const position = path.getPoint((time % 1))
    train.position.copy(position)

    const nextPoint = path.getPoint(((time + 0.01) % 1))
    train.lookAt(nextPoint)
  }

  if (mixer) {
    mixer.update(delta)
  }

  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}

onMounted(() => {
  init()
})

onBeforeUnmount(() => {
  if (renderer) {
    renderer.dispose()
  }
  window.removeEventListener('resize', onWindowResize)
})
</script>

<style scoped>
.three-view {
  width: 100%;
  height: 100%;
  position: relative;
}

#threeContainer {
  width: 100%;
  height: 100%;
}

.control-panel {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 20, 40, 0.85);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 15px 25px;
  color: #fff;
  display: flex;
  gap: 15px;
  backdrop-filter: blur(10px);
  z-index: 100;
}

.control-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #0066cc, #00d4ff);
  border: none;
  border-radius: 5px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.control-btn:hover {
  background: linear-gradient(135deg, #0088ff, #00ffff);
  box-shadow: 0 0 15px rgba(0, 200, 255, 0.5);
}

.info-panel {
  position: absolute;
  top: 80px;
  left: 20px;
  bottom: 100px;
  width: 320px;
  background: rgba(0, 20, 40, 0.5);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 20px;
  color: #fff;
  overflow-y: auto;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 200, 255, 0.2);
}

.panel-section {
  margin-bottom: 25px;
}

.panel-section:last-child {
  margin-bottom: 0;
}

.panel-title {
  color: #00d4ff;
  font-size: 16px;
  margin-bottom: 15px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 200, 255, 0.3);
}

.signal-item {
  display: flex;
  align-items: center;
  margin: 12px 0;
  padding: 10px;
  background: rgba(0, 100, 150, 0.2);
  border-radius: 5px;
  border-left: 3px solid #00d4ff;
}

.signal-light {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin-right: 12px;
  box-shadow: 0 0 10px currentColor;
  animation: blink 2s infinite;
}

.signal-red { background: #ff3333; color: #ff3333; }
.signal-green { background: #33ff33; color: #33ff33; }
.signal-yellow { background: #ffff33; color: #ffff33; }

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.signal-info {
  flex: 1;
}

.signal-name {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
}

.signal-status {
  font-size: 12px;
  color: #aaa;
}

.stats-panel {
  position: absolute;
  top: 80px;
  right: 20px;
  bottom: 100px;
  width: 320px;
  background: rgba(0, 20, 40, 0.5);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 20px;
  color: #fff;
  overflow-y: auto;
  backdrop-filter: blur(10px);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
  font-size: 13px;
}

.stat-label { color: #aaa; }
.stat-value { color: #00d4ff; font-weight: bold; }

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(0, 100, 150, 0.3);
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0066cc, #00d4ff);
  border-radius: 4px;
  transition: width 0.5s;
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

.model-label {
  position: absolute;
  background: rgba(0, 20, 40, 0.9);
  border: 2px solid rgba(0, 200, 255, 0.5);
  border-radius: 8px;
  padding: 12px 16px;
  color: #fff;
  font-size: 14px;
  pointer-events: none;
  backdrop-filter: blur(5px);
  box-shadow: 0 4px 15px rgba(0, 150, 200, 0.3);
  max-width: 280px;
}

.label-title {
  font-size: 16px;
  font-weight: bold;
  color: #00d4ff;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 200, 255, 0.3);
}

.label-row {
  display: flex;
  align-items: center;
  margin: 6px 0;
  font-size: 13px;
}

.label-value {
  flex: 1;
  color: #00d4ff;
  font-weight: bold;
}

.progress-bg {
  flex: 1;
  margin-left: 10px;
}

.temp-progress {
  height: 8px;
  background: rgba(0, 100, 150, 0.3);
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
}

.temp-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.temp-low {
  background: linear-gradient(90deg, #4CAF50, #00d4ff);
}

.temp-medium {
  background: linear-gradient(90deg, #FFC107, #FF9800);
}

.temp-high {
  background: linear-gradient(90deg, #FF5722, #D32F2F);
}
</style>
