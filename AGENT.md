# AGENT.md

`railway_sign` 仓库概览。

## 用途
- 基于 3D 的铁路信号监控看板：包含 Cesium “大地图”视图，以及 Three.js 设备面板视图。

## 技术栈
- 前端：Vue 3 + Vite、Cesium、Three.js、ECharts、GSAP、mqtt。
- 后端：Node.js + Express + PostgreSQL。

## 关键路径
- `src/App.vue`：顶层视图切换（Cesium vs Three）。
- `src/components/CesiumView.vue`：Cesium 地图、看板面板、信标特效。
- `src/components/ThreeView.vue`：3D 站场/面板视图。
- `src/services/api.js`：前端 API 封装。
- `server/index.js`：Express API + 静态资源托管。
- `server/db.js`：PostgreSQL 连接池与查询辅助方法。
- `server/scripts/initDatabase.js`：数据库结构 + 模拟数据。
- `server/public/admin/index.html`：管理端 UI 入口。
- `public/`：前端静态资源。
- `dist/`：构建产物（生产环境由后端提供服务）。

## 开发命令（仓库根目录）
- `npm run dev`：Vite 开发服务器。
- `npm run dev:server`：API 服务器。
- `npm run dev:all`：通过 concurrently 同时运行两者。
- `npm run build`：Vite 构建。
- `npm run preview`：预览构建产物。
- `npm run init-db`：初始化数据库（server 脚本）。

## 开发命令（server/）
- `npm run dev`：nodemon 服务器。
- `npm run start`：node 服务器。

## 环境变量
- 前端：`VITE_API_BASE`（可选，API base URL）。
- 后端：`DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`、`PORT`。

## 数据流说明
- 前端期望 API 返回结构为 `{ success, data, error }`。
- SVG 折线图通过组件内计算点位“手工绘制”。
- Cesium 信标特效主要在 `createBeaconPoints` 与 `updateWaveAnimation` 中实现。

## 测试
- 未配置自动化测试。
