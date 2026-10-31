import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.{js,ts}'],
    exclude: ['tests/e2e/**', 'tests/live/**'],
    restoreMocks: true,
  },
});
