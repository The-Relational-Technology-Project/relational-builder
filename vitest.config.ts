import { defineConfig } from 'vitest/config';
import path from 'path';

// `npm test`. Node environment, no DOM: the modules under test are pure
// (runtime config, manifest text, the kit's ai helper against a mocked fetch).
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    include: ['src/**/*.test.ts', 'bench/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'bench/results/**'],
    environment: 'node',
  },
});
