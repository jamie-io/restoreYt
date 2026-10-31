// TypeScript sources are checked by `tsc --strict`; ESLint covers the plain
// JavaScript around them: build scripts, e2e and live tests.

const shared = {
  'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-undef': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'smart'],
};

const node = {
  process: 'readonly',
  console: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  AbortController: 'readonly',
  structuredClone: 'readonly',
};

// Code passed to page.evaluate() runs in the browser.
const browser = {
  window: 'readonly',
  document: 'readonly',
  location: 'readonly',
  innerHeight: 'readonly',
  Image: 'readonly',
  HTMLElement: 'readonly',
  atob: 'readonly',
  chrome: 'readonly',
};

export default [
  {
    files: ['**/*.js', '**/*.mjs'],
    ignores: ['build/**', '.dist/**', 'node_modules/**'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...node, ...browser } },
    rules: shared,
  },
];
