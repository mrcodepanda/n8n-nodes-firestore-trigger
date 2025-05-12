// Mock for firebase-admin/firestore module

// Define an explicit type for onSnapshot to include onNext and onError properties
interface OnSnapshotMock extends jest.Mock {
  onNext?: (snapshot: any) => void;
  onError?: (error: Error) => void;
  // Method to simulate a snapshot event for testing
  simulateSnapshot?: (snapshot: any) => void;
  // Method to simulate an error event for testing
  simulateError?: (error: Error) => void;
  // Store options for later checking
  options?: any;
}

const mockWhere = jest.fn().mockReturnThis();
const mockUnsubscribe = jest.fn();

// Create a more robust onSnapshot mock that handles different signature patterns
const mockOnSnapshot: OnSnapshotMock = jest.fn((...args) => {
  // Handle different calling patterns:
  // onSnapshot(callback) - 1 arg
  // onSnapshot(options, callback) - 2 args
  // onSnapshot(onNext, onError) - 2 args
  // onSnapshot(options, onNext, onError) - 3 args
  
  let options = {};
  let onNext;
  let onError;
  
  if (args.length === 1) {
    // Single callback
    onNext = args[0];
  } else if (args.length === 2) {
    // Either (options, callback) or (onNext, onError)
    if (typeof args[1] === 'function') {
      // It's (onNext, onError)
      onNext = args[0];
      onError = args[1];
    } else {
      // It's (options, callback)
      options = args[0];
      onNext = args[1];
    }
  } else if (args.length === 3) {
    // Full (options, onNext, onError)
    options = args[0];
    onNext = args[1];
    onError = args[2];
  }
  
  // Store the callbacks and options for later use in tests
  mockOnSnapshot.options = options || {};
  mockOnSnapshot.onNext = onNext;
  mockOnSnapshot.onError = onError;
  
  // Add methods to simulate events for testing
  mockOnSnapshot.simulateSnapshot = (snapshot) => {
    if (mockOnSnapshot.onNext) {
      mockOnSnapshot.onNext(snapshot);
    }
  };
  
  mockOnSnapshot.simulateError = (error) => {
    if (mockOnSnapshot.onError) {
      mockOnSnapshot.onError(error);
    }
  };
  
  return mockUnsubscribe;
});

// Doc mock
const mockDoc = jest.fn().mockReturnValue({
  onSnapshot: mockOnSnapshot,
  get: jest.fn().mockResolvedValue({
    exists: true,
    data: () => ({ id: 'test-doc', value: 'test-value' }),
    id: 'test-doc',
    ref: { path: 'test-collection/test-doc' },
    metadata: { hasPendingWrites: false, fromCache: false }
  })
});

// Firestore mock instance
const firestoreMock = {
  _settings: {
    databaseId: '(default)'
  },
  collection: jest.fn().mockReturnValue({
    doc: mockDoc,
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
  __getMockDoc: () => mockDoc,
  __resetMocks: () => {
    mockWhere.mockClear();
    mockOnSnapshot.mockClear();
    mockUnsubscribe.mockClear();
    mockDoc.mockClear();
    firestoreMock.collection.mockClear();
    firestoreMock._settings = { databaseId: '(default)' };
    module.exports.getFirestore.mockClear();
  }
};
