import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // server-only is a Next.js guard that throws at runtime when imported
      // from the client. Under Vitest there is no Next.js runtime, so we
      // stub it to a no-op so server-only files can be unit-tested.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
      '@bs-kara/shared': fileURLToPath(new URL('../bk-shared/src/index.ts', import.meta.url)),
      '@bs-kara/shared/hooks': fileURLToPath(new URL('../bk-shared/src/hooks.ts', import.meta.url)),
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
