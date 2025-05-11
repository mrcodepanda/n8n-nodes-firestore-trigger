// Jest setup file

// Mock firebase-admin
jest.mock('firebase-admin', () => require('./mocks/firebase-admin'));

// Mock firebase-admin/firestore
jest.mock('firebase-admin/firestore', () => require('./mocks/firebase-admin-firestore'));

// Mock firebase-admin/app
jest.mock('firebase-admin/app', () => ({
  cert: jest.fn().mockReturnValue({}),
  getApp: jest.fn().mockImplementation((name) => {
    throw new Error(`App ${name} does not exist`);
  }),
  initializeApp: jest.fn().mockReturnValue({
    delete: jest.fn().mockResolvedValue(undefined)
  })
}));

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
