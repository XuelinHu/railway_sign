import fs from 'node:fs/promises'
import path from 'node:path'
import {
  buildFigureSection,
  diagramImageBaseRelative,
  diagramSpecs,
  screenshotImageBaseRelative,
  screenshotSpecs
} from './softdoc-diagrams.mjs'

const root = process.cwd()
const docsDir = path.join(root, 'docs')
const finalName = '铁路信号设备数字孪生系统'
const version = 'V1.0'
const today = new Date().toLocaleDateString('zh-CN')

const codeGroups = [
  {
    title: '基础层',
    intro: '基础层包含应用入口、顶层布局、构建配置与演示场景参数，负责前端应用装配、界面入口组织以及全局基础配置。',
    files: [
      'index.html',
      'vite.config.js',
      'src/main.js',
      'src/App.vue',
      'src/config/demoScenario.js'
    ]
  },
  {
    title: '数据与服务层',
    intro: '数据与服务层负责本地模拟数据生成、前端数据访问封装、跨视图状态同步、遥测 WebSocket 连接以及组合式数据调用。',
    files: [
      'src/services/api.js',
      'src/services/mockDataService.js',
      'src/services/simulationState.js',
      'src/services/telemetrySocket.js',
      'src/composables/useApiData.js'
    ]
  },
  {
    title: '表现层',
    intro: '表现层包括三大主视图及其子面板组件，用于实现 Cesium 地理可视化、Three.js 数字孪生展示和大数据可视化界面。',
    files: [
      'src/components/CesiumView.vue',
      'src/components/ThreeView.vue',
      'src/components/DataPanel.vue',
      'src/components/datapanel/LeftPanel.vue',
      'src/components/datapanel/CenterPanel.vue',
      'src/components/datapanel/RightPanel.vue'
    ]
  },
  {
    title: '参考与辅助层',
    intro: '参考与辅助层包括早期独立脚本版本和后端遥测桥接服务，用于保留演进痕迹并支撑外部设备数据接入。',
    files: [
      'src/js/cesium.js',
      'src/js/threejs.js',
      'server/telemetry-bridge.js',
      'package.json'
    ]
  }
]

const fileDescriptions = {
  'index.html': '前端单页应用挂载点与页面基础容器。',
  'vite.config.js': 'Vite 构建配置，集成 Vue 与 Cesium 插件。',
  'src/main.js': 'Vue 应用入口，挂载根组件。',
  'src/App.vue': '应用顶层布局与三类主视图切换入口。',
  'src/config/demoScenario.js': '演示场景名称、站点、告警文本等基础业务常量。',
  'src/services/api.js': '前端本地内存数据服务，提供信号设备、天气、地震、统计、对话、日志等接口。',
  'src/services/mockDataService.js': '大数据面板模拟数据生成器，负责设备、天气、趋势、寿命和告警数据构造。',
  'src/services/simulationState.js': '跨页面共享的恶劣天气、湿度告警和处置状态同步模块。',
  'src/services/telemetrySocket.js': '浏览器端 WebSocket 遥测连接、重连与最新数据缓存模块。',
  'src/composables/useApiData.js': '组合式 API 数据调用封装，统一 loading、error 与数据状态。',
  'src/components/CesiumView.vue': 'Cesium 地理信息可视化主界面，含地图、巡航、气象、面板、AI 对话和缓存逻辑。',
  'src/components/ThreeView.vue': 'Three.js 数字孪生主界面，含信号机模型、列车动画、视频监控和遥测联动。',
  'src/components/DataPanel.vue': '大数据可视化总控页面，负责顶部信息、全局告警和左右中子面板联动。',
  'src/components/datapanel/LeftPanel.vue': '左侧环境与传感器状态面板。',
  'src/components/datapanel/CenterPanel.vue': '中部调度总览、寿命预测和线路态势面板。',
  'src/components/datapanel/RightPanel.vue': '右侧设备统计、告警列表和运维概览面板。',
  'src/js/cesium.js': '早期 Cesium 独立脚本版本，保留地图能力演进参考。',
  'src/js/threejs.js': '早期 Three.js 独立脚本版本，保留三维孪生能力演进参考。',
  'server/telemetry-bridge.js': 'Node.js 遥测桥接服务，提供 HTTP 接收与 WebSocket 广播。',
  'package.json': '项目依赖与开发命令配置。'
}

const groupIndexTitle = {
  基础层: '3',
  数据与服务层: '4',
  表现层: '5',
  参考与辅助层: '6'
}

const readUtf8 = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8')
const lineCount = (text) => text.split(/\r?\n/).length
const exists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}
const extLang = (relativePath) => {
  if (relativePath.endsWith('.vue')) return 'vue'
  if (relativePath.endsWith('.js') || relativePath.endsWith('.mjs')) return 'javascript'
  if (relativePath.endsWith('.json')) return 'json'
  if (relativePath.endsWith('.html')) return 'html'
  if (relativePath.endsWith('.txt')) return 'text'
  return ''
}

const allFiles = codeGroups.flatMap((group) => group.files)
const fileContents = new Map()
const fileStats = []

for (const relativePath of allFiles) {
  const content = await readUtf8(relativePath)
  fileContents.set(relativePath, content)
  fileStats.push({
    path: relativePath,
    lines: lineCount(content)
  })
}

const totalLines = fileStats.reduce((sum, item) => sum + item.lines, 0)
const srcOnlyLines = fileStats.filter((item) => item.path.startsWith('src/')).reduce((sum, item) => sum + item.lines, 0)

const designInventoryFiles = [
  'src/components/CesiumView.vue',
  'src/components/ThreeView.vue',
  'src/components/DataPanel.vue',
  'src/components/datapanel/LeftPanel.vue',
  'src/components/datapanel/CenterPanel.vue',
  'src/components/datapanel/RightPanel.vue',
  'src/services/api.js',
  'src/services/mockDataService.js',
  'src/services/simulationState.js',
  'src/services/telemetrySocket.js',
  'src/composables/useApiData.js',
  'server/telemetry-bridge.js'
]

const unique = (arr) => [...new Set(arr)]

const extractFunctionNames = (content) => {
  const patterns = [
    /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
    /(?:^|\n)\s*(?:export\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g
  ]
  const names = []
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      names.push(match[1])
    }
  }
  return unique(names)
}

