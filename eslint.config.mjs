import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
  ]),
  {
    // This package is CommonJS (no "type": "module"), so its .js config files
    // legitimately use require().
    files: ['*.config.js', '*.setup.js', '*.environment.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Must stay last: turns off the stylistic rules that Prettier owns.
  prettier,
]);

export default eslintConfig;
