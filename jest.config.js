module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', rootDir: '.' } }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
}
