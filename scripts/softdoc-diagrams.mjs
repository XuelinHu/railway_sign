export const diagramImageBaseRelative = '../.tmp/softdocs/diagrams'

export const diagramSpecs = [
  {
    id: 'use-case',
    title: '系统用例图',
    filename: '01-use-case.png',
    width: 1800,
    height: 1200,
    definition: `flowchart LR
  user1[运维值守人员] --> uc1((查看 GIS 地理态势))
  user1 --> uc2((查看设备孪生状态))
  user1 --> uc3((查看大屏分析结果))
  user1 --> uc4((处理湿度异常告警))
  user2[信号维护人员] --> uc2
  user2 --> uc5((查看寿命预测))
  user2 --> uc6((核查遥测告警))
  user3[展示/调度人员] --> uc1
  user3 --> uc3
  device[外部监测设备] --> uc7((上传遥测数据))
  uc7 --> uc6`
  },
  {
    id: 'business-flow',
    title: '总体业务流程图',
    filename: '02-business-flow.png',
    width: 1800,
    height: 1400,
    definition: `flowchart TD
  A[用户打开系统] --> B[进入单页应用首页]
  B --> C{选择视图}
  C -->|GIS| D[加载 Cesium 地图与面板]
  C -->|孪生| E[加载 Three.js 场景与参数面板]
  C -->|大屏| F[加载大数据可视化面板]
  E --> G[建立 WebSocket 遥测连接]
  H[外部设备 POST /upload] --> I[遥测桥接服务标准化数据]
  I --> J[WS 广播 telemetry 消息]
  J --> G
  G --> K[界面刷新距离/涉水/告警信息]
  D --> L[读取缓存与模拟数据]
  F --> M[读取全局联动状态与 Mock 数据]`
  },
  {
    id: 'architecture',
    title: '系统架构图',
    filename: '03-system-architecture.png',
    width: 2200,
    height: 1500,
    definition: `flowchart TB
  user[浏览器用户]
  device[外部监测设备]
  subgraph Frontend[前端单页应用]
    app[App.vue 顶层切换]
    cesium[CesiumView 地理信息模块]
    three[ThreeView 孪生模块]
    data[DataPanel 大屏模块]
    api[api.js 本地数据接口]
    mock[mockDataService.js 模拟数据服务]
    state[simulationState.js 全局联动状态]
    wsclient[telemetrySocket.js WS 客户端]
    cache[localStorage 本地缓存]
  end
  subgraph Backend[辅助服务]
    bridge[telemetry-bridge.js]
  end
  user --> app
  app --> cesium
  app --> three
  app --> data
  cesium --> api
  three --> api
  data --> mock
  cesium --> state
  three --> state
  data --> state
  three --> wsclient
  wsclient --> bridge
  device --> bridge
  cesium --> cache`
  },
  {
    id: 'deployment',
    title: '部署拓扑图',
    filename: '04-deployment-topology.png',
    width: 1800,
    height: 1000,
    definition: `flowchart LR
  browser[Chrome / Edge 浏览器]
  vite[Vite 前端服务:5173]
  telemetry[Node 遥测桥接:8080]
  sensor[外部传感器 / 采集设备]
  browser --> vite
  browser --> telemetry
  sensor --> telemetry`
  },
  {
    id: 'telemetry-flow',
    title: '监测联动流程图',
    filename: '05-telemetry-flow.png',
    width: 1800,
    height: 1400,
    definition: `flowchart TD
  A[ThreeView 启动] --> B[读取本地参数与演示状态]
  B --> C[建立 WebSocket 连接]
  C --> D{收到 telemetry 消息?}
  D -->|否| E[保持待机状态]
  D -->|是| F[更新 lastTelemetry 与时间戳]
  F --> G[解析 distance_m 与 water_active]
  G --> H{距离 < 2 米?}
  H -->|是| I[触发行人高亮与提示]
  H -->|否| J[维持普通状态]
  G --> K{water_active = 1?}
  K -->|是| L[更新涉水文本与样式]
  K -->|否| M[保持正常显示]`
  },
  {
    id: 'telemetry-sequence',
    title: '遥测接入时序图',
    filename: '06-telemetry-sequence.png',
    width: 2200,
    height: 1200,
    definition: `sequenceDiagram
  participant Device as 外部设备
  participant Bridge as telemetry-bridge.js
  participant Browser as telemetrySocket.js
  participant Twin as ThreeView.vue
  Device->>Bridge: POST /upload (JSON)
  Bridge->>Bridge: 解析与标准化字段
  Bridge-->>Device: { ok: true }
  Bridge->>Browser: WS 推送 telemetry
  Browser->>Browser: 更新 telemetryConnected / lastTelemetry
  Browser->>Twin: 响应式刷新告警、距离、涉水状态`
  },
  {
    id: 'weather-state',
    title: '恶劣天气与湿度异常状态图',
    filename: '07-weather-state.png',
    width: 1800,
    height: 1200,
    definition: `stateDiagram-v2
  [*] --> 正常展示
  正常展示 --> 恶劣天气演练 : 启用恶劣天气
  恶劣天气演练 --> 湿度告警 : 湿度快速升至告警阈值
  湿度告警 --> 处置中 : 点击异常消除 / 处置
  处置中 --> 观察阶段 : 湿度回落至观察区间
  观察阶段 --> 正常展示 : 关闭恶劣天气`
  }
]

export const getDiagramById = (id) => diagramSpecs.find((item) => item.id === id)

export const diagramImageMarkdown = (id) => {
  const item = getDiagramById(id)
  if (!item) return ''
  return `![${item.title}](${diagramImageBaseRelative}/${item.filename})`
}
