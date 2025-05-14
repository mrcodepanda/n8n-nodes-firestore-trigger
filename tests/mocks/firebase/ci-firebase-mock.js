// Comprehensive Firebase mock for CI environment
// This mock is designed to make tests work properly in CI without any real Firebase credentials

// Collection of mock snapshots for different query types
const mockSnapshots = {
  document: {
    exists: true,
    data: () => ({ id: 'test-doc', value: 'test-value' }),
    id: 'test-doc',
    ref: { path: 'test-collection/test-doc' },
    metadata: { hasPendingWrites: false, fromCache: false }
  },
  collection: {
    docs: [
      {
        exists: true,
        data: () => ({ id: 'test-doc-1', value: 'test-value-1' }),
        id: 'test-doc-1',
        ref: { path: 'test-collection/test-doc-1' },
        metadata: { hasPendingWrites: false, fromCache: false }
      },
      {
        exists: true,
        data: () => ({ id: 'test-doc-2', value: 'test-value-2' }),
        id: 'test-doc-2',
        ref: { path: 'test-collection/test-doc-2' },
        metadata: { hasPendingWrites: false, fromCache: false }
      }
    ],
    empty: false,
    size: 2,
    metadata: { hasPendingWrites: false, fromCache: false }
  }
};

// Mock unsubscribe function for all listeners
const mockUnsubscribe = jest.fn().mockReturnValue(undefined);

// Create a function that returns a listener with simulateChange capability
const createMockListener = (type = 'document') => {
  const listener = jest.fn().mockReturnValue(mockUnsubscribe);
  
  // Add simulation capabilities
  listener.simulateChange = (changeType, data) => {
    const callbacks = listener.mock.calls[0];
    if (!callbacks || callbacks.length === 0) {
      console.warn('No callbacks registered for this listener');
      return;
    }
    
    const onNext = callbacks[0];
    if (typeof onNext !== 'function') {
      console.warn('First argument is not a callback function');
      return;
    }
    
    // Create a snapshot based on type
    const snapshot = type === 'document' ? 
      { ...mockSnapshots.document, data: () => data } : 
      { ...mockSnapshots.collection, docs: data };
    
    // Add changeType for collection changes
    if (type === 'collection') {
      snapshot.docChanges = () => [{
        type: changeType,
        doc: {
          exists: true,
          data: () => data[0].data(),
          id: data[0].id,
          ref: { path: `test-collection/${data[0].id}` },
          metadata: { hasPendingWrites: false, fromCache: false }
        }
      }];
    }
    
    // Call the callback with the snapshot
    onNext(snapshot);
  };
  
  return listener;
};

// Mock document reference
const createMockDocRef = () => {
  const mockOnSnapshot = createMockListener('document');
  
  return {
    onSnapshot: mockOnSnapshot,
    get: jest.fn().mockResolvedValue(mockSnapshots.document),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    collection: jest.fn().mockImplementation(path => createMockCollectionRef(path))
  };
};

// Mock collection reference
const createMockCollectionRef = (path = 'test-collection') => {
  const mockOnSnapshot = createMockListener('collection');
  const mockWhere = jest.fn().mockReturnThis();
  
  const collectionRef = {
    id: path.split('/').pop(),
    path: path,
    doc: jest.fn().mockImplementation(id => createMockDocRef(id)),
    where: mockWhere,
    onSnapshot: mockOnSnapshot,
    get: jest.fn().mockResolvedValue(mockSnapshots.collection),
    add: jest.fn().mockImplementation(data => {
      const id = `doc-${Date.now()}`;
      return Promise.resolve({
        id,
        path: `${path}/${id}`,
        ...createMockDocRef()
      });
    }),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    startAfter: jest.fn().mockReturnThis(),
    startAt: jest.fn().mockReturnThis(),
    endAt: jest.fn().mockReturnThis(),
    endBefore: jest.fn().mockReturnThis()
  };
  
  // Store a reference to the original where method
  collectionRef._originalWhere = mockWhere;
  
  return collectionRef;
};

// Mock Firestore instance
const mockFirestoreInstance = {
  collection: jest.fn().mockImplementation(path => createMockCollectionRef(path)),
  doc: jest.fn().mockImplementation(path => createMockDocRef(path)),
  settings: jest.fn(),
  runTransaction: jest.fn().mockImplementation(updateFn => {
    const mockTransaction = {
      get: jest.fn().mockResolvedValue(mockSnapshots.document),
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis()
    };
    return Promise.resolve(updateFn(mockTransaction));
  }),
  batch: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    commit: jest.fn().mockResolvedValue(undefined)
  })
};

