# 🚂 山区铁道信号灯数字孪生系统

<p align="center">
  <img height="20" alt="Vue 3.5.28" src="https://img.shields.io/badge/vue-3.5.28-4FC08D" />
  <img height="20" alt="Vite 7.3.1" src="https://img.shields.io/badge/vite-7.3.1-646CFF" />
  <img height="20" alt="CesiumJS 1.137.0" src="https://img.shields.io/badge/cesiumjs-1.137.0-6CADDF" />
  <img height="20" alt="Three.js 0.182.0" src="https://img.shields.io/badge/three.js-0.182.0-000000" />
  <img height="20" alt="ECharts 6.0.0" src="https://img.shields.io/badge/echarts-6.0.0-AA344D" />
  <img height="20" alt="MQTT 5.14.1" src="https://img.shields.io/badge/mqtt-5.14.1-660066" />
  <img height="20" alt="License GPL-2.0" src="https://img.shields.io/badge/license-GPL--2.0-3DA639" />
</p>

基于 Vite + Cesium + Three.js 的山区铁道信号灯数字孪生可视化系统，提供真实地理信息和精细3D模型展示，
并配套**完整用户体系**、**管理台**与**可语音对话的智能体**。

## ✨ 特性

- 🌍 **双视图展示** - Cesium 大地图（真实地理信息）和 Three.js 小地图（精细3D模型）
- 🚂 **列车模拟** - 实时列车运行模拟，支持沿轨道运动
- 🚦 **信号灯监控** - 实时监控多个信号灯状态，支持红/绿/黄三色切换
- 🗺️ **山区地形** - 中国西南山区地形，包含S形铁道
- 📊 **实时数据面板** - 50%透明度悬浮面板，展示运营统计、环境监测、系统状态
- 📹 **视频监控** - 集成 Bilibili 实时视频流
- 🎮 **交互控制** - 支持视角切换、信号控制、自动旋转等
- 🎨 **3D模型** - 集成 glb 模型（火车头、火车站、信号灯、铁轨）
- 👤 **用户全流程** - 注册、登录（图形验证码）、找回/重置密码、修改密码、个人中心、登录记录
- 🛠️ **管理台** - 12 个菜单（用户/角色/信号机/告警/工单/遥测/登录日志/操作日志/智能体会话/模型/设置），**全部服务端分页**
- 🤖 **智能体** - 右下角浮动按钮弹框，SSE 流式实时问答，自动注入实时遥测与告警上下文
- 🎙️ **语音播报与语音对话** - 读出回答；点麦克风说话提问，安卓端走原生麦克风，浏览器端自动降级
- 🧠 **统一模型后台** - 通过 Ollama 统一调度 qwen3 / deepseek-r1 等国产开源模型，下拉切换、一键下载

## 📦 技术栈

- **构建工具**: Vite 7.3.1
- **前端框架**: Vue 3.5 + vue-router 4（Hash 路由，静态托管无需 rewrite）
- **GIS引擎**: Cesium 1.137.0
- **3D引擎**: Three.js 0.182.0
- **视频**: Bilibili 嵌入播放器
- **后端**: Node.js 原生 `node:http` + `node:sqlite` + `node:crypto`（**零第三方依赖**）
- **模型服务**: Ollama（qwen3 / deepseek-r1 等）
- **语音服务**: Python + sherpa-onnx SenseVoice（离线识别）+ edge-tts（神经网络合成）
- **语言**: JavaScript ES6+ / Python 3.9+

## 🚀 快速开始

### 环境要求

- Node.js >= 22（后端使用内置 `node:sqlite`，建议 Node 24）
- npm >= 8.0.0
- Python >= 3.9（仅语音服务需要）

### 安装依赖

```bash
npm install
```

### 启动全部服务

```bash
npm run api        # 统一后台 API，默认 8037（首次启动自动建库 + 灌入演示数据）
npm run telemetry  # 遥测桥接，默认 8036
npm run dev        # 前端开发服务器，4028

# 或一条命令起前三个：
npm run dev:all
```

访问 http://localhost:4028 ，使用演示账号登录（`admin` / `Admin@123`）后即可看到：
- **Cesium 大地图** - 真实地理信息系统
- **Three.js 小地图** - 精细3D场景
- **数据可视化平台** - ECharts 统计面板
- 右上角进入**管理台**，右下角 🤖 打开**智能体**

### 语音服务（可选）

不启动语音服务时，前端会自动回落到浏览器自带语音能力；启动后可用离线中文识别与神经网络音色播报。

```bash
pip install -r voice_service/requirements.txt
bash voice_service/download_model.sh   # 下载 SenseVoice 模型，约 250MB
npm run voice                          # 默认 127.0.0.1:8039
```

安卓端（WebView 调用原生麦克风）集成方法见 [`docs/安卓端语音集成.md`](docs/安卓端语音集成.md)。

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

> 前端通过 Vite 代理以**同源**方式访问后端（`/api` → `127.0.0.1:8037`），`dev` 与 `preview` 都已配置，
> 因此生产环境同样无跨域问题。

### 用 PM2 常驻

```bash
./scripts/start-pm2.sh all     # web + api + voice + telemetry
./scripts/start-pm2.sh api     # 只起统一后台
```

## 📁 项目结构

```
railway_sign/
├── index.html              # SPA 入口
├── vite.config.js          # Vite 配置（含 /api 代理）
├── package.json            # 项目配置与脚本
├── AGENT.md                # 面向 AI 协作者的项目说明
├── server/
│   ├── api-server.js       # 统一后台 API 入口（8037）
│   ├── telemetry-bridge.js # 遥测桥接（8036，含向后台转发）
│   └── api/
│       ├── lib/            # db / secure / http / paths
│       └── routes/         # auth / admin / ai / telemetry / voice
├── voice_service/          # 语音边车（8039）
│   ├── voice_server.py     # ASR + TTS HTTP 服务
│   ├── requirements.txt
│   └── download_model.sh
├── scripts/
│   ├── start-pm2.sh        # PM2 启动脚本
│   ├── start-voice.mjs     # 语音服务启动包装
│   └── test-api.mjs        # 后端接口自测（71 项）
├── docs/
│   ├── 安卓端语音集成.md
│   └── android-sample/     # 可直接拷贝的 Kotlin 示例
└── src/
    ├── main.js             # 应用入口
    ├── App.vue             # 根组件（路由出口 + 智能体入口）
    ├── router/             # 路由与登录/角色守卫
    ├── services/           # http / auth / ai / voice
    ├── styles/theme.css    # 深色科技风样式变量
    ├── layouts/            # AdminLayout
    ├── components/
    │   ├── common/         # AppModal / DataTable / Pagination / AppToast
    │   └── agent/          # AgentLauncher / AgentDialog / VoicePanel / ModelPicker
    ├── views/
    │   ├── PortalHome.vue  # 原有三个标签页
    │   ├── auth/           # 登录 / 注册 / 找回 / 重置
    │   ├── profile/        # 个人中心
    │   └── admin/          # 12 个管理台菜单
    └── obj/                # 3D 模型文件
        ├── locomotive.glb  # 火车头模型
        ├── station.glb     # 火车站模型
        ├── sign.glb        # 信号灯模型
        ├── railway.glb     # 铁轨模型
        └── bridge.glb      # 桥梁模型
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

本项目使用 GNU General Public License v2.0（GPL-2.0）开源，详见 [LICENSE](LICENSE)。

## 📮 联系方式

- 项目地址：https://github.com/XuelinHu/railway_sign
- 问题反馈：https://github.com/XuelinHu/railway_sign/issues

---

⭐ 如果这个项目对你有帮助，请给个 Star！
