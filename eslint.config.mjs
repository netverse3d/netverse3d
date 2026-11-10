import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      'docs/.vitepress/dist/**',
      'docs/.vitepress/cache/**',
      'apps/**',
      'services/**',
      'workers/**',
      'packages/config/**',
      'packages/ui/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.ts'] })),
];
