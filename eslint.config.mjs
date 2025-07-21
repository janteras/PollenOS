export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 12,
      sourceType: 'module',
      globals: {
        require: true,
        module: true,
        process: true,
        console: true,
        setInterval: true,
        clearInterval: true,
        __dirname: true,
        Buffer: true,
        setTimeout: true,
        clearTimeout: true
      }
    },
    rules: {
      // Prettier will handle these formatting rules
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-unused-expressions': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-empty': 'error',
      'no-extra-semi': 'error',
      'no-extra-parens': ['error', 'all'],
      'no-unexpected-multiline': 'error',
      'no-multiple-empty-lines': ['error', { max: 2 }]
    }
  }
]
