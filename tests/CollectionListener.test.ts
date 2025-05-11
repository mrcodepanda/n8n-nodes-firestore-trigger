import { FirestoreTrigger } from '../nodes/FirestoreTrigger/FirestoreTrigger.node';

// Set environment variable to use Firebase emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8001';

describe('Firestore Collection Listener', () => {
	let firestoreTrigger: FirestoreTrigger;
	
	// Create mock for ITriggerFunctions
	const mockTriggerFunctions = {
		getNodeParameter: jest.fn(),
		getCredentials: jest.fn(),
		getWorkflowStaticData: jest.fn(),
		helpers: {
			returnJsonArray: (items: any[]) => items,
		},
		emit: jest.fn()
	};
	
	// Setup before each test
	beforeEach(() => {
		// Create a new instance of the node
		firestoreTrigger = new FirestoreTrigger();
		
		// Set up mocks
		mockTriggerFunctions.getNodeParameter.mockImplementation((paramName: string, defaultValue?: any) => {
			const params: { [key: string]: any } = {
				operation: 'listenToCollection',
				collection: 'test-collection',
				events: ['added', 'modified', 'removed'],
				options: {}
			};
			return params[paramName] !== undefined ? params[paramName] : defaultValue;
		});
		
		mockTriggerFunctions.getCredentials.mockResolvedValue({
			projectId: 'n8n-firestore-trigger-test',
			authenticationMethod: 'applicationDefault',
		});
		
		mockTriggerFunctions.getWorkflowStaticData.mockReturnValue({});
		
		mockTriggerFunctions.emit.mockImplementation(() => true);
	});
	
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
		const manualResult = await response.manualTriggerFunction();
		
		// Verify it returns a success message
		expect(Array.isArray(manualResult)).toBe(true);
		expect(manualResult[0][0]).toHaveProperty('json');
		expect(manualResult[0][0].json).toHaveProperty('success', true);
	});
	
	it('should handle different event types in collection listener', async () => {
		// Set up more specific configuration to test events filtering
		mockTriggerFunctions.getNodeParameter.mockImplementation((paramName: string, defaultValue?: any) => {
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
		
		// Create a mock firestore snapshot change for an 'added' event
		const mockAddedChange = {
			type: 'added',
			doc: {
				id: 'test-doc-1',
				data: () => ({ name: 'Test Document 1', value: 100 }),
				ref: { path: 'test-collection/test-doc-1' },
				metadata: {
					hasPendingWrites: false,
					fromCache: false
				}
			}
		};
		
		// Get the onSnapshot handler from the mock
		const onSnapshotMock = require('firebase-admin/firestore').__getOnSnapshotMock();
		
		// Call the listener with a mock snapshot containing the 'added' change
		onSnapshotMock({
			docChanges: () => [mockAddedChange]
		});
		
		// Verify the emit was called with the correct data
		expect(mockTriggerFunctions.emit).toHaveBeenCalledTimes(1);
		
		// Verify the emitted data matches our expectations
		const emittedData = mockTriggerFunctions.emit.mock.calls[0][0];
		expect(emittedData[0][0].json.id).toBe('test-doc-1');
		expect(emittedData[0][0].json.changeType).toBe('added');
		expect(emittedData[0][0].json.data).toEqual({ name: 'Test Document 1', value: 100 });
		
		// Reset the mock for the next test
		mockTriggerFunctions.emit.mockClear();
		
		// Now test a 'removed' event, which should be filtered out
		const mockRemovedChange = {
			type: 'removed',
			doc: {
				id: 'test-doc-2',
				data: () => ({ name: 'Test Document 2', value: 200 }),
				ref: { path: 'test-collection/test-doc-2' },
				metadata: {
					hasPendingWrites: false,
					fromCache: false
				}
			}
		};
		
		// Call the listener with a mock snapshot containing the 'removed' change
		onSnapshotMock({
			docChanges: () => [mockRemovedChange]
		});
		
		// Verify emit was not called (event should be filtered out)
		expect(mockTriggerFunctions.emit).not.toHaveBeenCalled();
	});
	
	it('should apply query filters correctly', async () => {
		// Set up configuration with query filters
		mockTriggerFunctions.getNodeParameter.mockImplementation((paramName: string, defaultValue?: any) => {
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
		// Create a mock for unsubscribe function
		const mockUnsubscribe = jest.fn();
		
		// Store mock static data
		const mockStaticData: { [key: string]: any } = {
			unsubscribeFn: mockUnsubscribe
		};
		
		// Mock the getWorkflowStaticData to return our mock data
		mockTriggerFunctions.getWorkflowStaticData.mockReturnValue(mockStaticData);
		
		// Bind the mock functions to the trigger method
		const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);
		
		// Call the trigger method
		const response = await boundTrigger();
		
		// Call the close function
		await response.closeFunction();
		
		// Verify the unsubscribe function was called
		expect(mockUnsubscribe).toHaveBeenCalled();
		
		// Verify the unsubscribe function was deleted from static data
		expect(mockStaticData.unsubscribeFn).toBeUndefined();
	});
});
