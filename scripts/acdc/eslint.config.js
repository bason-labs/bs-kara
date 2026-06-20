import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.recommended, {
  files: ['src/**/*.ts', 'bin/**/*.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
});
