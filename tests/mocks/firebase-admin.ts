// Mock for firebase-admin module

// Mock Firestore collection
const mockWhere = jest.fn().mockReturnThis();
const mockOnSnapshot = jest.fn((options, onNext, onError) => {
  // Store the callbacks so they can be triggered in tests
  mockOnSnapshot.onNext = onNext;
  mockOnSnapshot.onError = onError;
  return mockUnsubscribe;
});

// Mock unsubscribe function that gets returned from onSnapshot
const mockUnsubscribe = jest.fn();

// Collection mock
const mockCollection = jest.fn().mockReturnValue({
  doc: jest.fn().mockReturnValue({
    onSnapshot: mockOnSnapshot,
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ id: 'test-doc', value: 'test-value' }),
      id: 'test-doc',
      ref: { path: 'test-collection/test-doc' },
      metadata: { hasPendingWrites: false, fromCache: false }
    })
  }),
  where: mockWhere,
  onSnapshot: mockOnSnapshot
});

// Firestore mock
const firestoreMock = jest.fn().mockReturnValue({
  collection: mockCollection
});

// Mock app
const appMock = {
  delete: jest.fn().mockResolvedValue(undefined)
};

// Export the mocks
module.exports = {
  credential: {
    applicationDefault: jest.fn().mockReturnValue({})
  },
  initializeApp: jest.fn().mockReturnValue(appMock),
  firestore: {
    FieldValue: {
      serverTimestamp: jest.fn().mockReturnValue("timestamp-value"),
      increment: jest.fn(val => `increment-${val}`)
    }
  },
  __getWhereMock: () => mockWhere,
  __getOnSnapshotMock: () => mockOnSnapshot.onNext,
  __getMockUnsubscribe: () => mockUnsubscribe,
  __getMockApp: () => appMock,
  __resetMocks: () => {
    mockWhere.mockClear();
    mockOnSnapshot.mockClear();
    mockUnsubscribe.mockClear();
    mockCollection.mockClear();
    firestoreMock.mockClear();
    appMock.delete.mockClear();
  }
};
