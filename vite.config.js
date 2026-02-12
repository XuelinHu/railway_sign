import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [vue(), cesium()],
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },

  build: {
    target: "esnext",
  },
});
