import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

// 全局变量
let scene, camera, renderer, controls, labelRenderer
let signals = []
let train = null
let isTrainRunning = false
let autoRotate = false
let clock = new THREE.Clock()
let startTime = Date.now()
let mixer = null // 动画混合器
let gltfLoader = null
let modelLabels = []  // 存储所有模型标签

// 初始化 Three.js
function init() {
  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0) // 改为白色背景
  scene.fog = new THREE.Fog(0xf0f0f0, 100, 800) // 雾效也改为白色

  // 创建相机
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  )
  camera.position.set(80, 60, 80)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  document.getElementById('threeContainer').appendChild(renderer.domElement)

  // 创建CSS2D渲染器用于HTML标签
  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  document.body.appendChild(labelRenderer.domElement)

  // 创建控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.maxPolarAngle = Math.PI / 2
  controls.minDistance = 20
  controls.maxDistance = 200

  // 添加光照
  setupLights()

  // 创建场景
  createGround()
  createMountains()
  createRailway()
  createSignalLights()
  createTrain()  // 恢复火车头
  // createStation()  // 已禁用 - 移除火车站
  createTrees()

  // 事件监听
  window.addEventListener('resize', onWindowResize)

  // 隐藏加载动画
  setTimeout(() => {
    const loading = document.getElementById('loading')
    if (loading) loading.classList.add('hidden')
  }, 1000)

  // 开始动画
  animate()

  // 更新 UI
  updateUI()
  setInterval(updateUI, 1000)

  console.log('Three.js 小地图初始化完成')
}

// 设置光照
function setupLights() {
  // 环境光 - 增强亮度
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambientLight)

  // 主光源 - 增强亮度
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

  // 补光 - 改为暖色
  const fillLight = new THREE.DirectionalLight(0xffeedd, 0.5)
  fillLight.position.set(-50, 50, -50)
  scene.add(fillLight)

  // 半球光 - 提供更自然的照明
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
  hemiLight.position.set(0, 200, 0)
  scene.add(hemiLight)
}

// 创建地面
function createGround() {
  const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a8a6a, // 浅绿色地面
    roughness: 0.9,
    metalness: 0.1
  })

  // 添加地形起伏
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

// 创建山脉
function createMountains() {
  const mountainGeometry = new THREE.ConeGeometry(30, 60, 8)
  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a9a8a, // 浅灰色山脉
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

// 创建铁道（加载 GLB 模型并拼接）
function createRailway() {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }

  // 定义铁道路径点 - 9段轨道在一直线上，首尾相接，统一旋转50度
  const railPositions = [
    { x: -80, z: -60, rotation: Math.PI / 3.6 },  // 轨道1
    { x: -60, z: -45, rotation: Math.PI / 3.6 },  // 轨道2
    { x: -40, z: -30, rotation: Math.PI / 3.6 },  // 轨道3
    { x: -20, z: -15, rotation: Math.PI / 3.6 },  // 轨道4
    { x: 0, z: 0, rotation: Math.PI / 3.6 },      // 轨道5（中心）
    { x: 20, z: 15, rotation: Math.PI / 3.6 },   // 轨道6
    { x: 40, z: 30, rotation: Math.PI / 3.6 },   // 轨道7
    { x: 60, z: 45, rotation: Math.PI / 3.6 },   // 轨道8
    { x: 80, z: 60, rotation: Math.PI / 3.6 }    // 轨道9
  ]

  // 加载并放置多个铁轨段
  railPositions.forEach((pos, index) => {
    gltfLoader.load(
      '/assets/models/railway.glb',
      (gltf) => {
        const railway = gltf.scene
        railway.scale.set(12, 12, 12) // 放大12倍
        railway.position.set(pos.x, 0, pos.z) // 放在地平线上
        railway.rotation.y = pos.rotation

        // 启用阴影
        railway.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        scene.add(railway)
        console.log(`铁轨段 ${index + 1} 加载成功`)
      },
      (progress) => {
        console.log(`铁轨段 ${index + 1} 加载进度:`, (progress.loaded / progress.total * 100) + '%')
      },
      (error) => {
        console.error(`铁轨段 ${index + 1} 加载失败:`, error)
      }
    )
  })

  // 创建路径用于火车运动
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-60, 0.5, -40),
    new THREE.Vector3(-30, 0.5, -20),
    new THREE.Vector3(0, 0.5, 0),
    new THREE.Vector3(30, 0.5, 20),
    new THREE.Vector3(60, 0.5, 40)
  ])

  return curve
}

