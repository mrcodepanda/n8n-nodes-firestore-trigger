// Mock for firebase-admin/firestore module

const mockWhere = jest.fn().mockReturnThis();
const mockOnSnapshot = jest.fn((options, onNext, onError) => {
  // Store the callbacks so they can be triggered in tests
  mockOnSnapshot.onNext = onNext;
  mockOnSnapshot.onError = onError;
  return mockUnsubscribe;
});

// Mock unsubscribe function
const mockUnsubscribe = jest.fn();

// Firestore mock instance
const firestoreMock = {
  collection: jest.fn().mockReturnValue({
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
  })
};

// Export getFirestore function
module.exports = {
  getFirestore: jest.fn().mockReturnValue(firestoreMock),
  __getWhereMock: () => mockWhere,
  __getOnSnapshotMock: () => mockOnSnapshot,
  __getFirestoreMock: () => firestoreMock,
  __getMockUnsubscribe: () => mockUnsubscribe,
  __resetMocks: () => {
    mockWhere.mockClear();
    mockOnSnapshot.mockClear();
    mockUnsubscribe.mockClear();
    firestoreMock.collection.mockClear();
    module.exports.getFirestore.mockClear();
  }
};
