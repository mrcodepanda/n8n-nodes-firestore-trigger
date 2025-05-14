import { FirestoreTrigger } from '../../nodes/FirestoreTrigger/FirestoreTrigger.node';
import { createMockTriggerFunctions } from '../mocks/n8n/MockInterfaces';
import { ITriggerFunctions } from 'n8n-workflow';

// Set environment variable to use Firebase emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:9099';

/**
 * Test suite for Firestore Collection Listener functionality
 */
describe('Firestore Collection Listener', () => {
  let firestoreTrigger: FirestoreTrigger;
  let mockTriggerFunctions: ITriggerFunctions;

  // Setup before each test
  beforeEach(() => {
    // Create a new instance of the node
    firestoreTrigger = new FirestoreTrigger();

    // Create mock trigger functions
    mockTriggerFunctions = createMockTriggerFunctions();

    // Set up mocks for the collection listener tests
    mockTriggerFunctions.getNodeParameter = jest.fn().mockImplementation((paramName: string, defaultValue?: any) => {
      const params: { [key: string]: any } = {
        operation: 'listenToCollection',
        collection: 'test-collection',
        events: ['added', 'modified', 'removed'],
        options: {}
      };
      return params[paramName] !== undefined ? params[paramName] : defaultValue;
    });

    // Configure credentials mock
    mockTriggerFunctions.getCredentials = jest.fn().mockResolvedValue({
      projectId: 'n8n-nodes-firestore-trigger-test',
      authenticationMethod: 'applicationDefault',
    });

    // Mock workflow static data
    mockTriggerFunctions.getWorkflowStaticData = jest.fn().mockReturnValue({});

    // Mock emit function
    (mockTriggerFunctions.emit as jest.Mock).mockImplementation(() => true);
  });

  // Clean up after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize the node with correct parameters', async () => {
    // Bind the mock functions to the trigger method
    const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

    // Call the trigger method
    const response = await boundTrigger();

    // Verify node parameters were retrieved
    expect(mockTriggerFunctions.getNodeParameter).toHaveBeenCalledWith('operation');
    expect(mockTriggerFunctions.getNodeParameter).toHaveBeenCalledWith('collection');
    expect(mockTriggerFunctions.getNodeParameter).toHaveBeenCalledWith('events', []);

    // Verify credentials were retrieved
    expect(mockTriggerFunctions.getCredentials).toHaveBeenCalledWith('firebaseAdminApi');

    // Verify workspace static data was accessed
    expect(mockTriggerFunctions.getWorkflowStaticData).toHaveBeenCalledWith('node');

    // Check the trigger response contains required functions
    expect(response).toHaveProperty('manualTriggerFunction');
    expect(response).toHaveProperty('closeFunction');
  });

  it('should support the manualTriggerFunction for testing', async () => {
    // Bind the mock functions to the trigger method
    const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

    // Call the trigger method
    const response = await boundTrigger();

    // Call the manual trigger function
    const manualResult = await response.manualTriggerFunction?.();

    // Verify it returns a success message
    expect(Array.isArray(manualResult)).toBe(true);

    if (manualResult) {
      // Use type assertion to tell TypeScript we know the structure
      const resultData = manualResult as unknown as any[][];
      expect(resultData[0][0]).toHaveProperty('json');
      expect(resultData[0][0].json).toHaveProperty('success', true);
    }
  });

  it('should handle different event types in collection listener', async () => {
    // Set up more specific configuration to test events filtering
    mockTriggerFunctions.getNodeParameter = jest.fn().mockImplementation((paramName: string, defaultValue?: any) => {
      const params: { [key: string]: any } = {
        operation: 'listenToCollection',
        collection: 'test-collection',
        events: ['added', 'modified'],  // Only listen for added and modified (not removed)
        options: {}
      };
      return params[paramName] !== undefined ? params[paramName] : defaultValue;
    });

    // Bind the mock functions to the trigger method
    const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

    // Start the listener
    await boundTrigger();

    // Get the onSnapshot handler from the mock
    const onSnapshotMock = require('firebase-admin/firestore').__getOnSnapshotMock();

    // Reset the emit mock to ensure fresh state
    (mockTriggerFunctions.emit as jest.Mock).mockClear();

    // We need to directly call the onSnapshot handler with properly formatted data
    // First, get the callback function that was registered
    const callback = onSnapshotMock.mock.calls[0][0];
    
    // Call the callback with a mock snapshot for 'added' event
    callback({
      docChanges: () => [{
        type: 'added',
        doc: {
          id: 'test-doc-1',
          data: () => ({ name: 'Test Document 1', value: 100 }),
          ref: { path: 'test-collection/test-doc-1' },
          exists: true,
          metadata: {
            hasPendingWrites: false,
            fromCache: false
          }
        }
      }]
    });

    // Verify that emit was called for the 'added' event
    expect(mockTriggerFunctions.emit).toHaveBeenCalled();
    
    // Reset the emit mock for the next test
    (mockTriggerFunctions.emit as jest.Mock).mockClear();

    // Call the callback again with a 'removed' event (should be filtered out)
    callback({
      docChanges: () => [{
        type: 'removed',
        doc: {
          id: 'test-doc-2',
          data: () => ({ name: 'Test Document 2', value: 200 }),
          ref: { path: 'test-collection/test-doc-2' },
          exists: false,
          metadata: {
            hasPendingWrites: false,
            fromCache: false
          }
        }
      }]
    });

    // Emit should not be called for 'removed' event since we only configured the listener
    // to respond to 'added' and 'modified' events
    expect(mockTriggerFunctions.emit).not.toHaveBeenCalled();
  });

  it('should apply query filters correctly', async () => {
    // Set up configuration with query filters
    mockTriggerFunctions.getNodeParameter = jest.fn().mockImplementation((paramName: string, defaultValue?: any) => {
      if (paramName === 'operation') return 'listenToCollection';
      if (paramName === 'collection') return 'test-collection';
      if (paramName === 'events') return ['added', 'modified', 'removed'];
      if (paramName === 'options') {
        return {
          queryFilters: {
            filters: [
              {
                field: 'value',
                operator: '>',
                value: 150
              }
            ]
          }
        };
      }
      return defaultValue;
    });

    // Bind the mock functions to the trigger method
    const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

    // Start the listener
    await boundTrigger();

    // Check that where() method was called with the correct filter
    const whereMock = require('firebase-admin/firestore').__getWhereMock();
    expect(whereMock).toHaveBeenCalledWith('value', '>', 150);
  });

  it('should clean up resources when closing the trigger', async () => {
    // Get reference to the mock unsubscribe function
    const mockUnsubscribe = require('firebase-admin/firestore').__getMockUnsubscribe();
    mockUnsubscribe.mockClear();  // Clear any previous calls

    // Store mock static data - create a proper mock for the unsubscribe function
    const mockStaticData: { [key: string]: any } = {};

    // Mock the getWorkflowStaticData to return our mock data
    mockTriggerFunctions.getWorkflowStaticData = jest.fn().mockReturnValue(mockStaticData);

    // Bind the mock functions to the trigger method
    const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

    // Call the trigger method - this should set up the listener and store the unsubscribe function
    const response = await boundTrigger();

    // At this point, the node should have created an unsubscribeFn in the static data
    // We'll replace it with our controlled mock function so we can verify it was called
    const originalUnsubscribeFn = mockStaticData.unsubscribeFn;
    const mockUnsubscribeWrapper = jest.fn(() => {
      // Call the original function to maintain behavior
      if (typeof originalUnsubscribeFn === 'function') {
        originalUnsubscribeFn();
      }
    });
    mockStaticData.unsubscribeFn = mockUnsubscribeWrapper;

    // Call the close function
    await response.closeFunction?.();

    // Verify our wrapper unsubscribe function was called
    expect(mockUnsubscribeWrapper).toHaveBeenCalled();

    // Verify the unsubscribe function was deleted from static data
    expect(mockStaticData.unsubscribeFn).toBeUndefined();
  });
});