// 创建信号灯（加载 GLB 模型）
function createSignalLights() {
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
        signGroup.scale.set(8, 8, 8) // 放大8倍
        signGroup.position.set(pos.x, 0, pos.z) // 放在地平线上

        // 启用阴影
        signGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        scene.add(signGroup)

        // 添加点光源（根据信号灯状态）
        const color = getColorByState(signalStates[index])
        const light = new THREE.PointLight(color, 3, 40) // 增强光源强度和范围
        light.position.set(pos.x, 5, pos.z)
        scene.add(light)

        signals.push({
          mesh: signGroup,
          light: light,
          state: signalStates[index],
          name: signalNames[index]
        })

        // 创建3D标签
        createModelLabel(signGroup, signalNames[index], 15, 65, 45, '109.3887, 24.3076')

        updateSignalUI()
        console.log(`信号灯 ${signalNames[index]} 加载成功`)
      },
      (progress) => {
        console.log(`信号灯 ${signalNames[index]} 加载进度:`, (progress.loaded / progress.total * 100) + '%')
      },
      (error) => {
        console.error(`信号灯 ${signalNames[index]} 加载失败:`, error)
      }
    )
  })
}

// 根据状态获取颜色
function getColorByState(state) {
  switch (state) {
    case 'red': return 0xff3333
    case 'green': return 0x33ff33
    case 'yellow': return 0xffff33
    default: return 0x666666
  }
}

// 创建列车（加载 GLB 模型）
function createTrain() {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }

  gltfLoader.load(
    '/assets/models/locomotive.glb',
    (gltf) => {
      train = gltf.scene
      train.scale.set(12, 12, 12) // 放大12倍
      train.position.set(-60, 0.5, -40) // 稍微抬高，放在铁轨上
      train.rotation.y = Math.PI / 2 // 调整朝向

      // 启用阴影
      train.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      scene.add(train)

      // 如果有动画，设置动画混合器
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(train)
        const action = mixer.clipAction(gltf.animations[0])
        action.play()
      }

      // 创建3D标签
      createModelLabel(train, '火车头', -5, 75, 60, '109.3900, 24.3100')

      console.log('火车头模型加载成功')
    },
    (progress) => {
      console.log('火车头加载进度:', (progress.loaded / progress.total * 100) + '%')
    },
    (error) => {
      console.error('火车头模型加载失败:', error)
      // 如果模型加载失败，使用简单的几何体作为后备
      createFallbackTrain()
    }
  )
}

// 后备火车（如果 GLB 加载失败）
function createFallbackTrain() {
  const trainGroup = new THREE.Group()

  // 车身
  const bodyGeometry = new THREE.BoxGeometry(8, 3, 3)
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2244aa })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = 2
  body.castShadow = true
  trainGroup.add(body)

  // 车头
  const headGeometry = new THREE.BoxGeometry(2, 2.5, 2.8)
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0x3355bb })
  const head = new THREE.Mesh(headGeometry, headMaterial)
  head.position.set(5, 2, 0)
  head.castShadow = true
  trainGroup.add(head)

  // 车窗
  const windowGeometry = new THREE.BoxGeometry(0.1, 1, 2)
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    emissive: 0x4488cc,
    emissiveIntensity: 0.3
  })
  const trainWindow = new THREE.Mesh(windowGeometry, windowMaterial)
  trainWindow.position.set(6.1, 2.5, 0)
  trainGroup.add(trainWindow)

  // 车轮
  const wheelGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.3, 16)
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 })
  const wheelPositions = [[-3, 0.6, 1.5], [-3, 0.6, -1.5], [3, 0.6, 1.5], [3, 0.6, -1.5]]

  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
    wheel.position.set(...pos)
    wheel.rotation.x = Math.PI / 2
    wheel.castShadow = true
    trainGroup.add(wheel)
  })

  train = trainGroup
  train.position.set(-60, 0, -40)
  scene.add(train)
}

// 创建火车站（加载 GLB 模型）
function createStation() {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }

  gltfLoader.load(
    '/assets/models/station.glb',
    (gltf) => {
      const station = gltf.scene
      station.scale.set(20, 20, 20) // 放大20倍
      station.position.set(30, 0, 20) // 在地平线上，与铁轨、信号灯同高
      station.rotation.y = -Math.PI / 4 // 调整朝向

      // 启用阴影
      station.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      scene.add(station)
      console.log('火车站模型加载成功')

      // 创建3D标签
      createModelLabel(station, '柳州火车站', 30, -5, 85, '109.3887, 24.3076')
    },
    (progress) => {
      console.log('火车站加载进度:', (progress.loaded / progress.total * 100) + '%')
    },
    (error) => {
      console.error('火车站模型加载失败:', error)
    }
  )
}

// 创建树木
function createTrees() {
  const treeCount = 30

  for (let i = 0; i < treeCount; i++) {
    const treeGroup = new THREE.Group()

    // 树干
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8)
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6a5a4a })
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
    trunk.position.y = 1.5
    trunk.castShadow = true
    treeGroup.add(trunk)

    // 树冠
    const leavesGeometry = new THREE.ConeGeometry(2, 4, 8)
    const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x4a8a4a })
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial)
    leaves.position.y = 5
    leaves.castShadow = true
    treeGroup.add(leaves)

    // 随机位置
    const x = (Math.random() - 0.5) * 200
    const z = (Math.random() - 0.5) * 200
    treeGroup.position.set(x, 0, z)

    scene.add(treeGroup)
  }
}

