import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue(), cesium()],
  server: {
    port: 4028,
    open: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4028,
  },
  build: {
    target: "esnext",
  },
});