/* ESLint для UytArt: TypeScript + React (ЗАДАЧА 5, п.18) */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
  ],
  env: { browser: true, node: true, es2022: true },
  settings: { react: { version: 'detect' } },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  ignorePatterns: ['dist/**', 'node_modules/**', 'coverage/**', 'public/**'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  overrides: [
    {
      files: ['**/*.cjs', '*.cjs', '.eslintrc.js'],
      parserOptions: { sourceType: 'script' },
      env: { node: true },
    },
    {
      files: ['tests/**/*'],
      rules: { '@typescript-eslint/no-var-requires': 'off' },
    },
  ],
};
