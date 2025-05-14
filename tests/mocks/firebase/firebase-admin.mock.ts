/**
 * Consolidated Firebase Admin mock
 * Provides mocks for both firebase-admin and firebase-admin/firestore
 */

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

// Create mock functions
const mockWhere = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockUnsubscribe = jest.fn();

/**
 * Enhanced onSnapshot mock that handles different signature patterns
 * and provides methods to simulate events for testing
 */
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

// Document mock
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

// Collection mock
const mockCollection = jest.fn().mockReturnValue({
  doc: mockDoc,
  where: mockWhere,
  limit: mockLimit,
  orderBy: mockOrderBy,
  onSnapshot: mockOnSnapshot
});

// Firestore mock instance
const firestoreMock = {
  _settings: {
    databaseId: '(default)'
  },
  collection: mockCollection
};

// Firebase Admin App mock
const appMock = {
  delete: jest.fn().mockResolvedValue(undefined),
  name: 'test-app'
};

// Helper to create standard mock test data
const createTestData = () => ({
  document: {
    exists: true,
    data: () => ({ id: 'test-doc', value: 'test-value' }),
    id: 'test-doc',
    ref: { path: 'test-collection/test-doc' },
    metadata: { hasPendingWrites: false, fromCache: false }
  },
  documentChange: {
    type: 'added',
    doc: {
      id: 'test-doc',
      data: () => ({ name: 'Test Document', value: 100 }),
      ref: { path: 'test-collection/test-doc' },
      metadata: {
        hasPendingWrites: false,
        fromCache: false
      }
    }
  },
  collectionSnapshot: {
    docChanges: () => [{
      type: 'added',
      doc: {
        id: 'test-doc',
        data: () => ({ name: 'Test Document', value: 100 }),
        ref: { path: 'test-collection/test-doc' },
        metadata: {
          hasPendingWrites: false,
          fromCache: false
        }
      }
    }]
  }
});

// Reset all mocks to a clean state
const resetMocks = () => {
  mockWhere.mockClear();
  mockLimit.mockClear();
  mockOrderBy.mockClear();
  mockOnSnapshot.mockClear();
  mockUnsubscribe.mockClear();
  mockDoc.mockClear();
  mockCollection.mockClear();
  appMock.delete.mockClear();
  firestoreMock._settings = { databaseId: '(default)' };
};

// Set up exports
export {
  // Firestore mocks
  firestoreMock,
  mockWhere,
  mockLimit,
  mockOrderBy,
  mockOnSnapshot,
  mockUnsubscribe,
  mockDoc,
  mockCollection,
  
  // App mocks
  appMock,
  
  // Test data
  createTestData,
  
  // Utilities
  resetMocks
};

// Module exports for direct Jest mocking
module.exports = {
  getFirestore: jest.fn().mockReturnValue(firestoreMock),
  credential: {
    cert: jest.fn().mockReturnValue({}),
    applicationDefault: jest.fn().mockReturnValue({})
  },
  initializeApp: jest.fn().mockReturnValue(appMock),
  firestore: {
    FieldValue: {
      serverTimestamp: jest.fn().mockReturnValue("timestamp-value"),
      increment: jest.fn(val => `increment-${val}`)
    }
  }
};