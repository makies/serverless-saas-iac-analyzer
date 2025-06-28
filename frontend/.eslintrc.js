module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.js', 'amplify_outputs.*'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  rules: {
    // React Refresh
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],

    // TypeScript (基本ルールのみ)
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',

    // コード品質
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-duplicate-imports': 'error',
    'no-unused-expressions': 'error',

    // セキュリティ
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // フォーマット
    'no-trailing-spaces': 'error',
    'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
    'eol-last': ['error', 'always'],
    'semi': ['error', 'always'],

    // React Hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // その他
    'no-undef': 'off', // TypeScriptで型チェック
    'eqeqeq': ['error', 'always'],
  },
  overrides: [
    {
      // Amplify backend files (CDK) - eslint-cdk-pluginはFlatConfigのみ対応のため一時的にコメントアウト
      files: ['amplify/**/*.ts'],
      rules: {
        // AWS CDK専用ルール
        // '@aws-cdk/no-core-construct': 'error',
        // '@aws-cdk/no-qualified-construct': 'error',
        // '@aws-cdk/prefer-auto-generated-names': 'warn',
        // '@aws-cdk/no-unused-import': 'error',
        // '@aws-cdk/no-import-private': 'error',
        // '@aws-cdk/no-legacy-imports': 'error',
      },
    },
  ],
};
