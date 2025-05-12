import { FirestoreTrigger } from '../nodes/FirestoreTrigger/FirestoreTrigger.node';
import { createMockTriggerFunctions } from './mocks/MockInterfaces';
import { ITriggerFunctions } from 'n8n-workflow';

// Set environment variable to use Firebase emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:9099';

describe('Firestore Collection Listener', () => {
	let firestoreTrigger: FirestoreTrigger;
	let mockTriggerFunctions: ITriggerFunctions;

	// Setup before each test
	beforeEach(() => {
		// Create a new instance of the node
		firestoreTrigger = new FirestoreTrigger();

		// Create mock trigger functions
		mockTriggerFunctions = createMockTriggerFunctions();

		// Set up mocks
		mockTriggerFunctions.getNodeParameter = jest.fn().mockImplementation((paramName: string, defaultValue?: any) => {
			const params: { [key: string]: any } = {
				operation: 'listenToCollection',
				collection: 'test-collection',
				events: ['added', 'modified', 'removed'],
				options: {}
			};
			return params[paramName] !== undefined ? params[paramName] : defaultValue;
		});

		mockTriggerFunctions.getCredentials = jest.fn().mockResolvedValue({
			projectId: 'n8n-firestore-trigger-test',
			authenticationMethod: 'applicationDefault',
		});

		mockTriggerFunctions.getWorkflowStaticData = jest.fn().mockReturnValue({});

		(mockTriggerFunctions.emit as jest.Mock).mockImplementation(() => true);
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

		// Create a mock snapshot with docChanges method that returns our change
		const mockSnapshot = {
			docChanges: () => [mockAddedChange]
		};

		// Simulate a snapshot event for collection
		onSnapshotMock.simulateSnapshot(mockSnapshot);

		// Verify the emit was called with the correct data
		expect(mockTriggerFunctions.emit).toHaveBeenCalledTimes(1);

		// Verify the emitted data matches our expectations
		const emittedData = (mockTriggerFunctions.emit as jest.Mock).mock.calls[0][0];
		expect(emittedData[0][0].json.id).toBe('test-doc-1');
		expect(emittedData[0][0].json.changeType).toBe('added');
		expect(emittedData[0][0].json.data).toEqual({ name: 'Test Document 1', value: 100 });

		// Reset the mock for the next test
		(mockTriggerFunctions.emit as jest.Mock).mockClear();

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

		// Create a mock snapshot with docChanges method that returns our removed change
		const mockSnapshotRemoved = {
			docChanges: () => [mockRemovedChange]
		};

		// Simulate a snapshot event with the removed document
		onSnapshotMock.simulateSnapshot(mockSnapshotRemoved);

		// Verify emit was not called (event should be filtered out)
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
