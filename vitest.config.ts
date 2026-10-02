import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],   // src/lib/core/*.test.ts use node:test and run via `npm run test:core`
    coverage: { provider: 'v8', include: ['src/lib/**'] },
  },
});
