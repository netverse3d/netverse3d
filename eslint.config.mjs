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
      'apps/admin/**',
      'apps/web-3d/.next/**',
      'apps/web-3d/out/**',
      'apps/web-3d/public/**',
      'apps/web-3d/next-env.d.ts',
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
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['apps/web-3d/**/*.{ts,tsx}'],
  })),
  {
    files: ['apps/web-3d/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
];
