import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const wsProxy = {
  '/ws': {
    target: 'ws://localhost:8080',
    ws: true,
  },
}

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: wsProxy,
  },
  preview: {
    port: 4173,
    proxy: wsProxy,
  },
})
