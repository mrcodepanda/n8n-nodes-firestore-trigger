/**
 * Test utilities and helper functions
 * This file provides common utilities for testing Firestore triggers
 */

import { ITriggerFunctions } from 'n8n-workflow';
import { createMockTriggerFunctions } from './n8n/MockInterfaces';

/**
 * Setup collection listener parameters for tests
 * Creates a mock of getNodeParameter that returns values for a collection listener test
 */
export function setupCollectionListenerParams(
  events = ['added', 'modified', 'removed'],
  collection = 'test-collection',
  options = {}
): jest.Mock {
  return jest.fn().mockImplementation((paramName: string, defaultValue?: any) => {
    const params: { [key: string]: any } = {
      operation: 'listenToCollection',
      collection,
      events,
      options
    };
    return params[paramName] !== undefined ? params[paramName] : defaultValue;
  });
}

/**
 * Setup document listener parameters for tests
 * Creates a mock of getNodeParameter that returns values for a document listener test
 */
export function setupDocumentListenerParams(
  collection = 'test-collection',
  documentId = 'test-doc',
  options = {}
): jest.Mock {
  return jest.fn().mockImplementation((paramName: string, defaultValue?: any) => {
    const params: { [key: string]: any } = {
      operation: 'listenToDocument',
      collection,
      documentId,
      options
    };
    return params[paramName] !== undefined ? params[paramName] : defaultValue;
  });
}

/**
 * Setup dynamic path listener parameters for tests
 * Creates a mock of getNodeParameter that returns values for a dynamic path listener test
 */
export function setupDynamicPathListenerParams(
  pattern = 'users/:userId/orders',
  events = ['added', 'modified', 'removed'],
  options = {}
): jest.Mock {
  return jest.fn().mockImplementation((paramName: string, defaultValue?: any) => {
    const params: { [key: string]: any } = {
      operation: 'listenToCollection',
      collection: pattern,
      events,
      options
    };
    return params[paramName] !== undefined ? params[paramName] : defaultValue;
  });
}

/**
 * Setup standard Firebase credentials for tests
 */
export function setupFirebaseCredentials(
  projectId = 'test-project'
): jest.Mock {
  return jest.fn().mockResolvedValue({
    projectId,
    authenticationMethod: 'applicationDefault',
  });
}

/**
 * Setup a complete test environment for integration tests
 * Returns initialized mock trigger functions and helpers
 */
export function setupTestEnvironment(
  operationType: 'collection' | 'document' | 'dynamic' = 'collection',
  options = {}
): { 
  mockTriggerFunctions: ITriggerFunctions
} {
  const mockTriggerFunctions = createMockTriggerFunctions();
  
  // Set up parameter mocks based on operation type
  if (operationType === 'collection') {
    mockTriggerFunctions.getNodeParameter = setupCollectionListenerParams(['added', 'modified', 'removed'], 'test-collection', options);
  } else if (operationType === 'document') {
    mockTriggerFunctions.getNodeParameter = setupDocumentListenerParams('test-collection', 'test-doc', options);
  } else if (operationType === 'dynamic') {
    mockTriggerFunctions.getNodeParameter = setupDynamicPathListenerParams('users/:userId/orders', ['added', 'modified', 'removed'], options);
  }
  
  // Set up credentials
  mockTriggerFunctions.getCredentials = setupFirebaseCredentials();
  
  // Set up workflow static data
  mockTriggerFunctions.getWorkflowStaticData = jest.fn().mockReturnValue({});
  
  // Return the mock trigger functions
  return { mockTriggerFunctions };
}

/**
 * Clean up after a test
 */
export function cleanupTest(): void {
  jest.clearAllMocks();
}