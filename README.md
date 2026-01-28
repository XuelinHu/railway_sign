# 🚂 山区铁道信号灯数字孪生系统

<p align="center">
  <img height="20" src="https://img.shields.io/badge/Vite-7.3.1-%23646FF" />
  <img height="20" src="https://img.shields.io/badge/Cesium-1.137.0-%23ff00ff" />
  <img height="20" src="https://img.shields.io/badge/Three.js-0.182.0-%23ffffff" />
  <img height="20" src="https://img.shields.io/badge/License-ISC-blue" />
  <img height="20" src="https://img.shields.io/badge/platform-web-%23ff69b4" />
  <img height="20" src="https://img.shields.io/badge/status-active-success" />
</p>

基于 Vite + Cesium + Three.js 的山区铁道信号灯数字孪生可视化系统，提供真实地理信息和精细3D模型展示。

## ✨ 特性

- 🌍 **双视图展示** - Cesium 大地图（真实地理信息）和 Three.js 小地图（精细3D模型）
- 🚂 **列车模拟** - 实时列车运行模拟，支持沿轨道运动
- 🚦 **信号灯监控** - 实时监控多个信号灯状态，支持红/绿/黄三色切换
- 🗺️ **山区地形** - 中国西南山区地形，包含S形铁道
- 📊 **实时数据面板** - 50%透明度悬浮面板，展示运营统计、环境监测、系统状态
- 📹 **视频监控** - 集成 Bilibili 实时视频流
- 🎮 **交互控制** - 支持视角切换、信号控制、自动旋转等
- 🎨 **3D模型** - 集成 glb 模型（火车头、火车站、信号灯、铁轨）

## 📦 技术栈

- **构建工具**: Vite 7.3.1
- **GIS引擎**: Cesium 1.137.0
- **3D引擎**: Three.js 0.182.0
- **视频**: Bilibili 嵌入播放器
- **语言**: JavaScript ES6+

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000 查看入口页面，选择：
- **Cesium 大地图** - 真实地理信息系统
- **Three.js 小地图** - 精细3D场景

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 📁 项目结构

```
railway_sign/
├── index.html          # 入口页面（选择界面）
├── cesium.html         # Cesium 大地图页面
├── threejs.html        # Three.js 小地图页面
├── vite.config.js      # Vite 配置
├── package.json        # 项目配置
├── .gitignore         # Git 忽略文件
└── src/
    ├── cesium.js       # Cesium 应用逻辑
    ├── threejs.js      # Three.js 应用逻辑
    └── obj/            # 3D 模型文件
        ├── locomotive.glb    # 火车头模型
        ├── station.glb       # 火车站模型
        ├── sign.glb          # 信号灯模型
        ├── railway.glb       # 铁轨模型
        └── bridge.glb        # 桥梁模型
```

## 🎮 功能说明

### Cesium 大地图
- 真实地理信息系统，支持全球地形和卫星影像
- 中心位置：中国云南山区 (102.7°E, 25.0°N)
- 5个信号灯沿S形铁道分布
- 列车运行模拟
- 50%透明度数据监控面板

### Three.js 小地图
- 精细3D场景，白色背景明亮展示
- 集成 glb 模型：火车头、火车站、信号灯、铁轨
- 4个信号灯带点光源效果
- 实时性能监控（FPS、三角形数、绘制调用）
- Bilibili 视频流集成
- 支持自动旋转和视角控制

### 控制功能
- 🎯 **复位视角** - 恢复初始视角
- 🚦 **切换信号** - 手动切换所有信号灯状态
- 🚂 **列车动画** - 列车沿轨道运行模拟
- 🔄 **自动旋转** - 场景自动旋转展示

## 🎨 代码示例

### 初始化 Cesium

```javascript
import * as Cesium from 'cesium'

const viewer = new Cesium.Viewer('cesiumContainer', {
  terrainProvider: Cesium.createWorldTerrain(),
  baseLayer: Cesium.ImageryLayer.fromProviderAsync(
    Cesium.IonImageryProvider.fromAssetId(2)
  )
})
```

### 加载 GLB 模型

```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
loader.load('/src/obj/locomotive.glb', (gltf) => {
  const train = gltf.scene
  train.scale.set(2, 2, 2)
  train.position.set(-60, 0.5, -40)
  scene.add(train)
})
```

### 信号灯控制

```javascript
window.toggleSignals = function() {
  signals.forEach(signal => {
    const states = ['red', 'green', 'yellow']
    signal.state = states[(states.indexOf(signal.state) + 1) % states.length]
    signal.light.color.setHex(getColorByState(signal.state))
  })
}
```

## 📸 截图

> 入口页面：选择 Cesium 或 Three.js 视图

> Cesium 大地图：真实地理信息系统

> Three.js 小地图：精细3D场景和实时监控

## 🔧 配置说明

### Vite 配置

```javascript
import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [cesium()],
  server: {
    port: 3000,
    open: true
  }
})
```

### Cesium Ion Token

项目使用默认的 Cesium Ion 访问令牌。如需使用自己的令牌，请修改 `src/cesium.js`:

```javascript
Cesium.Ion.defaultAccessToken = 'YOUR_TOKEN_HERE'
```

## 📝 开发计划

- [ ] 添加更多3D模型（桥梁、隧道等）
- [ ] 实现 MQTT 数据接入
- [ ] 添加历史数据回放功能
- [ ] 优化模型加载性能
- [ ] 添加多语言支持

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[ISC](LICENSE)

## 📮 联系方式

- 项目地址：https://github.com/XuelinHu/railway_sign
- 问题反馈：https://github.com/XuelinHu/railway_sign/issues

---

⭐ 如果这个项目对你有帮助，请给个 Star！
