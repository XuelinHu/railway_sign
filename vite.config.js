import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [vue(), cesium()],
  server: {
    port: 5173,  // 前端开发服务器端口
    open: true,
    proxy: {
      // API代理到后端服务器
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // 后台管理页面代理
      '/admin': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },

  build: {
    target: "esnext",
  },
});
