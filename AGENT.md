# AGENT.md

`railway_sign` 仓库概览。

## 用途
- 山区铁路信号数字孪生可视化看板（单页应用）：提供 Cesium 地理信息视图、Three.js 信号孪生面板、以及大数据可视化面板三套视图。

## 技术栈
- 前端：Vue 3 + Vite、Cesium、Three.js、GSAP、ECharts（用于数据面板）。
- 辅助服务：Node.js（纯 `http` + `ws`），用于视频流转发与遥测 WebSocket 广播。

## 关键路径
- `src/main.js`：应用入口。
- `src/App.vue`：顶层 Tab 切换（`cesium`/`three`/`data`）。
- `src/components/CesiumView.vue`：Cesium Viewer 初始化、信标/光波动画、相机巡航、恶劣天气模拟等。
- `src/components/ThreeView.vue`：Three.js 场景、信号灯/列车演示、视频监控面板、遥测数据接入（行人距离/告警）。
- `src/components/DataPanel.vue`、`src/components/datapanel/*`：大数据可视化平台 UI（使用 mock 数据与全局模拟状态）。
- `src/services/api.js`：前端本地数据源（内存数据 + `wait()` 模拟延迟），无真实 HTTP 请求。
- `src/services/mockDataService.js`：大屏面板的随机/趋势 mock 数据生成。
- `src/services/telemetrySocket.js`：浏览器端遥测 WS 客户端（断线重连、更新 `lastTelemetry`）。
- `src/services/simulationState.js`：跨视图共享的模拟开关（例如恶劣天气）。
- `server/telemetry-bridge.js`：`POST /upload` 接收设备上报 -> 规范化 -> `ws` 广播。
- `server/stream-proxy.js`：使用 `curl` 转发 MJPEG（`/stream-proxy/live`）。
- `src/js/*`：早期独立脚本版本（当前 SPA 未直接引用，保留作参考）。

## 开发命令（仓库根目录）
- `npm run dev`：仅启动 Vite（默认 `http://localhost:5173`）。
- `npm run dev:all`：同时启动三个进程（推荐）：`proxy`（视频流）、`telemetry`（遥测桥接）、`dev`（前端）。
- `npm run proxy`：单独启动视频流代理（默认 `http://localhost:3001`）。
- `npm run telemetry`：单独启动遥测桥接（默认 `http://localhost:8080`）。
- `npm run build`：Vite 构建。
- `npm run preview`：预览构建产物（默认 `http://localhost:4173`）。

## 端口与接口（默认值）
- Web：`http://localhost:5173`
- Preview：`http://localhost:4173`
- Stream Proxy：`http://localhost:3001`
  - `GET /stream-proxy/live`：转发上游 MJPEG（前端会追加 `?_t=...` 防缓存）
  - `GET /stream-proxy/health`
- Telemetry Bridge：`http://localhost:8080`
  - `POST /upload`：接收 JSON 上报（转发到 WS）
  - `WS /ws`：推送 `{"topic":"telemetry","data":{...}}`
  - `GET /telemetry/health`

## 环境变量
- 前端（Vite）
  - `VITE_CESIUM_ION_TOKEN`：Cesium Ion Token（未设置会回退到组件内置 token，便于开箱即用）。
  - `VITE_STREAM_PROXY_BASE`：视频流代理 base（默认 `http://localhost:3001/stream-proxy`）。
  - `VITE_TELEMETRY_WS_URL`：遥测 WS 地址（默认 `ws://localhost:8080/ws`）。
- 辅助服务（Node）
  - Stream Proxy：`STREAM_SOURCE_URL`（默认 `http://192.168.1.11/stream`）、`STREAM_PROXY_PORT`（默认 `3001`）。
  - Telemetry Bridge：`TELEMETRY_PORT`（默认 `8080`）、`TELEMETRY_WS_PATH`（默认 `/ws`）、`TELEMETRY_UPLOAD_PATH`（默认 `/upload`）、`TELEMETRY_MAX_BODY_BYTES`（默认 `32768`）。

## 数据流说明
- “业务数据”主要来自前端本地 mock（`src/services/api.js`、`src/services/mockDataService.js`），用于演示 UI/交互。
- 遥测数据：设备 `POST /upload` -> `server/telemetry-bridge.js` 规范化字段（如 `distance_cm` -> `distance_m`）-> WS 广播 -> `src/services/telemetrySocket.js` 更新响应式状态 -> `src/components/ThreeView.vue` 根据距离阈值（< 2m 且 > 0）触发行人告警/高亮。
- 视频监控：`src/components/ThreeView.vue` 使用 `<img>` 加载 `STREAM_PROXY_BASE + /live` 的 MJPEG 流；`server/stream-proxy.js` 通过 `curl --no-buffer` 转发上游。

## 开发注意
- `server/stream-proxy.js` 依赖系统可用的 `curl`（Windows 通常为 `curl.exe`）。
- Cesium Ion Token 建议通过 `VITE_CESIUM_ION_TOKEN` 配置，避免在代码/日志中传播真实 token。

## 测试
- 未配置自动化测试。
