import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue(), cesium()],
  server: {
    port: 4202,
    open: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4201,
  },
  build: {
    target: "esnext",
  },
});