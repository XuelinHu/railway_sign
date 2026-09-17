import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'
import vue from '@vitejs/plugin-vue'

// 前端与统一后台（8037）同源访问：dev 与 preview 都走代理，
// 这样部署到 FRP 后只需要暴露 4028 一个入口，也避免跨域与混合内容问题。
const apiProxy = {
  "/api": {
    target: process.env.VITE_API_TARGET || "http://127.0.0.1:8037",
    changeOrigin: true,
    ws: true,
  },
};

export default defineConfig({
  plugins: [vue(), cesium()],
  server: {
    host: "0.0.0.0",
    port: 4028,
    open: true,
    proxy: apiProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 4028,
    proxy: apiProxy,
  },
  build: {
    target: "esnext",
  },
});