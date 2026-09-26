import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { soberpalApiPlugin } from './src/server/vitePlugin'

export default defineConfig({
  plugins: [react(), soberpalApiPlugin()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 20000,
  },
})
