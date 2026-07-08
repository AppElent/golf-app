import { defineConfig, configDefaults } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    exclude: [
      ...configDefaults.exclude,
      '**/.claude/**',
      '**/node_modules_OLD/**',
      '**/node_modules.*/**',
    ],
  },
})
