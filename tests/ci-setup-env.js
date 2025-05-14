/**
 * This file is loaded before any tests run in CI environment
 * It sets up environment variables and performs pre-test setup
 */

console.log('CI Setup Environment: Starting pre-test configuration');

// Set environment variables
process.env.CI = 'true';
process.env.TEST_MODE = 'ci';
process.env.FIREBASE_PROJECT_ID = 'mock-project-id';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

// Set absolute path to the credential file (still set this for compatibility)
const path = require('path');
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(__dirname, './mocks/mock-service-account.json');

console.log('CI Setup Environment: Set GOOGLE_APPLICATION_CREDENTIALS to', process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Create mock service account credential file
const fs = require('fs');
const mockServiceAccountPath = path.resolve(__dirname, './mocks/mock-service-account.json');

// Ensure the directory exists
const dir = path.dirname(mockServiceAccountPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log('CI Setup Environment: Created directory:', dir);
}

// Create a proper service account JSON with all required fields
const mockCredentials = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID || 'mock-project-id',
  private_key_id: 'mock-key-id',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCmxxxJ1uHNzL5\n-----END PRIVATE KEY-----\n',
  client_email: `mock-service-account@${process.env.FIREBASE_PROJECT_ID || 'mock-project-id'}.iam.gserviceaccount.com`,
  client_id: '123456789012345678901',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/mock-service-account%40${process.env.FIREBASE_PROJECT_ID || 'mock-project-id'}.iam.gserviceaccount.com`,
  universe_domain: 'googleapis.com'
};

// Write the mock service account file
fs.writeFileSync(mockServiceAccountPath, JSON.stringify(mockCredentials, null, 2));
console.log('CI Setup Environment: Created mock service account file at', mockServiceAccountPath);

// Preemptively mock firebase-admin to handle any direct imports
jest.mock('firebase-admin', () => require('./mocks/ci-firebase-mock'));

// Mock firebase-admin/app to handle cert function specifically
jest.mock('firebase-admin/app', () => {
  return {
    cert: jest.fn().mockReturnValue({}),
    getApp: jest.fn().mockImplementation((name) => {
      throw new Error(`App ${name} does not exist`);
    }),
    initializeApp: jest.fn().mockReturnValue({
      delete: jest.fn().mockResolvedValue(undefined)
    })
  };
});

// Mock fs readFileSync for service account files
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    readFileSync: (filePath, options) => {
      if (filePath.includes('service-account') || 
          filePath.includes('firebase') || 
          filePath === process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log('CI Setup Environment: Intercepted readFileSync for credential file:', filePath);
        return JSON.stringify(mockCredentials);
      }
      return originalFs.readFileSync(filePath, options);
    }
  };
});

console.log('CI Setup Environment: Firebase mock setup completed');

