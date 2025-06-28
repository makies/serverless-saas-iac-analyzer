// .eslintrc.js (infrastructure用)

module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:aws-cdk/recommended'
  ],
  plugins: [
    '@typescript-eslint',
    'aws-cdk'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  rules: {
    // CDK専用ルール
    'aws-cdk/no-core-construct': 'error',           // aws-cdk-lib/core使用禁止
    'aws-cdk/no-qualified-construct': 'error',      // 完全修飾名回避
    'aws-cdk/prefer-auto-generated-names': 'warn',  // 自動生成名推奨
    'aws-cdk/no-unused-import': 'error',            // 未使用import検出
    'aws-cdk/no-import-private': 'error',           // private API使用禁止
    'aws-cdk/no-legacy-imports': 'error',           // 旧形式import禁止
    
    // TypeScript強化ルール
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-readonly': 'warn',
    
    // セキュリティルール
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  env: {
    node: true,
    es2022: true,
    jest: true
  }
};