// Mock service account for testing
const mockServiceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID || 'mock-project-id',
  private_key_id: 'mock-key-id',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCmxxxJ1uHNzL5\n-----END PRIVATE KEY-----\n',
  client_email: `mock-service-account@${process.env.FIREBASE_PROJECT_ID || 'mock-project-id'}.iam.gserviceaccount.com`,
  client_id: '123456789012345678901',
};

// Mock app instance
const mockAppInstance = {
  delete: jest.fn().mockResolvedValue(undefined),
  firestore: jest.fn().mockReturnValue(mockFirestoreInstance),
  options: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'mock-project-id',
    credential: mockServiceAccount
  }
};

// Mock cert and applicationDefault functions
const certFunction = jest.fn().mockImplementation((serviceAccount) => {
  console.log('Firebase Mock: cert() called with service account');
  
  // Validate the service account fields
  const validServiceAccount = serviceAccount && 
    serviceAccount.project_id && 
    serviceAccount.private_key && 
    serviceAccount.client_email;
  
  if (!validServiceAccount) {
    console.error('Firebase Mock: Invalid service account provided to cert()', serviceAccount);
    throw new Error('Firebase credential validation failed: Invalid service account format. The service account JSON is missing required fields.');
  }
  
  return { type: 'cert', serviceAccount };
});

const applicationDefaultFunction = jest.fn().mockImplementation(() => {
  console.log('Firebase Mock: applicationDefault() called');
  
  // Check if GOOGLE_APPLICATION_CREDENTIALS is set
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Firebase Mock: applicationDefault() called without GOOGLE_APPLICATION_CREDENTIALS');
    throw new Error('Firebase credential validation failed: Using Application Default Credentials but GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. You may need to run "gcloud auth application-default login" or set this environment variable to the path of your service account key file.');
  }
  
  return { type: 'applicationDefault' };
});

// Main Firebase mock
const mockFirebase = {
  // App management
  initializeApp: jest.fn().mockReturnValue(mockAppInstance),
  deleteApp: jest.fn().mockResolvedValue(undefined),
  getApp: jest.fn().mockReturnValue(mockAppInstance),
  getApps: jest.fn().mockReturnValue([mockAppInstance]),
  
  // Credential methods
  credential: {
    cert: certFunction,
    applicationDefault: applicationDefaultFunction,
    getApplicationDefault: jest.fn().mockResolvedValue({
      credential: mockServiceAccount,
      projectId: process.env.FIREBASE_PROJECT_ID || 'mock-project-id'
    })
  },
  
  // Firestore specific
  firestore: {
    FieldValue: {
      serverTimestamp: jest.fn().mockReturnValue("timestamp-value"),
      increment: jest.fn(val => `increment-${val}`),
      arrayUnion: jest.fn((...elements) => ({ _methodName: 'arrayUnion', _elements: elements })),
      arrayRemove: jest.fn((...elements) => ({ _methodName: 'arrayRemove', _elements: elements })),
      delete: jest.fn().mockReturnValue({ _methodName: 'delete' })
    },
    Timestamp: {
      now: jest.fn().mockReturnValue({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }),
      fromDate: jest.fn(date => ({ 
        seconds: Math.floor(date.getTime() / 1000), 
        nanoseconds: 0,
        toDate: () => date
      })),
      fromMillis: jest.fn(millis => ({ 
        seconds: Math.floor(millis / 1000), 
        nanoseconds: 0,
        toMillis: () => millis,
        toDate: () => new Date(millis)
      }))
    },
    GeoPoint: jest.fn((latitude, longitude) => ({ latitude, longitude })),
    setLogFunction: jest.fn(),
    // Make the Firestore constructor a mock function that returns our mock instance
    Firestore: jest.fn().mockImplementation(() => mockFirestoreInstance)
  },
  
  // Utils for tracking/resetting mocks
  apps: [mockAppInstance],
  app: jest.fn().mockReturnValue(mockAppInstance),
  
  // Helper functions for tests
  __getMockFirestore: () => mockFirestoreInstance,
  __getMockApp: () => mockAppInstance,
  __resetMocks: () => {
    // Reset all mock functions
    jest.clearAllMocks();
    
    // Reset apps array
    mockFirebase.apps.length = 0;
    mockFirebase.apps.push(mockAppInstance);
    
    console.log('CI Firebase mock reset completed');
  }
};

// Export cert and initializeApp as direct exports for firebase-admin/app
mockFirebase.cert = certFunction;
mockFirebase.initializeApp = mockFirebase.initializeApp;

// Log that we're using the CI-specific mock
console.log('🔥 Using comprehensive CI-specific Firebase mock with enhanced functionality');
console.log('   - Service Account credential method supported (cert)');
console.log('   - Application Default Credentials method supported (applicationDefault)');

module.exports = mockFirebase;