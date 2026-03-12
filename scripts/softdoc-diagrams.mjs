export const diagramImageBaseRelative = './assets/diagrams'

export const diagramSpecs = [
  {
    id: 'use-case',
    title: '系统用例图',
    filename: '01-use-case.png',
    width: 2400,
    height: 1600,
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
  uc7 --> uc6`,
    description: '该图从使用者视角描述系统的核心功能边界。图中包含运维值守人员、信号维护人员、展示或调度人员以及外部监测设备四类参与者，并将其与 GIS 地理态势查看、设备孪生状态查看、大屏分析查看、湿度异常告警处置、寿命预测核查和遥测数据上传等关键用例对应起来。通过该图可以直观看出系统并不是单纯的展示页面，而是同时覆盖可视化展示、状态监测、告警联动和设备接入四个层面的综合平台。该图适合放在系统概述章节，用于说明系统服务对象和主要业务能力的对应关系。'
  },
  {
    id: 'business-flow',
    title: '总体业务流程图',
    filename: '02-business-flow.png',
    width: 2400,
    height: 1800,
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
  F --> M[读取全局联动状态与 Mock 数据]`,
    description: '该图描述系统从页面启动到数据联动完成的总体业务路径。用户首先打开单页应用首页，然后在地理信息可视化、数字孪生面板和大数据平台三个视图之间选择入口；与此同时，外部设备可通过上传接口进入遥测桥接服务，再由 WebSocket 将标准化遥测消息推送到前端。图中明确区分了用户操作链路和设备数据链路，其中 GIS 页面依赖缓存与模拟数据，大数据平台依赖全局联动状态和 Mock 数据，而 Three.js 孪生面板还承担实时遥测联动展示。该图用于说明系统主流程和数据流向，是需求分析与系统概述章节的重要补充。'
  },
  {
    id: 'architecture',
    title: '系统架构图',
    filename: '03-system-architecture.png',
    width: 2600,
    height: 1800,
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
  cesium --> cache`,
    description: '该图从总体架构层面展示了本项目的组成方式。浏览器用户通过 `App.vue` 顶层切换进入三个前端子模块：Cesium 地理信息模块、Three.js 孪生模块和 DataPanel 大数据模块。前端内部同时依赖本地接口层 `api.js`、模拟数据服务 `mockDataService.js`、全局联动状态 `simulationState.js`、浏览器缓存和 WebSocket 客户端。后端辅助服务由 `telemetry-bridge.js` 组成，负责接收外部设备上报并向前端广播。该图清晰展示了“前端可视化系统 + 轻量桥接服务”的技术形态，适合放在总体设计章节，体现系统层次结构、模块边界和主要通信关系。'
  },
  {
    id: 'deployment',
    title: '部署拓扑图',
    filename: '04-deployment-topology.png',
    width: 2400,
    height: 1400,
    definition: `flowchart LR
  subgraph Client[用户终端]
    browser[Chrome / Edge 浏览器]
  end
  subgraph FrontendNode[前端服务节点]
    vite[Vite 静态资源服务<br/>http://localhost:5173]
  end
  subgraph TelemetryNode[遥测桥接节点]
    telemetry[telemetry-bridge.js<br/>http://localhost:8080]
    ws[WS /ws]
    health[GET /telemetry/health]
    upload[POST /upload]
    upload --> telemetry
    ws --> telemetry
    health --> telemetry
  end
  sensor[外部传感器 / 采集设备]
  browser --> vite
  browser --> ws
  browser --> health
  sensor --> upload`,
    description: '该图描述系统在开发或演示环境下的基本部署拓扑。浏览器端通过 `http://localhost:5173` 访问 Vite 启动的前端服务，同时可通过 `ws://localhost:8080/ws` 或相关健康检查接口访问 Node.js 遥测桥接服务；外部传感器或采集设备则通过上传接口将 JSON 数据送入桥接服务。图中节点数量不多，但能够准确反映本项目当前采用的轻量部署模式，即前端静态资源服务与辅助遥测服务分离运行。该图适合用于运行环境和部署方式章节，帮助审阅人员理解系统在本地部署、联调和演示时的组成关系。'
  },
  {
    id: 'telemetry-flow',
    title: '监测联动流程图',
    filename: '05-telemetry-flow.png',
    width: 2600,
    height: 1500,
    definition: `flowchart LR
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
  K -->|否| M[保持正常显示]`,
    description: '该图聚焦于数字孪生页面内部的监测联动逻辑。ThreeView 组件启动后，首先读取本地参数和演示状态，然后建立 WebSocket 遥测连接；当没有收到遥测消息时，界面保持待机显示，一旦收到消息，则更新最近遥测数据和时间戳，并继续解析 `distance_m` 和 `water_active` 两类关键字段。之后根据距离阈值判断是否触发行人高亮与提示，根据涉水标志更新告警文字和样式。该图将页面级条件判断串联成完整流程，非常适合放入详细设计章节，用于解释前端界面的实时联动逻辑和状态流转机制。'
  },
  {
    id: 'telemetry-sequence',
    title: '遥测接入时序图',
    filename: '06-telemetry-sequence.png',
    width: 2600,
    height: 1600,
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
  Browser->>Twin: 响应式刷新告警、距离、涉水状态`,
    description: '该时序图说明遥测接入过程中的参与对象和调用顺序。外部设备首先通过 `POST /upload` 向桥接服务发送 JSON 数据，桥接服务在内部完成字段解析、标准化处理和必要校验后，向设备返回成功响应；随后桥接服务再通过 WebSocket 向浏览器侧推送 telemetry 主题消息，浏览器端的 `telemetrySocket.js` 更新连接状态和最近一次遥测对象，最终由 `ThreeView.vue` 响应式刷新界面中的距离、涉水和告警显示。该图特别适合放在接口设计或详细设计章节，用于补充普通流程图难以表达的时序关系。'
  },
  {
    id: 'weather-state',
    title: '恶劣天气与湿度异常状态图',
    filename: '07-weather-state.png',
    width: 2400,
    height: 1000,
    definition: `flowchart LR
  start((开始)) --> normal([正常展示])
  normal -- 启用恶劣天气 --> drill([恶劣天气演练])
  drill -- 湿度快速升至告警阈值 --> alarm([湿度告警])
  alarm -- 点击异常消除 / 处置 --> handling([处置中])
  handling -- 湿度回落至观察区间 --> observe([观察阶段])
  observe -- 关闭恶劣天气 --> normal`,
    description: '该状态图描述恶劣天气演练场景下湿度异常的状态变化路径。系统从“正常展示”状态开始，用户启用恶劣天气后进入演练状态，随着湿度值快速上升，当达到告警阈值时切换到“湿度告警”；在用户执行异常消除或处置操作后，系统进入“处置中”状态，并在湿度回落后进入“观察阶段”，最终在关闭恶劣天气后恢复到正常展示。该图适用于详细设计章节，用于说明全局状态同步、告警触发、处置反馈和恢复过程之间的连续关系。'
  },
  {
    id: 'entity-relationship',
    title: '数据对象 E-R 图',
    filename: '08-entity-relationship.png',
    width: 2600,
    height: 1800,
    definition: `erDiagram
  SIGNAL {
    int id PK
    string name
    string status
    float temperature
    float humidity
    float light_intensity
    float voltage
    float current
    float signal_strength
  }
  RAILWAY {
    string name PK
    string start_station
    string end_station
    int length_km
  }
  TRAIN_STATS {
    int passed_count
    int total_count
    float on_time_rate
    string next_train
  }
  TELEMETRY {
    string type
    string device
    string device_id
    long ts_ms
    float distance_cm
    float distance_m
    int water_active
  }
  WEATHER {
    float temperature
    float humidity
    float wind_speed
    float pressure
    float visibility
    string weatherType
  }
  AI_CONVERSATION {
    int id PK
    string session_id
    string role
    string content
    string created_at
  }
  LOG_ENTRY {
    int id PK
    string log_type
    string log_level
    string message
    string created_at
  }
  SIGNAL ||--o{ TELEMETRY : 接收状态上报
  SIGNAL }o--|| RAILWAY : 部署于线路场景
  RAILWAY ||--|| TRAIN_STATS : 汇总运营统计
  WEATHER ||--o{ SIGNAL : 影响运行环境
  AI_CONVERSATION }o--|| RAILWAY : 查询线路信息
  LOG_ENTRY }o--|| SIGNAL : 记录设备事件`,
    description: '该图以 E-R 方式整理了当前项目中具有代表性的数据对象及其关系。虽然系统当前没有持久化数据库，但前端内存对象、遥测对象、天气对象、列车统计对象、线路对象、AI 对话对象和日志对象之间依然存在稳定的数据结构关系。图中展示了 `SIGNAL` 与 `TELEMETRY`、`RAILWAY`、`WEATHER`、`LOG_ENTRY` 的关联，以及 `RAILWAY` 与 `TRAIN_STATS`、`AI_CONVERSATION` 的联系。该图的价值在于帮助审阅人员理解系统中“对象是如何被组织和联动”的，而不是误认为项目完全缺少数据设计。'
  }
].filter((item) => item.id !== 'weather-state')

export const screenshotImageBaseRelative = './assets/screenshots'

export const screenshotSpecs = [
  {
    id: 'twin-home',
    title: '首页默认孪生面板截图',
    filename: '01-home-twin.png',
    description: '该截图对应系统首页默认打开的数字孪生面板，入口为根地址首页。画面中展示了 X站101号信号机的三维孪生场景、轨道、山体、设备信息面板以及实时参数卡片，能够集中反映本系统“设备孪生 + 状态展示 + 操作控制”的核心特征。左侧区域重点体现行人距离感应器与信号机设备档案，中间区域体现 Three.js 三维建模场景和列车、轨道、人员对象，底部按钮体现复位视角、切换信号、列车行进和自动旋转等交互控制，右侧区域体现接入状态和实时参数曲线。该截图适合用作说明书中的首页界面展示，用于说明系统默认工作界面与核心业务对象。'
  },
  {
    id: 'gis-tab',
    title: '地理信息可视化页面截图',
    filename: '02-gis-tab.png',
    description: '该截图对应系统的地理信息可视化页面，入口为首页中的“地理信息可视化”页签。页面中心展示 Cesium 三维地球或线路地理场景，左右两侧则分布地理公告、震动监测、当前位置、天气指数、列车统计和地理态势等信息面板，体现系统对 GIS 可视化、地理态势分析和监测面板联动的综合能力。该页面不仅承担线路地理背景展示作用，还通过侧边统计面板将天气、震动、列车信息等内容整合到空间视图之中，使审阅人员可以直观看到系统如何把“地图、场景、监测、指标”统一在一个页面内。该截图适合在说明书的系统概述、总体设计和页面结构章节中使用。'
  },
  {
    id: 'data-tab',
    title: '大数据可视化平台截图',
    filename: '03-data-tab.png',
    description: '该截图对应大数据可视化平台页面，入口为首页中的“大数据可视化平台”页签。页面顶部展示系统标题、日期时间、天气状态和恶劣天气模拟按钮，中部和左右侧则集中展示气象监测、设备寿命预测、信号设备状态分布、实时调度命令、调度效率统计、设备监控、告警信息以及安全监控等内容。该页面的展示重点在于把多类业务指标以大屏形式整合到统一界面中，适合用于体现系统对综合态势分析、运维可视化和告警汇总展示的能力。截图中存在大量模块标题、数值卡片、图表和告警项，因此非常适合作为设计说明书中“综合展示页面”与“功能模块分区”的示例说明。'
  },
  {
    id: 'telemetry-health',
    title: '遥测桥接健康检查截图',
    filename: '04-telemetry-health.png',
    description: '该截图对应遥测桥接服务的健康检查接口页面，入口通常为 `http://localhost:8080/telemetry/health`。页面虽然是 JSON 结果，但其展示内容直接反映了后端桥接服务的运行状态，包括服务是否可用、监听端口、WebSocket 路径、上传路径、当前连接客户端数以及最近一次遥测数据概要。相较于纯前端页面，这类接口截图能够从另一个角度证明系统并非完全静态展示，而是具备辅助服务、接口输出和状态反馈能力。将该截图纳入说明书，可以补充说明系统的服务化支撑能力、接口可用性和运行验证结果，在“接口设计”或“测试与验证说明”章节中具有较高材料价值。'
  }
]

export const getDiagramById = (id) => diagramSpecs.find((item) => item.id === id)
export const getScreenshotById = (id) => screenshotSpecs.find((item) => item.id === id)

export const diagramImageMarkdown = (id) => {
  const item = getDiagramById(id)
  if (!item) return ''
  return `![${item.title}](${diagramImageBaseRelative}/${item.filename})`
}

export const screenshotImageMarkdown = (id) => {
  const item = getScreenshotById(id)
  if (!item) return ''
  return `![${item.title}](${screenshotImageBaseRelative}/${item.filename})`
}

export const buildFigureSection = (prefix, item, imageBaseRelative) => {
  if (!item) return ''
  const figureKind = imageBaseRelative.includes('screenshots') ? 'screenshot' : 'diagram'
  return `<figure class="doc-figure ${figureKind}-figure">
  <img class="figure-image ${figureKind}-image" src="${imageBaseRelative}/${item.filename}" alt="${item.title}" />
  <figcaption class="figure-caption">${prefix} ${item.title}</figcaption>
</figure>

${item.description}`
}
