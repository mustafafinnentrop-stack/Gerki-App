module.exports = {
  extends: [
    '@electron-toolkit/eslint-config-ts'
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn'
  }
}
