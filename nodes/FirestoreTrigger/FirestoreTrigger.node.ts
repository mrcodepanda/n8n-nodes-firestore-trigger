import {
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
	ITriggerFunctions,
	IDataObject,
	NodeOperationError,
	INodeExecutionData,
} from 'n8n-workflow';

import { Firestore } from 'firebase-admin/firestore';

// Import required dependencies
import { pathHandler } from '../../src/PathHandler';
import { firebaseService } from '../../src/FirebaseService';
import { listenerManager } from '../../src/ListenerManager';

export class FirestoreTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Firestore Trigger',
		name: 'firestoreTrigger',
		icon: 'file:firestore.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["collection"]}}',
		description: 'Starts the workflow when Firestore events occur',
		defaults: {
			name: 'Firestore Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'firebaseAdminApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Listen to Collection',
						value: 'listenToCollection',
						action: 'Listen for changes in a collection',
						description: 'Listen for changes in a collection',
					},
					{
						name: 'Listen to Document',
						value: 'listenToDocument',
						action: 'Listen for changes in a document',
						description: 'Listen for changes in a document',
					},
				],
				default: 'listenToCollection',
				required: true,
			},
			{
				displayName: 'Collection Path',
				name: 'collection',
				type: 'string',
				default: '',
				required: true,
				description: 'The collection path to listen to (e.g., "users", "users/:userId/orders", "chats/:chatId/messages")',
				placeholder: 'users/:userId/orders',
			},
			{
				displayName: 'Path Format Guide',
				name: 'pathFormatGuide',
				type: 'notice',
				default: '',
				description: 'You can use colon parameters in paths (e.g., "collection/:param/subcollection") to create dynamic listeners that respond to any matching document. For fixed paths, use normal segments (e.g., "users/user123/orders").',
			},
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['listenToDocument'],
					},
				},
				required: true,
				description: 'The ID of the document to listen to',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{
						name: 'Added',
						value: 'added',
						description: 'Document added to the collection',
					},
					{
						name: 'Modified',
						value: 'modified',
						description: 'Document modified in the collection',
					},
					{
						name: 'Removed',
						value: 'removed',
						description: 'Document removed from the collection',
					},
				],
				default: ['added', 'modified', 'removed'],
				displayOptions: {
					show: {
						operation: ['listenToCollection'],
					},
				},
				description: 'The events to listen to',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Include Metadata Changes',
						name: 'includeMetadataChanges',
						type: 'boolean',
						default: false,
						description: 'Whether to listen for metadata changes',
					},
					{
						displayName: 'Query Filters',
						name: 'queryFilters',
						placeholder: 'Add Filter',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						options: [
							{
								name: 'filters',
								displayName: 'Filter',
								values: [
									{
										displayName: 'Field',
										name: 'field',
										type: 'string',
										default: '',
										description: 'Field name to filter on',
									},
									{
										displayName: 'Operator',
										name: 'operator',
										type: 'options',
										options: [
											{ name: 'Array Contains', value: 'array-contains' },
											{ name: 'Equal', value: '==' },
											{ name: 'Greater Than', value: '>' },
											{ name: 'Greater Than or Equal', value: '>=' },
											{ name: 'Less Than', value: '<' },
											{ name: 'Less Than or Equal', value: '<=' },
											{ name: 'Not Equal', value: '!=' },
										],
										default: '==',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Value to compare with',
									},
								],
							},
						],
					},
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const webhookData = this.getWorkflowStaticData('node');

		// Get node parameters
		const operation = this.getNodeParameter('operation') as string;
		const collectionPath = this.getNodeParameter('collection') as string;
		let documentId: string | undefined;

		// Validate inputs
		if (!collectionPath || collectionPath.trim() === '') {
			throw new NodeOperationError(this.getNode(), 'Collection path cannot be empty');
		}

		// For document listeners, get and validate the document ID
		if (operation === 'listenToDocument') {
			documentId = this.getNodeParameter('documentId') as string;
			if (!documentId || documentId.trim() === '') {
				throw new NodeOperationError(this.getNode(), 'Document ID cannot be empty');
			}
		}

		// Get events and options
		const events = operation === 'listenToCollection'
			? (this.getNodeParameter('events', []) as string[])
			: undefined;
		const options = this.getNodeParameter('options', {}) as IDataObject;

		// Get credentials and initialize Firebase
		const credentials = await this.getCredentials('firebaseAdminApi');
		const validationError = firebaseService.validateCredentials(credentials);
		if (validationError) {
			throw new NodeOperationError(this.getNode(), `Firebase credential validation failed: ${validationError}`);
		}

		// Initialize Firebase
		const firebaseApp = firebaseService.initApp(credentials);
		const db = firebaseService.getFirestore(firebaseApp, credentials.databaseId as string | undefined);

		// Store the Firebase app for cleanup later
		webhookData.firebaseApp = firebaseApp;

		// Set up unsubscribe function
		let unsubscribeFn: (() => void) | undefined;

		// Set up the appropriate listener based on the operation type
		if (operation === 'listenToCollection') {
			const pathInfo = pathHandler.parsePath(collectionPath);

			if (pathInfo.hasParameters) {
				// Dynamic collection listener with parameters
				unsubscribeFn = await listenerManager.createDynamicListener(
					db as Firestore,
					collectionPath,
					{
						events: events || ['added', 'modified', 'removed'],
						includeMetadataChanges: options.includeMetadataChanges as boolean,
						queryFilters: options.queryFilters as IDataObject,
						// @ts-expect-error - Type compatibility issue between object[] and IDataObject[]
						emitFn: (data: IDataObject[]) => {
							const executionData = data.map(item => ({ json: item }));
							this.emit([executionData as INodeExecutionData[]]);
						},
					}
				);
			} else {
				// Static collection listener
				unsubscribeFn = listenerManager.createCollectionListener(
					db as Firestore,
					collectionPath,
					{
						events: events || ['added', 'modified', 'removed'],
						includeMetadataChanges: options.includeMetadataChanges as boolean,
						queryFilters: options.queryFilters as IDataObject,
						// @ts-expect-error - Type compatibility issue between object[] and IDataObject[]
						emitFn: (data: IDataObject[]) => {
							const executionData = data.map(item => ({ json: item }));
							this.emit([executionData as INodeExecutionData[]]);
						},
					}
				);
			}
		} else if (operation === 'listenToDocument' && documentId) {
			// Document listener
			unsubscribeFn = listenerManager.createDocumentListener(
				db as Firestore,
				collectionPath,
				documentId,
				{
					includeMetadataChanges: options.includeMetadataChanges as boolean,
					// @ts-expect-error - Type compatibility issue between object[] and IDataObject[]
					emitFn: (data: IDataObject[]) => {
						const executionData = data.map(item => ({ json: item }));
						this.emit([executionData as INodeExecutionData[]]);
					},
				}
			);
		}

		// Store the unsubscribe function for later cleanup
		webhookData.unsubscribeFn = unsubscribeFn;

		// Return the trigger response
		return {
			closeFunction: async () => {
				// Cleanup any active listeners
				if (webhookData.unsubscribeFn) {
					try {
						(webhookData.unsubscribeFn as () => void)();
					} catch (error) {
						// Just log the error, don't throw during cleanup
						console.error('Error during listener cleanup:', (error as Error).message);
					}
					delete webhookData.unsubscribeFn;
				}

				// Clean up Firebase app if needed
				if (webhookData.firebaseApp) {
					try {
						// @ts-expect-error - Compatibility issue with App.delete()
						if (webhookData.firebaseApp.delete) {
							// @ts-expect-error - Compatibility issue with App.delete()
							webhookData.firebaseApp.delete().catch((e: Error) => {
								console.error('Error when cleaning up Firebase app:', e);
							});
						}
						delete webhookData.firebaseApp;
					} catch (error) {
						console.error('Error when cleaning up Firebase app:', error);
					}
				}
			},

			// @ts-expect-error - The manual trigger function doesn't match the exact type expected
			manualTriggerFunction: async () => {
				return [[
					{
						json: {
							success: true,
							message: 'Firestore trigger is active and listening for changes.',
						},
					},
				]];
			},
		};
	}
}
