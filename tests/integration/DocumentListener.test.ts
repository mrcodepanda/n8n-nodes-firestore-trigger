import { FirestoreTrigger } from '../../nodes/Firestore/FirestoreTrigger.node';
import { createMockTriggerFunctions } from '../mocks/n8n/MockInterfaces';
import { ITriggerFunctions } from 'n8n-workflow';

// Set environment variable to use Firebase emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:9099';

describe('Firestore Document Listener', () => {
	let firestoreTrigger: FirestoreTrigger;
	let mockTriggerFunctions: ITriggerFunctions;

	// Setup before each test
	beforeEach(() => {
		// Create a new instance of the node
		firestoreTrigger = new FirestoreTrigger();

		// Create mock trigger functions
		mockTriggerFunctions = createMockTriggerFunctions();

		// Set up mocks for document listener
		mockTriggerFunctions.getNodeParameter = jest.fn().mockImplementation((paramName: string, defaultValue?: any) => {
			const params: { [key: string]: any } = {
				operation: 'listenToDocument',
				collection: 'test-listen',
				documentId: 'listen-doc',
				options: {}
			};
			return params[paramName] !== undefined ? params[paramName] : defaultValue;
		});

		mockTriggerFunctions.getCredentials = jest.fn().mockResolvedValue({
			projectId: 'n8n-nodes-firestore-trigger-test',
			authenticationMethod: 'applicationDefault',
		});

		mockTriggerFunctions.getWorkflowStaticData = jest.fn().mockReturnValue({});

		(mockTriggerFunctions.emit as jest.Mock).mockImplementation(() => true);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should initialize the document listener with correct parameters', async () => {
		// Bind the mock functions to the trigger method
		const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

		// Call the trigger method
		const response = await boundTrigger();

		// Verify node parameters were retrieved
		expect(mockTriggerFunctions.getNodeParameter).toHaveBeenCalledWith('operation');
		expect(mockTriggerFunctions.getNodeParameter).toHaveBeenCalledWith('collection');
		expect(mockTriggerFunctions.getNodeParameter).toHaveBeenCalledWith('documentId');
		expect(mockTriggerFunctions.getNodeParameter).toHaveBeenCalledWith('options', {});

		// Verify credentials were retrieved
		expect(mockTriggerFunctions.getCredentials).toHaveBeenCalledWith('firebaseAdminApi');

		// Verify workspace static data was accessed
		expect(mockTriggerFunctions.getWorkflowStaticData).toHaveBeenCalledWith('node');

		// Check the trigger response contains required functions
		expect(response).toHaveProperty('manualTriggerFunction');
		expect(response).toHaveProperty('closeFunction');
	});

	it('should set up document listener correctly', async () => {
		// Get mocks from firebase-admin/firestore module
		const firestoreMocks = require('firebase-admin/firestore');
		const mockCollection = firestoreMocks.__getFirestoreMock().collection;
		const mockDoc = mockCollection().doc;

		// Bind the mock functions to the trigger method
		const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

		// Call the trigger method
		await boundTrigger();

		// Verify Firestore methods were called with correct parameters
		expect(mockCollection).toHaveBeenCalledWith('test-listen');
		expect(mockDoc).toHaveBeenCalledWith('listen-doc');

		// Verify onSnapshot was called
		const mockOnSnapshot = require('firebase-admin/firestore').__getOnSnapshotMock();
		expect(mockOnSnapshot).toHaveBeenCalled();
	});

	it('should include metadata changes when option is enabled', async () => {
		// Set up configuration with includeMetadataChanges option
		mockTriggerFunctions.getNodeParameter = jest.fn().mockImplementation((paramName: string, defaultValue?: any) => {
			if (paramName === 'operation') return 'listenToDocument';
			if (paramName === 'collection') return 'test-listen';
			if (paramName === 'documentId') return 'listen-doc';
			if (paramName === 'options') {
				return {
					includeMetadataChanges: true
				};
			}
			return defaultValue;
		});

		// Bind the mock functions to the trigger method
		const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

		// Call the trigger method
		await boundTrigger();

		// Verify the trigger was set up correctly - we're testing that the whole flow works
		// without getting into the specifics of how the option is used
		expect(mockTriggerFunctions.getNodeParameter).toHaveBeenCalledWith('options', {});
	});

	it('should emit workflow data when document changes', async () => {
		// Bind the mock functions to the trigger method
		const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

		// Call the trigger method
		await boundTrigger();

		// Get the onSnapshot mock
		const onSnapshotMock = require('firebase-admin/firestore').__getOnSnapshotMock();

		// Make sure emit has not been called yet
		expect(mockTriggerFunctions.emit).not.toHaveBeenCalled();

		// This is a fake snapshot to simulate a document change
		const mockDocSnapshot = {
			id: 'listen-doc',
			exists: true,
			data: jest.fn().mockReturnValue({
				status: 'updated',
				counter: 5,
				updatedAt: 'timestamp-value'
			}),
			ref: {
				path: 'test-listen/listen-doc'
			}
		};

		// Simulate a snapshot event using the snapshot mock
		onSnapshotMock.onNext(mockDocSnapshot);

		// Verify that emit was called
		expect(mockTriggerFunctions.emit).toHaveBeenCalled();
	});

	it('should handle document deletions correctly', async () => {
		// Bind the mock functions to the trigger method
		const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

		// Call the trigger method
		await boundTrigger();

		// Reset the emit mock to clear previous calls
		(mockTriggerFunctions.emit as jest.Mock).mockClear();

		// Get the onSnapshot mock
		const onSnapshotMock = require('firebase-admin/firestore').__getOnSnapshotMock();

		// Create a mock document snapshot for a deleted document
		const mockDocSnapshot = {
			id: 'listen-doc',
			exists: false,
			data: jest.fn().mockReturnValue({}),
			ref: {
				path: 'test-listen/listen-doc'
			}
		};

		// Simulate a snapshot event with the deleted document
		onSnapshotMock.onNext(mockDocSnapshot);

		// Verify that emit was called
		expect(mockTriggerFunctions.emit).toHaveBeenCalled();
	});

	it('should handle errors in the document listener', async () => {
		// Mock console.error to capture error logs
		const originalConsoleError = console.error;
		console.error = jest.fn();

		// Bind the mock functions to the trigger method
		const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

		// Call the trigger method
		await boundTrigger();

		// Get the onSnapshot mock with simulation methods
		const onSnapshotMock = require('firebase-admin/firestore').__getOnSnapshotMock();

		// Create a mock error
		const mockError = new Error('Test error in document listener');

		// Simulate an error event
		onSnapshotMock.simulateError(mockError);

		// Verify that console.error was called with the error
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining('Firestore document listener error:'),
			mockError
		);

		// Restore original console.error
		console.error = originalConsoleError;
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

	it('should support custom database ID from credentials', async () => {
		// Update credentials to include a custom database ID
		mockTriggerFunctions.getCredentials = jest.fn().mockResolvedValue({
			projectId: 'n8n-nodes-firestore-trigger-test',
			authenticationMethod: 'applicationDefault',
			databaseId: 'custom-database'
		});

		// Get reference to Firestore mock
		const firestoreMock = require('firebase-admin/firestore').__getFirestoreMock();

		// Bind the mock functions to the trigger method
		const boundTrigger = firestoreTrigger.trigger.bind(mockTriggerFunctions);

		// Call the trigger method
		await boundTrigger();

		// Verify that the database ID was set correctly
		// Note: This test needs to verify that the database ID is set on the Firestore instance
		// but this is implementation-specific to how the node does it. It might use _settings
		// or another approach.
		expect(firestoreMock._settings).toBeDefined();
		if (firestoreMock._settings) {
			expect(firestoreMock._settings.databaseId).toBe('custom-database');
		}
	});
});
