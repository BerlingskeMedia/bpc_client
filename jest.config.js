module.exports = {
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.ts',
  ],
  transform: {
    '^.+\\.(ts|js)?$': 'babel-jest',
  },
  clearMocks: true,
};
