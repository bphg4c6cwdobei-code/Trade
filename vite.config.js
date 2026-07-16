import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the static build works from any path (GitHub Pages subpath included)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
