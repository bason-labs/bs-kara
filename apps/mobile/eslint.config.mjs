import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules/', '.expo/', 'android/', 'ios/', 'dist/', 'coverage/'],
  },
  // CommonJS config files use require/module/exports globals
  {
    files: ['*.config.js', '*.config.ts', 'babel.config.js', 'metro.config.js', 'jest.config.js', 'tailwind.config.js', 'jest.setup.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  // Test files — relax rules that are noisy in test code
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Files that use require() for dynamic/conditional imports (React Native patterns)
  {
    files: ['hooks/useVoiceSearch.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Existing source files with pre-existing issues — relax to warn only
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-empty': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },
)
