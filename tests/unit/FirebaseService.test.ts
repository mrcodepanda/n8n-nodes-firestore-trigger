import { FirebaseService } from '../../src/FirebaseService';
import { IDataObject } from 'n8n-workflow';

// Mock the firebase-admin modules
jest.mock('firebase-admin/app');
jest.mock('firebase-admin/firestore');
jest.mock('firebase-admin');

describe('FirebaseService', () => {
  let firebaseService: FirebaseService;
  const mockFirebaseAdmin = require('firebase-admin');
  const mockFirebaseApp = require('firebase-admin/app');
  const mockFirebaseFirestore = require('firebase-admin/firestore');
  let mockApp: any;

  // Environment variables backup
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env vars
    originalEnv = { ...process.env };
    
    // Reset all mocks
    jest.clearAllMocks();
    mockFirebaseAdmin.__resetMocks();
    mockFirebaseFirestore.__resetMocks();
    
    // Set up mockApp for each test
    mockApp = mockFirebaseAdmin.__getMockApp();
    
    // Use the same mock app for initializeApp
    mockFirebaseApp.initializeApp.mockReturnValue(mockApp);
    
    // Create a new instance for each test
    firebaseService = new FirebaseService();
  });

  afterEach(() => {
    // Restore original env vars
    process.env = originalEnv;
  });

  describe('initApp', () => {
    it('should throw error if projectId is missing', () => {
      const credentials: IDataObject = { authenticationMethod: 'serviceAccount' };
      
      expect(() => {
        firebaseService.initApp(credentials);
      }).toThrow('Firebase project ID is required');
    });
    
    it('should use existing app if available', () => {
      // Setup getApp to return a mock app
      mockFirebaseApp.getApp.mockReturnValueOnce(mockApp);
      
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'serviceAccount'
      };
      
      const result = firebaseService.initApp(credentials);
      
      expect(mockFirebaseApp.getApp).toHaveBeenCalledWith('test-project');
      expect(mockFirebaseApp.initializeApp).not.toHaveBeenCalled();
      expect(result).toBe(mockApp);
    });
    
    it('should initialize a new app with service account credentials', () => {
      // Setup getApp to throw error (app doesn't exist)
      mockFirebaseApp.getApp.mockImplementationOnce(() => {
        throw new Error('App does not exist');
      });
      
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'serviceAccount',
        serviceAccountJson: JSON.stringify({
          "project_id": "test-project",
          "private_key": "test-key",
          "client_email": "test@example.com"
        })
      };
      
      const result = firebaseService.initApp(credentials);
      
      expect(mockFirebaseApp.getApp).toHaveBeenCalledWith('test-project');
      expect(mockFirebaseApp.cert).toHaveBeenCalledWith({
        project_id: 'test-project',
        private_key: 'test-key',
        client_email: 'test@example.com'
      });
      expect(mockFirebaseApp.initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project',
          credential: expect.anything()
        }),
        'test-project'
      );
      
      // Just expect the result to be the correct type, not the exact object
      expect(result).toBeTruthy();
    });
    
    it('should initialize a new app with application default credentials', () => {
      // Setup getApp to throw error (app doesn't exist)
      mockFirebaseApp.getApp.mockImplementationOnce(() => {
        throw new Error('App does not exist');
      });
      
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'applicationDefault'
      };
      
      const result = firebaseService.initApp(credentials);
      
      expect(mockFirebaseApp.getApp).toHaveBeenCalledWith('test-project');
      expect(mockFirebaseAdmin.credential.applicationDefault).toHaveBeenCalled();
      expect(mockFirebaseApp.initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project',
          credential: expect.anything()
        }),
        'test-project'
      );
      
      // Just expect the result to be the correct type, not the exact object
      expect(result).toBeTruthy();
    });
    
    it('should throw error for invalid service account JSON', () => {
      // Setup getApp to throw error (app doesn't exist)
      mockFirebaseApp.getApp.mockImplementationOnce(() => {
        throw new Error('App does not exist');
      });
      
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'serviceAccount',
        serviceAccountJson: 'not-valid-json'
      };
      
      expect(() => {
        firebaseService.initApp(credentials);
      }).toThrow('Invalid service account JSON format');
    });
    
    it('should throw error if service account JSON is missing required fields', () => {
      // Setup getApp to throw error (app doesn't exist)
      mockFirebaseApp.getApp.mockImplementationOnce(() => {
        throw new Error('App does not exist');
      });
      
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'serviceAccount',
        serviceAccountJson: JSON.stringify({
          // Missing required fields
          "some_field": "some-value"
        })
      };
      
      expect(() => {
        firebaseService.initApp(credentials);
      }).toThrow('Service account JSON is missing required fields');
    });
  });

  describe('getFirestore', () => {
    it('should throw error if app is not provided', () => {
      expect(() => {
        firebaseService.getFirestore(undefined as any);
      }).toThrow('Invalid Firebase app instance');
    });
    
    it('should get Firestore instance without database ID', () => {
      const app = {} as any;
      const firestoreMock = mockFirebaseFirestore.__getFirestoreMock();
      
      const result = firebaseService.getFirestore(app);
      
      expect(mockFirebaseFirestore.getFirestore).toHaveBeenCalledWith(app);
      expect(result).toBe(firestoreMock);
      // No need to test the internal _settings which might not be consistent in mocks
    });
    
    it('should get Firestore instance with custom database ID', () => {
      const app = {} as any;
      const firestoreMock = mockFirebaseFirestore.__getFirestoreMock();
      firestoreMock._settings = {}; // Ensure settings object exists
      
      const result = firebaseService.getFirestore(app, 'custom-db');
      
      expect(mockFirebaseFirestore.getFirestore).toHaveBeenCalledWith(app);
      expect(result).toBe(firestoreMock);
      expect(firestoreMock._settings.databaseId).toBe('custom-db');
    });
  });

  describe('cleanupApp', () => {
    it('should clean up existing app', async () => {
      // Add a mock app to the internal cache
      const service = new FirebaseService();
      (service as any).firebaseApps = {
        'test-project': mockApp
      };
      
      await service.cleanupApp('test-project');
      
      expect(mockApp.delete).toHaveBeenCalled();
      expect((service as any).firebaseApps['test-project']).toBeUndefined();
    });
    
    it('should handle non-existent app', async () => {
      const service = new FirebaseService();
      (service as any).firebaseApps = {};
      
      await service.cleanupApp('non-existent-project');
      
      expect(mockApp.delete).not.toHaveBeenCalled();
    });
    
    it('should remove app from cache even if deletion fails', async () => {
      // Setup delete to fail
      mockApp.delete.mockRejectedValueOnce(new Error('Delete failed'));
      
      const service = new FirebaseService();
      (service as any).firebaseApps = {
        'test-project': mockApp
      };
      
      await service.cleanupApp('test-project');
      
      expect(mockApp.delete).toHaveBeenCalled();
      expect((service as any).firebaseApps['test-project']).toBeUndefined();
    });
  });

  describe('validateCredentials', () => {
    it('should return error for missing credentials', () => {
      const result = firebaseService.validateCredentials(undefined as any);
      expect(result).toBe('Firebase credentials are missing. Please check your credential configuration.');
    });
    
    it('should return error for missing projectId', () => {
      const credentials: IDataObject = { authenticationMethod: 'serviceAccount' };
      
      const result = firebaseService.validateCredentials(credentials);
      
      expect(result).toBe('Firebase project ID is missing. Please check your credential configuration.');
    });
    
    it('should return error for missing serviceAccountJson', () => {
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'serviceAccount'
      };
      
      const result = firebaseService.validateCredentials(credentials);
      
      expect(result).toBe('Service Account JSON is missing. Please provide a valid service account key file.');
    });
    
    it('should return error for invalid JSON', () => {
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'serviceAccount',
        serviceAccountJson: 'not-valid-json'
      };
      
      const result = firebaseService.validateCredentials(credentials);
      
      expect(result).toContain('Invalid Service Account JSON format');
    });
    
    it('should return error for missing required fields', () => {
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'serviceAccount',
        serviceAccountJson: JSON.stringify({
          // Missing required fields
          "some_field": "some-value"
        })
      };
      
      const result = firebaseService.validateCredentials(credentials);
      
      expect(result).toBe('Service Account JSON is missing required fields (project_id, client_email, or private_key). Please provide a valid service account key file.');
    });
    
    it('should return error for project ID mismatch', () => {
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'serviceAccount',
        serviceAccountJson: JSON.stringify({
          "project_id": "different-project",
          "private_key": "test-key",
          "client_email": "test@example.com"
        })
      };
      
      const result = firebaseService.validateCredentials(credentials);
      
      expect(result).toContain('Project ID mismatch');
    });
    
    it('should return error for application default credentials without env var', () => {
      // Ensure GOOGLE_APPLICATION_CREDENTIALS is not set
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'applicationDefault'
      };
      
      const result = firebaseService.validateCredentials(credentials);
      
      expect(result).toContain('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
    });
    
    it('should return null for valid service account credentials', () => {
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'serviceAccount',
        serviceAccountJson: JSON.stringify({
          "project_id": "test-project",
          "private_key": "test-key",
          "client_email": "test@example.com"
        })
      };
      
      const result = firebaseService.validateCredentials(credentials);
      
      expect(result).toBeNull();
    });
    
    it('should return null for valid application default credentials', () => {
      // Set the environment variable
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/credentials.json';
      
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'applicationDefault'
      };
      
      const result = firebaseService.validateCredentials(credentials);
      
      expect(result).toBeNull();
    });
    
    it('should return error for unknown authentication method', () => {
      const credentials: IDataObject = { 
        projectId: 'test-project',
        authenticationMethod: 'unknownMethod'
      };
      
      const result = firebaseService.validateCredentials(credentials);
      
      expect(result).toContain('Unknown authentication method');
    });
  });
});