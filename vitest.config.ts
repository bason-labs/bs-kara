import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // `server-only` is a Next.js build-time marker (no real runtime
      // export). Vitest's Vite resolver can't load it, so stub to empty.
      'server-only': fileURLToPath(
        new URL('./tests/server-only-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.tsx'],
    globals: false,
    css: false,
    include: ['{app,components,features,lib,hooks,tests}/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**', 'tests/rules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'features/**/*.{ts,tsx}',
        'lib/**/*.ts',
        'hooks/**/*.ts',
      ],
      exclude: [
        'app/**/layout.tsx',
        'app/**/page.tsx',
        'app/sitemap.ts',
        'app/robots.ts',
        'app/global-error.tsx',
        '**/*.d.ts',
      ],
    },
  },
});
