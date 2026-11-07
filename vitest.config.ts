import { defineConfig, configDefaults } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    exclude: [
      ...configDefaults.exclude,
      '**/.claude/**',
      'apps/mobile/**',
    ],
  },
})
