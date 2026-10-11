import { defineConfig } from 'vite'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import cesium from 'vite-plugin-cesium'
import vue from '@vitejs/plugin-vue'

const useHttps = process.env.DEV_HTTPS === '1'
const httpsPort = 4090
const tlsDirectory = resolve(process.cwd(), '../identity-service/tls/apps/railway-sign')
const tlsCert = resolve(tlsDirectory, 'server.crt')
const tlsKey = resolve(tlsDirectory, 'server.key')

if (useHttps && !(existsSync(tlsCert) && existsSync(tlsKey))) {
  throw new Error(`HTTPS requires the LAN development certificate in ${tlsDirectory}`)
}

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
    port: useHttps ? httpsPort : 4028,
    strictPort: true,
    open: true,
    ...(useHttps ? { https: { cert: tlsCert, key: tlsKey } } : {}),
    proxy: apiProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: useHttps ? httpsPort : 4028,
    strictPort: true,
    ...(useHttps ? { https: { cert: tlsCert, key: tlsKey } } : {}),
    proxy: apiProxy,
  },
  build: {
    target: "esnext",
    outDir: "dist/web",
  },
});
