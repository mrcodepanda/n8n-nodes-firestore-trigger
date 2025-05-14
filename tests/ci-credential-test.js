// CI test script for Firebase credentials with focus on Service Account authentication
console.log('--- Firebase Credentials Test Script (Service Account Focus) ---');
console.log('Environment variables:');
console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
console.log('- FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
console.log('- CI:', process.env.CI);
console.log('- TEST_MODE:', process.env.TEST_MODE);
console.log('- AUTH_METHOD:', process.env.AUTH_METHOD);

const fs = require('fs');
const path = require('path');

// Check if credential file exists
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const absolutePath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log('Absolute credential path:', absolutePath);
    
    const fileExists = fs.existsSync(absolutePath);
    console.log('Credential file exists:', fileExists);
    
    if (fileExists) {
      const stats = fs.statSync(absolutePath);
      console.log('Credential file size:', stats.size, 'bytes');
      
      // Log file permissions
      console.log('File permissions:', stats.mode.toString(8));
      
      // Check file content
      try {
        const content = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
        console.log('Credential file is valid JSON:', !!content);
        console.log('Contains project_id:', !!content.project_id);
        console.log('Contains private_key:', !!content.private_key);
        console.log('Contains client_email:', !!content.client_email);
        
        // These fields are required for a valid service account
        const isValidServiceAccount = content.type === 'service_account' && 
                                      content.project_id && 
                                      content.private_key && 
                                      content.client_email;
        
        console.log('Is valid service account:', isValidServiceAccount);
        
        if (!isValidServiceAccount) {
          console.error('ERROR: Service account file is missing required fields!');
          console.error('Service account must have type, project_id, private_key, and client_email fields.');
        }
      } catch (e) {
        console.error('Error parsing credential file:', e.message);
      }
    }
  } catch (e) {
    console.error('Error checking credential file:', e.message);
  }
} else {
  console.log('GOOGLE_APPLICATION_CREDENTIALS is not set');
}

// Try to mock importing Firebase Admin to test our mocks
try {
  console.log('\nTesting Firebase Admin Import:');
  const admin = require('firebase-admin');
  console.log('  - Firebase Admin imported successfully');
  
  // Check cert function
  console.log('\nTesting cert() function:');
  try {
    const credential = require('firebase-admin/app');
    console.log('  - firebase-admin/app imported successfully');
    
    // Create a test service account
    const testServiceAccount = {
      type: 'service_account',
      project_id: 'test-project',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCmxxxJ1uHNzL5\n-----END PRIVATE KEY-----\n',
      client_email: 'test@test-project.iam.gserviceaccount.com'
    };
    
    // Test cert function
    try {
      const certResult = credential.cert(testServiceAccount);
      console.log('  - cert() function called successfully:', certResult);
    } catch (e) {
      console.error('  - Error calling cert():', e.message);
    }
  } catch (e) {
    console.error('  - Error importing firebase-admin/app:', e.message);
  }
  
  // Try initializing Firebase with a service account
  console.log('\nSimulating Firebase initialization with Service Account:');
  
  // Create an initialization function that matches our real code
  function initFirebaseApp(credentials) {
    console.log('  - Init called with credentials:', JSON.stringify(credentials).substring(0, 100) + '...');
    
    const projectId = credentials.projectId;
    console.log('  - Project ID:', projectId);
    
    let appConfig = { projectId };
    
    try {
      if (credentials.authenticationMethod === 'serviceAccount') {
        console.log('  - Using Service Account authentication method');
        
        let serviceAccountJson;
        try {
          // Parse the service account JSON if it's a string
          if (typeof credentials.serviceAccountJson === 'string') {
            console.log('  - Parsing service account JSON from string');
            serviceAccountJson = JSON.parse(credentials.serviceAccountJson);
          } else {
            serviceAccountJson = credentials.serviceAccountJson;
          }
          
          console.log('  - Service account JSON:', JSON.stringify(serviceAccountJson).substring(0, 100) + '...');
          
          // Validate fields
          if (!serviceAccountJson.project_id || !serviceAccountJson.private_key || !serviceAccountJson.client_email) {
            throw new Error('Service account JSON is missing required fields');
          }
          
          // Use cert to create credential
          const { cert } = require('firebase-admin/app');
          appConfig.credential = cert(serviceAccountJson);
          console.log('  - Created credential with cert() successfully');
        } catch (error) {
          console.error('  - Error parsing service account JSON:', error.message);
          throw error;
        }
      } else {
        // Use application default credentials
        console.log('  - Using Application Default Credentials authentication method');
        appConfig.credential = admin.credential.applicationDefault();
        console.log('  - Created credential with applicationDefault() successfully');
      }
      
      // Initialize app
      console.log('  - Initializing Firebase app with config');
      const app = admin.initializeApp(appConfig, projectId);
      console.log('  - App initialized successfully:', app !== null);
      
      return app;
    } catch (error) {
      console.error('  - Firebase initialization error:', error.message);
      throw error;
    }
  }
  
  // Now test with service account credentials
  try {
    // Read the service account file
    const serviceAccountPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
    
    // Create credentials object matching the structure expected by initFirebaseApp
    const credentials = {
      projectId: process.env.FIREBASE_PROJECT_ID || 'mock-project-id',
      authenticationMethod: 'serviceAccount', 
      serviceAccountJson: serviceAccountContent
    };
    
    // Try to initialize Firebase
    const app = initFirebaseApp(credentials);
    console.log('  - Test initialization succeeded:', app !== null);
  } catch (e) {
    console.error('  - Test initialization failed:', e.message);
  }
  
} catch (e) {
  console.error('\nError in Firebase testing:', e.message);
}

console.log('\n--- Test Script Completed ---');
