/**
 * Pre-test configuration script for using service account credentials
 * This runs automatically before tests to set up the test environment
 */

// Set default environment variables for tests
const path = require('path');
const fs = require('fs');

console.log('Pre-test environment setup:');

// Set environment variables for service account authentication
process.env.AUTH_METHOD = 'serviceAccount';
process.env.FIREBASE_PROJECT_ID = 'mock-project-id';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

// Create the mock service account file if it doesn't exist
const mockServiceAccountPath = path.resolve(__dirname, './mocks/mock-service-account.json');

// Create the directory structure if it doesn't exist
const dir = path.dirname(mockServiceAccountPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log(`- Created directory: ${dir}`);
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
console.log(`- Created mock service account file at: ${mockServiceAccountPath}`);

// Set GOOGLE_APPLICATION_CREDENTIALS to the absolute path of the mock file
process.env.GOOGLE_APPLICATION_CREDENTIALS = mockServiceAccountPath;
console.log(`- Set GOOGLE_APPLICATION_CREDENTIALS to: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

// Export environment variables to a .env file that Jest can read
const envContent = `
# Generated by setup-test-env.js - Do not edit manually
AUTH_METHOD=serviceAccount
FIREBASE_PROJECT_ID=${process.env.FIREBASE_PROJECT_ID}
FIRESTORE_EMULATOR_HOST=${process.env.FIRESTORE_EMULATOR_HOST}
GOOGLE_APPLICATION_CREDENTIALS=${mockServiceAccountPath}
`;

fs.writeFileSync(path.resolve(__dirname, '../.env.jest'), envContent);
console.log('- Created .env.jest file for Jest environment');

// Write environment variables to a file that will be loaded by Jest
const envFile = `
module.exports = {
  AUTH_METHOD: 'serviceAccount',
  FIREBASE_PROJECT_ID: '${process.env.FIREBASE_PROJECT_ID}',
  FIRESTORE_EMULATOR_HOST: '${process.env.FIRESTORE_EMULATOR_HOST}',
  GOOGLE_APPLICATION_CREDENTIALS: '${mockServiceAccountPath}'
};
`;

fs.writeFileSync(path.resolve(__dirname, './test-env-vars.js'), envFile);
console.log('- Created test-env-vars.js for Jest environment');

console.log('Pre-test environment setup complete!');