const extractReactiveNames = (content) => {
  const pattern = /(?:^|\n)\s*const\s+([A-Za-z0-9_]+)\s*=\s*(?:ref|computed)\(/g
  const names = []
  let match
  while ((match = pattern.exec(content)) !== null) {
    names.push(match[1])
  }
  return unique(names)
}

const buildMarkdownTable = (headers, rows, caption = '') => {
  const head = `| ${headers.join(' | ')} |`
  const split = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n')
  const blocks = []
  if (caption) {
    blocks.push(`<div class="table-caption">${caption}</div>`)
  }
  blocks.push([head, split, body].join('\n'))
  return blocks.join('\n\n')
}

const pageMatrixTable = buildMarkdownTable(
  ['页面/视图', '入口位置', '主要内容', '主要交互'],
  [
    ['地理信息可视化', '`src/App.vue` 顶层 Tab', 'Cesium 地图、地理态势、天气与地震面板、AI 对话', '复位视角、巡航控制、恶劣天气模拟、面板显示切换'],
    ['铁路信号设备孪生面板', '`src/App.vue` 顶层 Tab', 'Three.js 三维设备、多信号机场景、设备弹窗、参数曲线', '切换信号、控制列车、故障联动、电源屏与设备监测查看'],
    ['大数据可视化平台', '`src/App.vue` 顶层 Tab', '环境监测、设备统计、告警信息、寿命预测、调度信息', '恶劣天气模拟、异常消除、筛选告警、缩放寿命图'],
    ['左侧环境面板', '`src/components/datapanel/LeftPanel.vue`', '气象监测、传感器列表、环境指标', '趋势查看、传感器状态浏览'],
    ['中部调度面板', '`src/components/datapanel/CenterPanel.vue`', '线路总览、寿命预测、调度命令、趋势统计', '缩放拖拽、最小地图定位、全屏显示'],
    ['右侧告警面板', '`src/components/datapanel/RightPanel.vue`', '设备监控、告警列表、安全监控、工单信息', '告警筛选、处理状态查看']
  ],
  '表 13-1 页面与菜单矩阵'
)

const envVarTable = buildMarkdownTable(
  ['变量名', '作用', '默认值/现状', '使用位置'],
  [
    ['`VITE_CESIUM_ION_TOKEN`', '配置 Cesium Ion Token', '未配置时回退到组件内置 token', '`src/components/CesiumView.vue`'],
    ['`VITE_TELEMETRY_WS_URL`', '配置浏览器端遥测 WebSocket 地址', '`ws://localhost:8080/ws`', '`src/services/telemetrySocket.js`'],
    ['`VITE_STREAM_URL`', '配置视频监控流地址', '未配置时视频卡片显示“未配置”', '`src/components/ThreeView.vue`'],
    ['`TELEMETRY_PORT`', '配置遥测桥接服务监听端口', '`8080`', '`server/telemetry-bridge.js`'],
    ['`TELEMETRY_WS_PATH`', '配置 WebSocket 路径', '`/ws`', '`server/telemetry-bridge.js`'],
    ['`TELEMETRY_UPLOAD_PATH`', '配置上传路径', '`/upload`', '`server/telemetry-bridge.js`'],
    ['`TELEMETRY_MAX_BODY_BYTES`', '限制上传请求体大小', '`32768`', '`server/telemetry-bridge.js`']
  ],
  '表 14-1 环境变量清单'
)

const npmScriptTable = buildMarkdownTable(
  ['命令', '说明', '输出'],
  [
    ['`npm run dev`', '启动 Vite 前端开发服务器', '本地单页应用页面'],
    ['`npm run telemetry`', '启动 Node.js 遥测桥接服务', 'HTTP 上传接口与 WebSocket 服务'],
    ['`npm run dev:all`', '并行启动前端与遥测服务', '适用于联调演示'],
    ['`npm run build`', '生成前端静态构建产物', '用于部署的前端资源'],
    ['`npm run preview`', '预览构建结果', '本地预览页面']
  ],
  '表 14-2 启动与构建命令清单'
)

const fileMatrixTable = buildMarkdownTable(
  ['文件', '行数', '职责说明'],
  fileStats.map((item) => [item.path, String(item.lines), fileDescriptions[item.path] || '系统相关文件']),
  '表 15-1 主要源码文件职责矩阵'
)

const functionCatalogSection = designInventoryFiles.map((relativePath) => {
  const names = extractFunctionNames(fileContents.get(relativePath) || '')
  const rows = names.map((name, index) => [String(index + 1), name])
  return `### ${relativePath}\n\n${buildMarkdownTable(['序号', '函数/方法名'], rows, `${relativePath} 函数目录表`)}`
}).join('\n\n')

const reactiveCatalogFiles = [
  'src/components/CesiumView.vue',
  'src/components/ThreeView.vue',
  'src/components/DataPanel.vue',
  'src/components/datapanel/LeftPanel.vue',
  'src/components/datapanel/CenterPanel.vue',
  'src/components/datapanel/RightPanel.vue',
  'src/services/telemetrySocket.js',
  'src/services/simulationState.js'
]

const reactiveCatalogSection = reactiveCatalogFiles.map((relativePath) => {
  const names = extractReactiveNames(fileContents.get(relativePath) || '')
  const rows = names.map((name, index) => [String(index + 1), name])
  return `### ${relativePath}\n\n${buildMarkdownTable(['序号', '响应式变量'], rows, `${relativePath} 响应式变量目录表`)}`
}).join('\n\n')

const visualAssetRows = [
  ['1', '图 3-1', '系统用例图', 'docs/assets/diagrams/01-use-case.png', '系统概述'],
  ['2', '图 3-2', '总体业务流程图', 'docs/assets/diagrams/02-business-flow.png', '系统概述'],
  ['3', '图 4-1', '系统架构图', 'docs/assets/diagrams/03-system-architecture.png', '总体设计'],
  ['4', '图 4-2', '部署拓扑图', 'docs/assets/diagrams/04-deployment-topology.png', '总体设计'],
  ['5', '图 4-3', '首页默认孪生面板截图', 'docs/assets/screenshots/01-home-twin.png', '界面设计'],
  ['6', '图 4-4', '地理信息可视化页面截图', 'docs/assets/screenshots/02-gis-tab.png', '界面设计'],
  ['7', '图 4-5', '大数据可视化平台截图', 'docs/assets/screenshots/03-data-tab.png', '界面设计'],
  ['8', '图 5-1', '监测联动流程图', 'docs/assets/diagrams/05-telemetry-flow.png', '详细设计'],
  ['9', '图 5-2', '遥测接入时序图', 'docs/assets/diagrams/06-telemetry-sequence.png', '详细设计'],
  ['10', '图 6-1', '数据对象 E-R 图', 'docs/assets/diagrams/08-entity-relationship.png', '数据设计'],
  ['11', '图 7-1', '遥测桥接健康检查截图', 'docs/assets/screenshots/04-telemetry-health.png', '接口设计']
]

const visualAssetIndexSection = `
## 18 附录六：图形与截图材料索引

${buildMarkdownTable(['序号', '图号', '名称', '文件路径', '所属章节'], visualAssetRows, '表 18-1 图形与截图材料索引表')}

本附录用于对设计说明书中使用的系统图、流程图、部署图、E-R 图以及界面截图进行集中索引说明，便于在材料核查、PDF 抽检和后续重新导出时快速定位对应的原始文件。表中按图号给出文件路径与所属章节，能够直接对应到设计说明书正文中的图题、图注与说明文字，确保图文关系一致、章节引用一致、归档文件一致。

从材料组织方式看，系统结构类图形统一放置在 \`docs/assets/diagrams\` 目录下，界面运行结果截图统一放置在 \`docs/assets/screenshots\` 目录下。这样处理的目的，是在清理临时目录后仍然可以保证 Markdown 源文件与最终 PDF 指向稳定的正式资产路径，不依赖临时缓存或中间生成目录，也不会因为后续清理动作导致文档内图片丢失或失效。

从复核方式看，审阅人员可先根据本附录核对图号、名称和章节，再逐项检查正文中的图题位置、图像清晰度和说明文字完整性。对于系统图，应重点核对结构关系、箭头方向与节点名称是否与正文描述一致；对于界面截图，应重点核对截图内容是否真实对应当前项目运行结果、文字是否清晰可辨、是否存在过度拉伸或缩放失真。本附录同时为后续更新 Skill 流程提供了明确的资产清单基础。
`

const getDiagramSection = (id, prefix) => buildFigureSection(prefix, diagramSpecs.find((item) => item.id === id), diagramImageBaseRelative)
const getScreenshotSection = (id, prefix) => buildFigureSection(prefix, screenshotSpecs.find((item) => item.id === id), screenshotImageBaseRelative)

const useCaseDiagram = `
### 3.5 系统用例图

${getDiagramSection('use-case', '图 3-1')}

### 3.6 总体业务流程图

${getDiagramSection('business-flow', '图 3-2')}
`

const architectureDiagrams = `
### 4.6 系统架构图

${getDiagramSection('architecture', '图 4-1')}

### 4.7 部署拓扑图

${getDiagramSection('deployment', '图 4-2')}
`

const detailedDesignDiagrams = `
### 5.8 监测联动流程图

${getDiagramSection('telemetry-flow', '图 5-1')}

### 5.9 遥测接入时序图

${getDiagramSection('telemetry-sequence', '图 5-2')}

### 5.10 恶劣天气与湿度异常状态图

${getDiagramSection('weather-state', '图 5-3')}
`

const mainPageScreenshotSections = `
### 4.8 主要页面界面截图

${getScreenshotSection('twin-home', '图 4-3')}

${getScreenshotSection('gis-tab', '图 4-4')}

${getScreenshotSection('data-tab', '图 4-5')}
`

const interfaceScreenshotSection = `
### 7.6 接口运行截图

${getScreenshotSection('telemetry-health', '图 7-1')}
`

const erDiagramSection = `
### 6.6 数据对象关系图

${getDiagramSection('entity-relationship', '图 6-1')}
`

const detailedAppendices = `
<div class="page-break"></div>

## 13 附录一：页面与菜单矩阵

${pageMatrixTable}

<div class="page-break"></div>

## 14 附录二：部署、环境变量与运行命令

### 14.1 环境变量清单

${envVarTable}

### 14.2 启动与构建命令清单

${npmScriptTable}

<div class="page-break"></div>

## 15 附录三：主要源码文件职责矩阵

${fileMatrixTable}

<div class="page-break"></div>

## 16 附录四：核心函数目录

${functionCatalogSection}

<div class="page-break"></div>

## 17 附录五：主要响应式状态目录

${reactiveCatalogSection}

<div class="page-break"></div>

${visualAssetIndexSection}
`

const filteredDetailedDesignDiagrams = detailedDesignDiagrams
  .replace(/\n### 5\.10[\s\S]*?\$\{getDiagramSection\('weather-state',\s*'[^']*'\)\}\n/, '\n')

const buildEnhancedDesignDoc = (baseDoc) => {
  let enhanced = baseDoc
  enhanced = enhanced.replace('## 4 总体设计', `${useCaseDiagram}\n\n## 4 总体设计`)
  enhanced = enhanced.replace('## 5 详细设计', `${architectureDiagrams}\n\n${mainPageScreenshotSections}\n\n## 5 详细设计`)
  enhanced = enhanced.replace('## 6 数据设计', `${filteredDetailedDesignDiagrams}\n\n## 6 数据设计`)
  enhanced = enhanced.replace('## 7 接口设计', `${erDiagramSection}\n\n## 7 接口设计`)
  enhanced = enhanced.replace('## 8 运行环境设计', `${interfaceScreenshotSection}\n\n## 8 运行环境设计`)
  enhanced = enhanced.replace(`文档整理日期：${today}`, `${detailedAppendices}\n\n文档整理日期：${today}`)
  enhanced = enhanced.replace(/\n### 5\.10 恶劣天气与湿度异常状态图[\s\S]*?(?=\n## 6 数据设计)/, '\n\n')
  enhanced = enhanced.replace(/\| 10 \| 图 5-3 \| 恶劣天气与湿度异常状态图 \| docs\/assets\/diagrams\/07-weather-state\.png \| 详细设计 \|\n/g, '')
  return enhanced
}

const statsTable = fileStats
  .map((item, index) => `${index + 1}. ${item.path}：${item.lines} 行`)
  .join('\n')

const softwareNameDoc = `# 软件名称候选与首选说明

## 1. 候选名称

1. 铁路信号数字孪生监测与可视化分析平台
2. 铁路信号设备数字孪生监测平台
3. 铁路信号运行状态可视化监测分析系统
4. 轨道交通信号设备数字孪生展示与预警平台
5. 山区铁路信号智能监测可视化平台

## 2. 首选名称

${finalName}

## 3. 首选理由

- 该名称与现有 \`docs/information.txt\` 中已采用的软件名称保持一致，便于后续材料统一。
- 名称同时覆盖铁路信号、数字孪生、监测、可视化分析四个核心特征，能够准确反映系统业务范围。
- 相比“管理系统”类名称，该名称更贴合当前项目的展示、监测、预警和分析一体化定位。
- 名称表述正式、客观，适合中国软件著作权登记场景。
`

const extractionDoc = `# 项目材料关键信息提取

## 1. 材料范围

- 基础说明材料：\`README.md\`、\`AGENT.md\`、\`docs/information.txt\`
- 前端源码：\`src/\` 目录下 Vue 组件、服务模块、组合式函数、演示配置与早期脚本
- 辅助服务：\`server/telemetry-bridge.js\`
- 工程配置：\`package.json\`、\`vite.config.js\`、\`index.html\`

## 2. 系统名称

- 统一名称：${finalName}
- 版本号：${version}
- 软件类别：应用软件

## 3. 项目背景与建设目标

- 项目面向轨道交通与铁路信号监测运维场景，用于展示山区铁路区间的地理态势、设备孪生和综合监测分析能力。
- 建设目标包括：实现信号设备三维可视化、地理场景展示、恶劣天气演练、遥测接入、告警联动和大数据分析展示。
- 系统当前更偏向演示验证与可视化呈现，核心数据以本地模拟和前端缓存为主，遥测桥接用于接入外部设备上报数据。

## 4. 用户角色

- 运维值守人员：查看设备状态、环境参数、告警信息和寿命预测结果。
- 信号维护人员：关注信号机湿度、温度、电压、电流、信号强度及异常处置建议。
- 调度或展示人员：查看线路态势、列车运行、GIS 场景巡航和综合大屏。
- 外部设备接入方：通过 HTTP 上报遥测数据，由系统桥接后广播到前端页面。

## 5. 功能模块

### 5.1 地理信息可视化模块

- 基于 Cesium 构建三维地图场景。
- 提供站区定位、相机巡航、信标波纹、恶劣天气模拟、地震/天气趋势展示。
- 提供 AI 对话演示、环境信息展示和本地缓存恢复。

### 5.2 信号设备数字孪生模块

- 基于 Three.js 构建信号机及轨道三维场景。
- 提供信号灯状态切换、列车沿轨动画、标签展示、行人靠近演示和音频提示。
- 接入 WebSocket 遥测数据，根据距离和涉水状态刷新界面。
- 提供多监控点视频画面接入入口，依赖 \`VITE_STREAM_URL\` 环境变量。

### 5.3 大数据可视化模块

- 以大屏方式展示环境、设备、运维、调度和寿命预测信息。
- 支持湿度异常告警弹窗、告警处置、趋势图、设备统计和运维播报。
- 与全局恶劣天气状态保持联动，跨视图同步湿度异常过程。

### 5.4 数据与服务模块

- \`src/services/api.js\` 提供本地模拟接口，封装信号设备、天气、地震、列车统计、AI 对话和日志数据。
- \`src/services/mockDataService.js\` 提供复杂趋势、寿命、调度、告警和环境模拟数据。
- \`src/services/simulationState.js\` 负责恶劣天气、湿度联动和处置状态同步。
- \`src/services/telemetrySocket.js\` 提供浏览器端 WebSocket 重连与最新遥测缓存。

### 5.5 遥测桥接模块

- \`server/telemetry-bridge.js\` 提供 \`POST /upload\` 用于接收外部设备 JSON 数据。
- 服务将 \`distance_cm\` 等字段标准化为 \`distance_m\`，并通过 \`WS /ws\` 广播给前端。
- 提供 \`GET /telemetry/health\` 健康检查接口。

## 6. 页面与菜单结构

- 顶层菜单一：地理信息可视化
- 顶层菜单二：铁路信号设备孪生面板
- 顶层菜单三：大数据可视化平台
- 大屏内部包含左侧环境/传感器、中央调度/寿命、右侧告警/设备概览三大区域。

## 7. 总体架构

- 前端采用 Vue 3 单页应用结构，由 \`src/App.vue\` 完成主视图切换。
- 地图可视化采用 Cesium，设备孪生采用 Three.js，大数据大屏采用 Vue 组件和 SVG/CSS 图形实现。
- 数据层以本地模拟数据和全局响应式状态为主，外部实时数据通过 Node.js 遥测桥接服务接入。
- 系统不依赖持久化数据库，浏览器端通过 \`localStorage\` 保存部分 Cesium 面板缓存数据。

## 8. 技术架构

- 前端：Vue 3、Vite、Cesium、Three.js、GSAP、ECharts
- 服务端：Node.js、\`http\`、\`ws\`
- 通信方式：HTTP、WebSocket、浏览器本地状态同步
- 运行方式：前端开发服务器 + 遥测桥接服务并行运行

## 9. 数据对象设计要点

- 信号设备对象：包含设备编号、状态、温度、湿度、光照、电压、电流、信号强度等字段。
- 遥测对象：包含 \`type\`、\`device\`、\`device_id\`、\`ts_ms\`、\`distance_cm\`、\`distance_m\`、\`water_active\`、\`raw\`。
- 天气对象：包含温度、湿度、风速、风向、气压、能见度、降水、空气质量和趋势数据。
- 调度与寿命对象：包含区段状态、列车状态、设备寿命天数、风险级别、调度命令等信息。

## 10. 数据库设计

- 当前版本未引入持久化数据库。
- \`src/services/api.js\` 中使用内存对象 \`memory\` 保存模拟数据。
- 数据库表设计、字段说明、初始化 SQL：待补充。

## 11. 接口设计

### 11.1 外部接口

- \`POST /upload\`：接收设备上报 JSON 载荷。
- \`GET /telemetry/health\`：返回桥接服务健康状态。
- \`WS /ws\`：向前端实时推送遥测消息。

### 11.2 内部接口

- 本地数据接口：\`getSignals\`、\`getSignal\`、\`createSignal\`、\`updateSignal\`、\`deleteSignal\`
- 分析数据接口：\`getSeismicData\`、\`getWeatherData\`、\`getCurrentWeather\`、\`getAirQuality\`、\`getTrainStats\`、\`getRailway\`、\`getParamHistory\`
- 辅助接口：\`getAiConversations\`、\`addAiConversation\`、\`getLogs\`、\`addLog\`、\`getDashboard\`

## 12. 运行环境与部署方式

- 开发环境：Windows 10、Node.js、npm、Visual Studio Code
- 运行环境：Windows、Linux、macOS + 现代浏览器
- 前端启动命令：\`npm run dev\`
- 遥测桥接命令：\`npm run telemetry\`
- 联合开发命令：\`npm run dev:all\`
- 生产部署方式：Vite 构建生成静态资源，Node.js 独立运行遥测桥接服务。

## 13. 安全与权限机制

- 当前版本未实现独立登录认证流程。
- 当前版本未实现细粒度角色权限控制，主要用于演示与可视化展示。
- 遥测接口设置了请求体大小限制和 JSON 合法性校验。
- 审计日志机制以控制台日志与前端模拟日志为主，正式日志平台：待补充。

## 14. 问题清单

1. \`AGENT.md\` 中提及的 \`server/stream-proxy.js\` 文件在当前仓库中不存在，相关说明与现状不一致。
2. \`README.md\` 中仍保留早期独立页面结构和 Bilibili 视频描述，而当前代码实际为 Vue 单页应用 Tab 切换结构。
3. 当前项目未引入持久化数据库，若后续软著材料需要数据库表设计，只能如实写明“当前版本无数据库表设计”。
4. 当前项目未实现登录认证与角色权限模块，相关章节应按“当前版本未实现/待补充”表述。
5. 视频监控功能当前依赖 \`VITE_STREAM_URL\` 直接配置流地址，仓库中未包含完整视频代理服务实现。

## 15. 代码规模统计

- \`src\` 目录代码量：${srcOnlyLines} 行
- 纳入本次整理稿的代码与配置文件总量：${totalLines} 行

${statsTable}
`

const buildCodeDoc = () => {
  const out = []
  out.push(`# ${finalName}源代码整理稿`)
  out.push('')
  out.push('## 1. 项目概述')
  out.push('')
  out.push(`${finalName} 是面向铁路信号监测与可视化展示场景的软件系统，采用 Vue 3 + Vite 构建单页应用，结合 Cesium、Three.js 与大屏可视化技术，实现山区铁路信号设备地理展示、数字孪生、恶劣天气演练、告警联动、遥测接入和综合分析展示。`)
  out.push('')
  out.push('## 2. 源代码整理说明')
  out.push('')
  out.push('- 本整理稿仅纳入当前仓库中真实存在且与系统直接相关的自研代码、配置与辅助服务文件。')
  out.push('- 未纳入第三方依赖、构建产物、静态音视频资源及无关文件。')
  out.push(`- 本稿共纳入 ${allFiles.length} 个文件，总计 ${totalLines} 行，其中 \`src\` 目录代码量为 ${srcOnlyLines} 行。`)
  out.push('- 代码按基础层、数据与服务层、表现层、参考与辅助层分组，以便后续导出 PDF 与人工核对。')
  out.push('')
  out.push('## 3. 目录结构说明')
  out.push('')
  out.push('```text')
  out.push('railway_sign/')
  out.push('├── index.html')
  out.push('├── package.json')
  out.push('├── vite.config.js')
  out.push('├── server/')
  out.push('│   └── telemetry-bridge.js')
  out.push('├── src/')
  out.push('│   ├── main.js')
  out.push('│   ├── App.vue')
  out.push('│   ├── config/')
  out.push('│   │   └── demoScenario.js')
  out.push('│   ├── composables/')
  out.push('│   │   └── useApiData.js')
  out.push('│   ├── services/')
  out.push('│   │   ├── api.js')
  out.push('│   │   ├── mockDataService.js')
  out.push('│   │   ├── simulationState.js')
  out.push('│   │   └── telemetrySocket.js')
  out.push('│   ├── components/')
  out.push('│   │   ├── CesiumView.vue')
  out.push('│   │   ├── ThreeView.vue')
  out.push('│   │   ├── DataPanel.vue')
  out.push('│   │   └── datapanel/')
  out.push('│   │       ├── LeftPanel.vue')
  out.push('│   │       ├── CenterPanel.vue')
  out.push('│   │       └── RightPanel.vue')
  out.push('│   └── js/')
  out.push('│       ├── cesium.js')
  out.push('│       └── threejs.js')
  out.push('└── docs/')
  out.push('    └── 本次整理输出材料')
  out.push('```')
  out.push('')
  out.push('## 4. 模块划分说明')
  out.push('')
  out.push('- 基础层：应用入口、顶层界面组织、场景参数与工程构建配置。')
  out.push('- 数据与服务层：模拟数据接口、趋势生成、全局状态同步、遥测连接与组合式调用。')
  out.push('- 表现层：Cesium 地图、Three.js 数字孪生与大屏可视化组件。')
  out.push('- 参考与辅助层：早期脚本版本及 Node.js 遥测桥接服务。')
  out.push('')

  for (const group of codeGroups) {
    out.push(`## ${groupIndexTitle[group.title]}. 模块：${group.title}`)
    out.push('')
    out.push(group.intro)
    out.push('')
    group.files.forEach((relativePath, index) => {
      const content = fileContents.get(relativePath)
      const lines = fileStats.find((item) => item.path === relativePath)?.lines || 0
      out.push(`### ${groupIndexTitle[group.title]}.${index + 1} 文件：${relativePath}`)
      out.push('')
      out.push(`- 文件说明：${fileDescriptions[relativePath] || '系统相关源代码文件。'}`)
      out.push(`- 行数统计：${lines} 行`)
      out.push('')
      out.push('````' + extLang(relativePath))
      out.push(content.replace(/\r?\n$/, ''))
      out.push('````')
      out.push('')
    })
  }

  out.push('## 7. 总行数统计说明')
  out.push('')
  out.push(`本次纳入整理的真实文件共 ${allFiles.length} 个，总计 ${totalLines} 行；其中 \`src\` 目录代码量 ${srcOnlyLines} 行，已超过软著材料常见的 3000 行整理需求。`)
  out.push('')
  out.push('## 8. 纳入材料说明')
  out.push('')
  out.push('- 已纳入：前端核心源码、辅助服务源码、工程配置、入口页面、演示场景配置。')
  out.push('- 未纳入：第三方依赖、构建产物、静态资源文件、无关缓存目录。')
  out.push('- 特别说明：\`src/js\` 目录为历史独立脚本版本，当前单页应用未直接引用，但属于项目真实原创代码，故纳入材料作为参考与演进说明。')
  out.push('')
  return out.join('\n')
}

const designDoc = `# ${finalName}软件设计说明书

## 1 引言

### 1.1 编写目的

本文档用于对 ${finalName} 的建设背景、需求分析、总体架构、详细设计、接口设计、运行环境和运维方式进行整理说明，为软件著作权登记、技术归档和后续系统维护提供依据。

### 1.2 项目背景

本项目面向铁路信号监测与运维展示场景，围绕山区铁路区间信号设备的运行状态可视化需求进行开发。系统以数字孪生、地理信息可视化和大屏分析展示为主线，支持信号设备三维展示、环境监测、恶劣天气演练、告警联动和实时遥测接入。

### 1.3 术语定义

- 数字孪生：通过三维模型和实时或模拟数据对真实信号设备状态进行映射展示。
- 遥测：外部设备上报的距离、涉水等监测数据。
- 恶劣天气演练：通过全局模拟状态触发高湿、降雨、雾化等演示流程。
- GIS：地理信息系统，用于展示线路、站点及空间位置关系。

### 1.4 参考资料

- \`docs/information.txt\`
- \`README.md\`
- \`AGENT.md\`
- \`src/\`、\`server/\`、\`package.json\`、\`vite.config.js\`

## 2 需求分析

### 2.1 建设目标

- 建立铁路信号设备数字孪生展示能力。
- 建立铁路区间地理态势三维展示能力。
- 建立恶劣天气、湿度异常和人员靠近等演练能力。
- 建立前端综合可视化分析与告警联动展示能力。
- 建立基于 HTTP 和 WebSocket 的轻量化遥测接入能力。

### 2.2 业务需求

- 展示铁路区间地理环境、站点与线路分布。
- 展示核心信号设备的三维模型、参数和运行状态。
- 展示环境、调度、设备寿命、告警与运维统计信息。
- 接收外部设备的遥测数据并与界面联动。
- 在恶劣天气场景下展示湿度异常、告警弹窗和处置过程。

### 2.3 功能需求

- 主界面提供地理信息可视化、数字孪生面板和大数据可视化平台三类视图切换。
- Cesium 视图提供相机巡航、地图定位、信标波纹、天气演练、图表与 AI 助手演示。
- Three.js 视图提供信号机三维模型、列车动画、参数曲线、视频监控与遥测联动。
- 数据大屏提供环境监测、设备统计、告警列表、寿命预测和调度态势展示。
- 遥测桥接服务支持 JSON 数据上传、标准化处理和 WebSocket 广播。

### 2.4 非功能需求

- 界面应支持现代浏览器运行。
- 支持基于本地模拟数据的离线演示。
- 支持前端缓存，降低页面刷新后的数据空白。
- 页面切换和动画效果应具备较好的观感与连续性。

### 2.5 用户角色与权限需求

- 运维值守人员：查看设备运行状态和告警情况。
- 信号维护人员：关注信号机参数、异常分析和处置提示。
- 展示或调度人员：查看线路态势、运行统计和大屏结果。
- 当前版本未实现账号登录与角色鉴权，权限控制需求暂以业务角色描述体现。

## 3 系统概述

### 3.1 系统简介

系统采用单页应用模式运行，通过顶层 Tab 在三种核心视图之间切换。系统一方面使用本地模拟数据完成大部分可视化演示，另一方面通过 Node.js 遥测桥接服务接收外部设备上报数据，并通过 WebSocket 广播给前端，从而实现实时联动展示。

### 3.2 使用对象

- 铁路信号运维人员
- 信号设备维护人员
- 线路展示与调度分析人员
- 接入演示设备或传感器的测试人员

### 3.3 应用场景

- 铁路信号设备状态展示
- 区间线路地理态势展示
- 恶劣天气和湿度异常应急演练
- 行人靠近信号设备的安全预警演示
- 综合大屏演示和技术成果汇报

### 3.4 总体业务流程

1. 用户打开前端页面，系统默认进入数字孪生面板。
2. 前端读取本地模拟数据、建立全局状态和缓存数据。
3. 若开启遥测桥接服务，前端通过 WebSocket 建立连接并等待数据。
4. 外部设备通过 \`POST /upload\` 上报 JSON 数据。
5. 服务端规范化数据后广播给前端。
6. Three.js 面板根据遥测结果刷新距离、涉水和行人告警展示。
7. 用户可切换到 Cesium 视图或大数据视图查看综合信息。

## 4 总体设计

### 4.1 总体架构

系统采用“前端单页应用 + 轻量后端桥接服务”架构：

- 前端界面层：负责地图、孪生模型和大屏展示。
- 前端数据服务层：负责本地模拟数据、状态同步和 WebSocket 客户端。
- 服务桥接层：负责接收外部上报数据并向前端广播。
- 浏览器缓存层：负责保存部分面板数据，提升刷新后的可用性。

### 4.2 技术架构

- Vue 3：组件化界面与响应式状态管理。
- Vite：开发构建与前端工程化支持。
- Cesium：GIS 三维地图与空间对象展示。
- Three.js：信号机、列车、轨道等三维模型渲染。
- Node.js + ws：遥测上传与 WebSocket 广播。
- 本地模拟数据：用于离线演示和趋势构造。

### 4.3 功能结构

- 地理信息可视化模块
- 信号设备数字孪生模块
- 大数据可视化模块
- 模拟数据服务模块
- 全局状态同步模块
- 遥测桥接模块

### 4.4 菜单与页面结构

- 一级页面一：地理信息可视化
- 一级页面二：铁路信号设备孪生面板
- 一级页面三：大数据可视化平台
- 大数据平台子页面结构：左侧环境态势、中部调度态势、右侧设备告警与统计

### 4.5 模块划分

- 基础层：\`src/main.js\`、\`src/App.vue\`、\`src/config/demoScenario.js\`、\`vite.config.js\`
- 数据层：\`src/services/api.js\`、\`src/services/mockDataService.js\`、\`src/services/simulationState.js\`
- 接口层：\`src/services/telemetrySocket.js\`、\`server/telemetry-bridge.js\`
- 表现层：\`src/components\` 下各视图组件
- 辅助层：\`src/composables/useApiData.js\`、\`src/js\` 目录参考脚本、\`package.json\`

## 5 详细设计

### 5.1 地理信息可视化模块详细设计

该模块位于 \`src/components/CesiumView.vue\`，主要职责如下：

- 初始化 Cesium Viewer、配置地形和影像服务。
- 构建信标点位、波纹、位置信息和弹出交互。
- 提供相机飞行、巡航、角度控制和自动暂停功能。
- 提供气象、空气质量、地震趋势和铁路运行信息面板。
- 提供恶劣天气演练、背景音乐、AI 对话、缓存读写等辅助功能。

### 5.2 信号设备数字孪生模块详细设计

该模块位于 \`src/components/ThreeView.vue\`，主要职责如下：

- 初始化场景、相机、光照、地面、山体、轨道和列车模型。
- 创建信号灯、标签、环境装饰和天空粒子效果。
- 提供列车路径动画、信号灯切换、自动演示和相机控制。
- 管理参数曲线、视频监控列表、音频提醒和遥测状态显示。
- 根据遥测距离和涉水状态控制行人显示与高亮告警。

### 5.3 大数据可视化模块详细设计

该模块由 \`src/components/DataPanel.vue\` 及 \`src/components/datapanel/\` 子组件共同实现，主要职责如下：

- 顶层页面负责时间、天气总览、告警弹窗和全局异常流程控制。
- 左侧面板展示传感器状态、环境数据、AQI 与趋势信息。
- 中部面板展示区段态势、调度信息、寿命预测、缩略图和缩放拖拽交互。
- 右侧面板展示设备数量、告警列表、处理状态和滚动播报内容。

### 5.4 遥测桥接与数据服务设计

- \`src/services/api.js\` 提供前端本地模拟数据接口，统一异步返回格式。
- \`src/composables/useApiData.js\` 将数据接口封装为组合式函数，简化页面调用。
- \`src/services/simulationState.js\` 保存恶劣天气联动和湿度处置状态。
- \`src/services/telemetrySocket.js\` 实现自动重连、最新数据缓存和连接状态维护。
- \`server/telemetry-bridge.js\` 提供 HTTP 上传与 WebSocket 推送能力。

### 5.5 输入输出设计

输入主要包括：

- 页面点击、视图切换、缩放拖拽、告警处理等用户操作输入。
- 外部设备上传的 JSON 遥测数据。
- 环境变量输入，如 \`VITE_TELEMETRY_WS_URL\`、\`VITE_STREAM_URL\`。

输出主要包括：

- 地图、三维模型、大屏图表和告警弹窗等界面输出。
- 控制台日志、模拟日志记录和 WebSocket 消息广播。
- 浏览器本地缓存数据。

### 5.6 异常处理设计

- 遥测上传接口限制请求体大小，并对 JSON 解析异常返回错误结果。
- WebSocket 客户端在连接异常后自动重连。
- Cesium 初始化失败时保留面板展示，避免整页不可用。
- 视频流地址未配置时页面显示“未配置”，避免无效请求。

### 5.7 日志设计

- 服务端日志：遥测桥接服务输出上传开始、结束、错误、广播数量等日志。
- 前端日志：WebSocket 连接状态、视频加载状态、控制台告警信息。
- 模拟日志：\`src/services/api.js\` 提供内存日志数据结构用于展示与调试。

## 6 数据设计

### 6.1 数据对象设计

- 信号设备对象：\`id\`、\`name\`、\`status\`、\`temperature\`、\`humidity\`、\`light_intensity\`、\`voltage\`、\`current\`、\`signal_strength\`
- 列车统计对象：\`passed_count\`、\`total_count\`、\`on_time_rate\`、\`next_train\`
- 线路对象：\`name\`、\`start_station\`、\`end_station\`、\`length_km\`
- 遥测对象：\`type\`、\`device\`、\`device_id\`、\`ts_ms\`、\`uptime_ms\`、\`wifi_ip\`、\`distance_cm\`、\`distance_m\`、\`water_active\`、\`raw\`

### 6.2 数据库表设计

当前版本未使用持久化数据库，不存在正式数据库表结构。

### 6.3 字段说明

- 温湿度、电压、电流、光照和信号强度用于反映信号机运行环境与设备状态。
- \`distance_m\` 用于表示行人与设备之间的距离。
- \`water_active\` 用于表示涉水状态或盒体进水指示。

### 6.4 数据关系说明

- 遥测对象与数字孪生页面中的目标设备展示相关联。
- 全局恶劣天气状态与 Cesium 页面、大数据页面中的湿度与告警展示联动。
- 大屏各子组件通过父组件传参与共享状态实现关联。

### 6.5 初始化数据与脚本说明

- \`src/services/api.js\` 中 \`memory\` 对象提供信号设备、列车统计、线路、AI 对话和日志初始数据。
- \`src/services/mockDataService.js\` 动态构造时间序列、设备统计、寿命预测和告警数据。
- 数据库初始化脚本：待补充。

## 7 接口设计

### 7.1 内部接口

- 数据获取接口：\`getSignals\`、\`getWeatherData\`、\`getAirQuality\`、\`getTrainStats\`、\`getRailway\`、\`getParamHistory\`
- 对话与日志接口：\`getAiConversations\`、\`addAiConversation\`、\`getLogs\`、\`addLog\`
- 组合式接口：\`useDashboardData\`、\`useWeatherData\`、\`useTrainStatsData\` 等

### 7.2 外部接口

- \`POST /upload\`
- \`GET /telemetry/health\`
- \`WS /ws\`

### 7.3 参数说明

- \`POST /upload\` 支持 JSON 字段 \`type\`、\`device\`、\`device_id\`、\`ts_ms\`、\`uptime_ms\`、\`wifi_ip\`、\`distance_cm\`、\`water_active\` 等。
- \`GET /telemetry/health\` 无需业务参数。
- \`WS /ws\` 连接成功后可接收 \`topic=telemetry\` 的消息数据。

### 7.4 返回结果说明

- 上传成功返回 \`{ ok: true }\`。
- 上传失败返回 \`{ ok: false, error, detail? }\`。
- WebSocket 消息格式为 \`{ topic: 'telemetry', data: { ... } }\`。

### 7.5 接口安全说明

- 上传接口对请求体大小进行限制。
- 上传接口执行 JSON 解析校验。
- 当前版本未实现接口鉴权和签名校验，适用于演示或受控网络环境。

## 8 运行环境设计

### 8.1 硬件环境

- 开发硬件环境：CPU Core i5-4570 3.2GHz、内存 16GB、硬盘 500G*2
- 运行硬件环境：CPU Core i5-4570 3.2GHz、内存 4GB、硬盘 100GB

### 8.2 软件环境

- Windows 10 64 位开发环境
- Node.js 18 及以上
- npm 9 及以上
- Chrome、Edge 等现代浏览器

### 8.3 运行依赖

- Vue 3
- Vite
- Cesium
- Three.js
- ws
- GSAP、ECharts 等前端可视化依赖

### 8.4 部署方式

- 前端通过 \`npm run build\` 构建静态资源。
- 前端开发环境通过 \`npm run dev\` 启动。
- 遥测桥接服务通过 \`npm run telemetry\` 启动。
- 若需要本地一体联调，可执行 \`npm run dev:all\`。

## 9 安全与权限设计

### 9.1 身份认证

当前版本未实现独立身份认证模块。

### 9.2 权限控制

当前版本未实现基于角色的权限控制，页面功能对本地使用者默认开放。

### 9.3 数据安全

- 通过请求体大小限制减少异常数据风险。
- 前端缓存仅用于展示数据恢复，不用于敏感数据保存。
- 正式生产环境的数据加密、访问控制与专网隔离措施：待补充。

### 9.4 操作审计

- 当前以控制台日志与前端模拟日志为主。
- 完整审计平台和操作留痕能力：待补充。

## 10 脚本与运维说明

### 10.1 启动脚本

- \`npm run dev\`：启动前端开发服务器。
- \`npm run telemetry\`：启动遥测桥接服务。
- \`npm run dev:all\`：并行启动前端和遥测服务。

### 10.2 部署脚本

- 当前仓库未提供独立自动化部署脚本，部署流程以 Vite 构建和 Node.js 启动命令为主。

### 10.3 数据初始化脚本

- 当前未提供数据库初始化脚本。
- 本地模拟数据由源码内存对象与 Mock 服务直接初始化。

### 10.4 定时任务与维护脚本

- 前端页面中通过定时器刷新数据、同步缓存和驱动演示动画。
- 专门的系统级定时任务脚本：待补充。

## 11 测试与验证说明

### 11.1 测试范围

- 页面构建与运行验证
- 三大主视图切换验证
- 遥测桥接接口验证
- 大屏告警与恶劣天气联动验证

### 11.2 测试方式

- 本地运行前端和遥测服务进行人工验证
- 通过构建命令验证前端工程可正常打包
- 通过 HTTP 请求和 WebSocket 连接验证桥接功能

### 11.3 主要验证内容

- 页面是否正常渲染
- 组件切换是否正常
- 遥测数据是否能够成功上传并推送
- 告警状态是否能随全局状态联动变化

## 12 总结

### 12.1 系统特点

- 同时具备 GIS 场景展示、三维数字孪生和大屏分析能力。
- 支持本地模拟数据与外部遥测数据混合展示。
- 支持恶劣天气、湿度异常、人员靠近等联动演示。

### 12.2 当前完成情况

- 已完成前端三大主视图、模拟数据服务、全局联动状态和遥测桥接服务。
- 已具备软著材料整理所需的主要代码、架构与功能说明基础。

### 12.3 后续可扩展方向

- 增加真实数据库与历史数据存储能力。
- 增加账号认证、角色权限和审计能力。
- 增加完整视频代理服务与更多外部设备接入方式。
- 增加自动化测试与正式部署脚本。

文档整理日期：${today}
`

const sourcePdfPath = path.join(docsDir, '软著源代码整理稿.pdf')
const designPdfPath = path.join(docsDir, '软件设计说明书.pdf')
const hasSourcePdf = await exists(sourcePdfPath)
const hasDesignPdf = await exists(designPdfPath)
const designDocEnhanced = buildEnhancedDesignDoc(designDoc)
  .replace(/\r?\n### 5\.10 恶劣天气与湿度异常状态图[\s\S]*?(?=\r?\n## 6 数据设计)/, '\n\n')
  .replace(/\| 10 \| 图 5-3 \| 恶劣天气与湿度异常状态图 \| docs\/assets\/diagrams\/07-weather-state\.png \| 详细设计 \|\r?\n/g, '')

const resultListDoc = `# 软著材料整理结果

## 1. 已生成文件

- \`docs/information.txt\`
- \`docs/软件名称候选与首选说明.md\`
- \`docs/项目材料关键信息提取.md\`
- \`docs/软著源代码整理稿.md\`
- \`docs/软件设计说明书.md\`

## 2. 当前文件说明

- \`docs/information.txt\`：已按现有仓库内容完成修订。
- \`docs/软件名称候选与首选说明.md\`：给出候选名称与首选理由。
- \`docs/项目材料关键信息提取.md\`：归纳项目背景、模块、接口、运行环境与问题清单。
- \`docs/软著源代码整理稿.md\`：纳入真实源码与配置文件，总计 ${totalLines} 行。
- \`docs/软件设计说明书.md\`：形成完整设计说明书整理稿。

## 3. PDF 转换状态

- \`docs/软著源代码整理稿.pdf\`：${hasSourcePdf ? '已生成' : '待生成'}
- \`docs/软件设计说明书.pdf\`：${hasDesignPdf ? '已生成' : '待生成'}

## 4. 推荐转换方式

- 可使用支持中文字体的 Markdown 转 PDF 工具进行转换。
- 建议优先使用 Chromium/Edge 无头模式或 \`md-to-pdf\` 工具导出。
- 导出时应检查中文字体、代码换页和标题层级是否正常。
`

await fs.mkdir(docsDir, { recursive: true })
await fs.writeFile(path.join(docsDir, '软件名称候选与首选说明.md'), softwareNameDoc, 'utf8')
await fs.writeFile(path.join(docsDir, '项目材料关键信息提取.md'), extractionDoc, 'utf8')
await fs.writeFile(path.join(docsDir, '软著源代码整理稿.md'), buildCodeDoc(), 'utf8')
await fs.writeFile(path.join(docsDir, '软件设计说明书.md'), designDocEnhanced, 'utf8')
await fs.writeFile(path.join(docsDir, '软著材料整理结果.md'), resultListDoc, 'utf8')

console.log(`Generated soft-copyright docs at ${docsDir}`)

