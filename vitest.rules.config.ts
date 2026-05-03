import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Separate config for the database rules suite: runs in node (no jsdom),
// no MSW / setupFiles (which would intercept emulator traffic), and only
// picks up tests under `tests/rules/`. Invoked by `test:rules:emulator`,
// which boots the Firebase Realtime Database emulator before vitest.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/rules/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
