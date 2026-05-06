import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  external: [
    'laymeout',
    'liquid-glass-dom',
    'liquid-glass-dom/layout',
    'react',
    'react-dom',
  ],
})
