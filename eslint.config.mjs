import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';

const config = [
  ...nextVitals,
  {
    ignores: ['.next/**', 'node_modules/**', 'backend/node_modules/**', 'coverage/**', 'plans/**'],
  },
  {
    // The Express backend is CommonJS running on Node.
    files: ['backend/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'import/no-anonymous-default-export': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', '**/*.test.mjs', '*.config.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Legacy dashboard components are being replaced in Phase 3 of plans/14-roadmap.md.
    // Keep these as warnings so CI stays useful without rewriting them twice.
    files: ['frontend/components/**/*.jsx'],
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      // Flags Date.now() inside event handlers declared in the component body (false positive here).
      'react-hooks/purity': 'warn',
      '@next/next/no-img-element': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
];

export default config;
