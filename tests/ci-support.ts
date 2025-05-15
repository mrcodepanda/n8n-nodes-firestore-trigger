// Skip Firebase credential tests in CI
if (process.env.TEST_MODE === 'ci') {
  jest.mock('../nodes/Firestore/GenericFunctions', () => ({
    initializeFirebaseApp: jest.fn().mockResolvedValue({
      app: {
        delete: jest.fn().mockResolvedValue(undefined)
      },
      db: {}
    }),
    cleanupFirebaseApp: jest.fn().mockResolvedValue(undefined)
  }));
}
