// Jest setup file

// Set up environment variables for CI or service account testing
if (process.env.CI || process.env.TEST_MODE === 'ci' || process.env.AUTH_METHOD === 'serviceAccount') {
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'mock-project-id';
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  
  // CI-specific mock: We bypass the regular mock system and use our enhanced CI mock
  console.log('Using CI-specific Firebase mock with service account support');
  jest.mock('firebase-admin', () => require('./mocks/ci-firebase-mock'), { virtual: true });
} else {
  // Make sure we have a valid credential path
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn('GOOGLE_APPLICATION_CREDENTIALS not set, using enhanced mocks');
    // Use our enhanced mocks
    jest.mock('firebase-admin', () => require('./mocks/enhanced-firebase-admin'));
  }
}

// Mock firebase-admin/firestore
jest.mock('firebase-admin/firestore', () => require('./mocks/firebase-admin-firestore'));

// Mock firebase-admin/app with proper cert support
jest.mock('firebase-admin/app', () => {
  // Create a cert mock that validates service account fields
  const certFunction = jest.fn().mockImplementation((serviceAccount) => {
    console.log('cert() called with service account');
    
    // Validate the service account fields
    const validServiceAccount = serviceAccount && 
      serviceAccount.project_id && 
      serviceAccount.private_key && 
      serviceAccount.client_email;
    
    if (!validServiceAccount) {
      console.error('Invalid service account provided to cert()', serviceAccount);
      throw new Error('Firebase credential validation failed: Invalid service account format. The service account JSON is missing required fields.');
    }
    
    return { type: 'cert', serviceAccount };
  });

  return {
    cert: certFunction,
    getApp: jest.fn().mockImplementation((name) => {
      throw new Error(`App ${name} does not exist`);
    }),
    initializeApp: jest.fn().mockReturnValue({
      delete: jest.fn().mockResolvedValue(undefined)
    })
  };
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset custom mocks
  const firebaseAdmin = require('firebase-admin');
  if (firebaseAdmin.__resetMocks) {
    firebaseAdmin.__resetMocks();
  }
  
  const firebaseFirestore = require('firebase-admin/firestore');
  if (firebaseFirestore.__resetMocks) {
    firebaseFirestore.__resetMocks();
  }
});
