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
      'services/*/generated/**',
      'docs/.vitepress/dist/**',
      'docs/.vitepress/cache/**',
      'apps/admin/**',
      'apps/web-3d/.next/**',
      'apps/web-3d/out/**',
      'apps/web-3d/public/**',
      'apps/web-3d/next-env.d.ts',
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
  {
    files: ['packages/game-assets/library/**/*.mjs'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['apps/web-3d/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['services/*/src/**/*.ts', 'packages/nest-kit/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read configuration through the service config module.',
        },
      ],
    },
  },
  {
    files: ['services/*/src/config/**/*.ts', 'packages/nest-kit/src/testing/**/*.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: [
      'services/*/src/modules/**/controllers/*.ts',
      'services/*/src/modules/**/services/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client', '**/infrastructure/prisma/client'],
              message: 'Only repositories and the Prisma infrastructure may use the Prisma client.',
            },
          ],
        },
      ],
    },
  },
];
