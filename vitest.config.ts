import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths({
    projects: [
      './tsconfig.vitest.json',
    ],
  })],
  // npm SDK packages reference sourcemaps that are not published (files
  // exclude *.map); do not attempt to load them during transform.
  server: {
    sourcemapIgnoreList: () => true,
  },
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'],
    pool: 'forks',
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Track the measured coverage with about one point of slack
      // (2026-10-02: 78.6 statements / 69.85 branches / 91.35 functions /
      // 82.3 lines). Raise-only: never lower these.
      thresholds: {
        statements: 77,
        branches: 68,
        functions: 90,
        lines: 81,
      },
    },
  },
})
