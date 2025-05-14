const mockFirebase = {
  initializeApp: jest.fn().mockReturnValue({
    delete: jest.fn().mockResolvedValue(undefined),
    firestore: jest.fn().mockReturnValue({})
  }),
  credential: {
    cert: jest.fn().mockReturnValue({}),
    applicationDefault: jest.fn().mockReturnValue({}),
    // Add this to handle Application Default Credentials explicitly
    getApplicationDefault: jest.fn().mockResolvedValue({
      credential: {},
      projectId: process.env.FIREBASE_PROJECT_ID || 'mock-project-id'
    })
  },
  firestore: {
    setLogFunction: jest.fn(),
    Timestamp: {
      now: jest.fn().mockReturnValue({ seconds: 1000, nanoseconds: 0 })
    },
    FieldValue: {
      serverTimestamp: jest.fn().mockReturnValue("timestamp-value"),
      increment: jest.fn(val => `increment-${val}`)
    }
  },
  apps: [],
  app: jest.fn().mockReturnValue({
    firestore: jest.fn().mockReturnValue({})
  }),
  __resetMocks: () => {
    mockFirebase.initializeApp.mockClear();
    mockFirebase.credential.cert.mockClear();
    mockFirebase.credential.applicationDefault.mockClear();
    mockFirebase.credential.getApplicationDefault.mockClear();
    mockFirebase.apps.length = 0;
  }
};

module.exports = mockFirebase;
