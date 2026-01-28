import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [cesium()],
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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        cesium: resolve(__dirname, 'cesium.html'),
        threejs: resolve(__dirname, 'threejs.html'),
      },
    },
  },
});
