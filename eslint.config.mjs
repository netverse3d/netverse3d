import js from '@eslint/js';
import globals from 'globals';

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
      'packages/game-shared/**',
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
];
