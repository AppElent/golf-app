import { defineConfig, configDefaults } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    exclude: [
      ...configDefaults.exclude,
      '**/.claude/**',
      // Jest owns the app; its node scripts' tests run here.
      'apps/mobile/!(scripts)/**',
    ],
  },
})
