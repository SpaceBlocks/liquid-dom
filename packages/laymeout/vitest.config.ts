import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'laymeout/dom',
        replacement: fileURLToPath(new URL('./src/dom.ts', import.meta.url)),
      },
      {
        find: 'laymeout',
        replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
