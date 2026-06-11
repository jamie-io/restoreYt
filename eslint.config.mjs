export default [
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'no-console': 'off',
    },
    languageOptions: {
      globals: {
        chrome: 'readonly',
        browser: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        MutationObserver: 'readonly',
        Node: 'readonly',
        sessionStorage: 'readonly',
        WeakSet: 'readonly',
        Map: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
  },
];
