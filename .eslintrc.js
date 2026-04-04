module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',

    // 🔥 QUAN TRỌNG: luôn để prettier ở cuối
    'plugin:prettier/recommended',
  ],
  rules: {
    // 👉 tất cả format sẽ do prettier handle
    'prettier/prettier': 'error',

    // optional (tùy bạn)
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
};
