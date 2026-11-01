import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import globals from 'globals';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      'coverage/**',
      'plans/**',
      'apps/api/drizzle/**',
      '**/*.d.ts',
    ],
  },
  {
    // Next.js settings only apply to the web app.
    settings: { next: { rootDir: 'apps/web/' } },
  },
  {
    // Legacy engine and its tests are CommonJS on Node; replaced in Phase 2 (plans/07-agent-runtime.md).
    files: ['apps/api/src/legacy/**/*.js', 'apps/api/test/legacy/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // Handlers share a long signature; unused parameters are expected. Removed in Phase 2.
      '@typescript-eslint/no-unused-vars': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', 'scripts/**/*.mjs', '**/*.test.mjs', '*.config.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Legacy dashboard components are replaced in Phase 3 of plans/14-roadmap.md.
    // Keep these as warnings so CI stays useful without rewriting them twice.
    files: ['apps/web/components/**/*.jsx'],
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      // Flags Date.now() inside event handlers declared in the component body (false positive here).
      'react-hooks/purity': 'warn',
      '@next/next/no-img-element': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
];

export default config;