// 创建3D模型的HTML标签
function createModelLabel(model, name, temperature, humidity, gpsLon, gpsLat) {
  // 创建标签容器div
  const div = document.createElement('div')
  div.className = 'model-label'

  // 根据温度确定颜色
  let tempClass = 'temp-low'
  if (temperature < 0) tempClass = 'temp-low'
  else if (temperature < 20) tempClass = 'temp-medium'
  else tempClass = 'temp-high'

  // 计算温度进度条宽度
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

  // 添加到场景和标签渲染器
  const label = new THREE.CSS2DObject(div)
  label.position.set(0, 0, 0)
  model.add(label)
  modelLabels.push({ object: model, label: label })
}

// 切换信号灯
window.toggleSignals = function() {
  const states = ['red', 'green', 'yellow']
  signals.forEach(signal => {
    const currentStateIndex = states.indexOf(signal.state)
    signal.state = states[(currentStateIndex + 1) % states.length]
    const color = getColorByState(signal.state)

    // 更新光源颜色
    signal.light.color.setHex(color)

    // 尝试更新模型中 mesh 的颜色（如果模型支持）
    if (signal.mesh) {
      signal.mesh.traverse((child) => {
        if (child.isMesh) {
          // 尝试识别信号灯部分（通常名称包含 'light' 或 'signal'）
          if (child.material) {
            // 如果材质有 emissive 属性，修改它
            if (child.material.emissive) {
              child.material.emissive.setHex(color)
            }
            // 如果材质有 color 属性，也修改它
            if (child.material.color) {
              child.material.color.setHex(color)
            }
          }
        }
      })
    }
  })
  updateSignalUI()
}

// 更新信号灯 UI
function updateSignalUI() {
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

  const countEl = document.getElementById('signalCount')
  if (countEl) countEl.textContent = signals.length
}

// 列车动画
window.trainAnimation = function() {
  isTrainRunning = !isTrainRunning
}

// 自动旋转
window.toggleRotation = function() {
  autoRotate = !autoRotate
}

// 复位视角
window.resetView = function() {
  camera.position.set(80, 60, 80)
  controls.target.set(0, 0, 0)
  controls.update()
}

// 切换摄像头
window.switchCamera = function(cameraId) {
  // 移除所有tab的active类
  const tabs = document.querySelectorAll('.camera-tab')
  tabs.forEach(tab => tab.classList.remove('active'))

  // 隐藏所有摄像头内容
  const contents = document.querySelectorAll('.camera-content')
  contents.forEach(content => content.classList.remove('active'))

  // 激活选中的tab和内容
  const selectedTab = document.querySelector(`.camera-tab:nth-child(${cameraId})`)
  const selectedContent = document.getElementById(`camera${cameraId}`)

  if (selectedTab) selectedTab.classList.add('active')
  if (selectedContent) selectedContent.classList.add('active')

  console.log(`切换到监控${cameraId}`)
}

// 窗口大小调整
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
}

// 更新 UI
function updateUI() {
  // 更新系统状态
  const lastUpdate = document.getElementById('lastUpdate')
  if (lastUpdate) {
    lastUpdate.textContent = new Date().toLocaleString('zh-CN')
  }

  // 更新运行时间
  const uptime = document.getElementById('uptime')
  if (uptime) {
    const seconds = Math.floor((Date.now() - startTime) / 1000)
    uptime.textContent = `${seconds}s`
  }

  // 更新相机信息
  const camPos = document.getElementById('cameraPos')
  if (camPos) {
    camPos.textContent = `${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)}`
  }

  const camTarget = document.getElementById('cameraTarget')
  if (camTarget) {
    camTarget.textContent = `${controls.target.x.toFixed(0)}, ${controls.target.y.toFixed(0)}, ${controls.target.z.toFixed(0)}`
  }

  // 更新性能信息
  const fps = document.getElementById('fps')
  if (fps) {
    fps.textContent = '60 FPS'
  }

  const triangles = document.getElementById('triangles')
  if (triangles) {
    triangles.textContent = renderer.info.render.triangles.toLocaleString()
  }

  const drawCalls = document.getElementById('drawCalls')
  if (drawCalls) {
    drawCalls.textContent = renderer.info.render.calls
  }
}

// 动画循环
function animate() {
  requestAnimationFrame(animate)

  const delta = clock.getDelta()

  // 更新控制器
  controls.update()

  // 自动旋转
  if (autoRotate) {
    controls.autoRotate = true
    controls.autoRotateSpeed = 2.0
  } else {
    controls.autoRotate = false
  }

  // 列车动画
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

    // 计算方向
    const nextPoint = path.getPoint(((time + 0.01) % 1))
    train.lookAt(nextPoint)
  }

  // 更新动画混合器（如果火车模型有动画）
  if (mixer) {
    mixer.update(delta)
  }

  // 渲染
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)  // 渲染HTML标签
}

// 启动应用
init()
