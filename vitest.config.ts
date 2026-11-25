import { defineConfig, configDefaults } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    // Parallel agent runs share one Mac's memory; CI keeps the default.
    maxWorkers: process.env.CI ? undefined : '25%',
    exclude: [
      ...configDefaults.exclude,
      '**/.claude/**',
      // Playwright owns the browser smoke tests (pnpm test:e2e).
      'e2e/**',
      // Jest owns the app; its node scripts' tests run here.
      'apps/mobile/!(scripts)/**',
    ],
  },
})
