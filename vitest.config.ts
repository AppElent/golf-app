import { defineConfig, configDefaults } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
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
