import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
      '/health': {
        target: 'http://localhost:8080',
      },
    },
  },
})
