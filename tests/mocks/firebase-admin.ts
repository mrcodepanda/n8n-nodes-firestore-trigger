// Mock for firebase-admin module

// Avoid name collision with firebase-admin-firestore.ts
const adminMocks = {
  appMock: {
    delete: jest.fn().mockResolvedValue(undefined)
  }
};

// Export the mocks
module.exports = {
  credential: {
    applicationDefault: jest.fn().mockReturnValue({})
  },
  initializeApp: jest.fn().mockReturnValue(adminMocks.appMock),
  firestore: {
    FieldValue: {
      serverTimestamp: jest.fn().mockReturnValue("timestamp-value"),
      increment: jest.fn(val => `increment-${val}`)
    }
  },
  __getMockApp: () => adminMocks.appMock,
  __resetMocks: () => {
    adminMocks.appMock.delete.mockClear();
  }
};
