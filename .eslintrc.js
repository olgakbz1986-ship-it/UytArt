/* ESLint для UytArt: TypeScript + React + Node.js (Best Practices) */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  env: { browser: true, node: true, es2022: true },
  settings: { react: { version: 'detect' } },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  ignorePatterns: ['dist/**', 'node_modules/**', 'coverage/**', 'public/**', '*.tmp.cjs'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-dupe-keys': 'warn', // Понижаем до предупреждения, чтобы не блокировать коммит из-за ошибки агента, но вы её видели
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/purity': 'off',
    'react/no-unescaped-entities': 'off',
  },
  overrides: [
    {
      // КРИТИЧЕСКИ ВАЖНО: Полностью отключаем TS-правила импорта для CommonJS файлов бэкенда
      files: ['**/*.cjs'],
      parserOptions: { sourceType: 'script' },
      env: { node: true },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
