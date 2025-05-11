import {
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
	ITriggerFunctions,
	IDataObject,
} from 'n8n-workflow';

import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseApp, cleanupFirebaseApp } from './GenericFunctions';

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
				displayName: 'Collection',
				name: 'collection',
				type: 'string',
				default: '',
				required: true,
				description: 'The collection to listen to',
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

		// Start with detailed logging for debugging
		console.log('Firestore Trigger initializing');

		// Get node parameters
		const operation = this.getNodeParameter('operation') as string;
		const collection = this.getNodeParameter('collection') as string;
		const documentId =
			operation === 'listenToDocument'
				? (this.getNodeParameter('documentId') as string)
				: undefined;
		const events =
			operation === 'listenToCollection'
				? (this.getNodeParameter('events', []) as string[])
				: undefined;
		const options = this.getNodeParameter('options', {}) as IDataObject;

		console.log('Operation:', operation);
		console.log('Collection:', collection);
		if (documentId) console.log('Document ID:', documentId);
		console.log('Events:', events);
		console.log('Options:', JSON.stringify(options));

		// Get credentials
		const credentials = await this.getCredentials('firebaseAdminApi');
		console.log('Project ID:', credentials.projectId);

		// Initialize Firebase
		console.log('Initializing Firebase app...');
		const firebaseApp = initFirebaseApp(credentials);
		const db = getFirestore(firebaseApp);
		console.log('Firebase app initialized successfully');

		// Set database ID if specified
		if (credentials.databaseId && credentials.databaseId !== '(default)') {
			console.log(`Using database ID: ${credentials.databaseId}`);
			// @ts-ignore - _settings is not in the type definitions but works in practice
			db._settings = {
				// @ts-ignore
				...db._settings,
				databaseId: credentials.databaseId as string,
			};
		}

		// Variable to store unsubscribe function
		let unsubscribeFn: () => void;

		// Start the listener
		new Promise<void>((resolve, reject) => {
			try {
				// Store cleanup function for later
				webhookData.unsubscribeFn = () => {
					console.log('Cleanup function called');
					if (unsubscribeFn) {
						console.log('Unsubscribing from Firestore listener...');
						unsubscribeFn();
					}

					// Clean up Firebase app when no longer needed
					console.log('Cleaning up Firebase app...');
					cleanupFirebaseApp(credentials.projectId as string).catch((e: Error) =>
						console.error('Error cleaning up Firebase app:', e),
					);
				};

				// Set up snapshot options
				const snapshotOptions: any = {};
				if (options.includeMetadataChanges) {
					console.log('Including metadata changes in listener');
					snapshotOptions.includeMetadataChanges = true;
				}

				// Create the appropriate listener based on operation
				if (operation === 'listenToCollection') {
					// Using any to avoid type checking issues with Firestore types
					let query: any = db.collection(collection);

					console.log(`Setting up collection listener for: ${collection}`);

					// Add query filters if provided
					if (options.queryFilters && (options.queryFilters as IDataObject).filters) {
						const filters = (options.queryFilters as IDataObject).filters as IDataObject[];
						for (const filter of filters) {
							console.log(`Adding filter: ${filter.field} ${filter.operator} ${filter.value}`);
							query = query.where(filter.field as string, filter.operator as string, filter.value);
						}
					}

					try {
						// Set up collection listener with explicit callback functions
						unsubscribeFn = query.onSnapshot(
							(snapshot: any) => {
								console.log(
									`Received snapshot with ${snapshot.docChanges ? snapshot.docChanges().length : 0} changes`,
								);

								if (!snapshot.docChanges) {
									console.warn('Snapshot does not have docChanges method');
									return;
								}

								snapshot.docChanges().forEach((change: any) => {
									console.log(`Processing change of type: ${change.type}`);

									// Skip if the event type is not in the selected events
									if (events && !events.includes(change.type)) {
										console.log(`Skipping event type: ${change.type} (not in selected events)`);
										return;
									}

									try {
										if (!change.doc) {
											console.warn('Change does not have doc property');
											return;
										}

										// Get the document data safely
										const docData = change.doc.data ? change.doc.data() : {};
										const docId = change.doc.id || 'unknown';
										const docPath = change.doc.ref ? change.doc.ref.path : `${collection}/unknown`;

										// Create metadata object with safe property access
										const metadata = {
											hasPendingWrites:
												change.doc.metadata &&
												typeof change.doc.metadata.hasPendingWrites !== 'undefined'
													? change.doc.metadata.hasPendingWrites
													: false,
											fromCache:
												change.doc.metadata && typeof change.doc.metadata.fromCache !== 'undefined'
													? change.doc.metadata.fromCache
													: false,
										};

										const docInfo = {
											id: docId,
											data: docData,
											changeType: change.type,
											path: docPath,
											metadata: metadata,
											timestamp: Date.now(),
										};

										console.log(`Emitting data for document: ${docId}`);
										console.log(
											`Document data:`,
											JSON.stringify(docData).substring(0, 200) +
												(JSON.stringify(docData).length > 200 ? '...' : ''),
										);

										// Execute the workflow with the document data
										this.emit([[{ json: docInfo }]]);
									} catch (docError) {
										console.error('Error processing document change:', docError);
									}
								});
							},
							(error: Error) => {
								console.error('Firestore listener error:', error);
								// Don't reject as this would stop the trigger
							},
						);
						console.log('Collection listener setup complete');
					} catch (setupError) {
						console.error('Error setting up collection listener:', setupError);
						throw setupError;
					}
				}
				// Document listener with enhanced error handling and logging
				else if (operation === 'listenToDocument') {
					try {
						const docRef = db.collection(collection).doc(documentId as string);

						console.log(`Setting up document listener for: ${collection}/${documentId}`);

						// Set up document listener with explicit callback functions
						unsubscribeFn = docRef.onSnapshot(
							(doc: any) => {
								console.log(`Received document snapshot for: ${doc ? doc.id : 'unknown'}`);

								try {
									// Safely access document properties
									const docData = doc && doc.data ? doc.data() : {};
									const exists = doc ? !!doc.exists : false;
									const docPath = doc && doc.ref ? doc.ref.path : `${collection}/${documentId}`;

									// Create metadata object with safe property access
									const metadata = {
										hasPendingWrites:
											doc && doc.metadata && typeof doc.metadata.hasPendingWrites !== 'undefined'
												? doc.metadata.hasPendingWrites
												: false,
										fromCache:
											doc && doc.metadata && typeof doc.metadata.fromCache !== 'undefined'
												? doc.metadata.fromCache
												: false,
									};

									const docInfo = {
										id: doc ? doc.id : (documentId as string),
										data: docData,
										exists: exists,
										path: docPath,
										metadata: metadata,
										timestamp: Date.now(),
									};

									console.log(`Emitting data for document: ${docInfo.id}, exists: ${exists}`);
									console.log(
										`Document data:`,
										JSON.stringify(docData).substring(0, 200) +
											(JSON.stringify(docData).length > 200 ? '...' : ''),
									);

									// Execute the workflow with the document data
									this.emit([[{ json: docInfo }]]);
								} catch (docError) {
									console.error('Error processing document snapshot:', docError);
								}
							},
							(error: Error) => {
								console.error('Firestore document listener error:', error);
								// Don't reject as this would stop the trigger
							},
						);
						console.log('Document listener setup complete');
					} catch (setupError) {
						console.error('Error setting up document listener:', setupError);
						throw setupError;
					}
				}
			} catch (error) {
				console.error('Error setting up Firestore listener:', error);
				reject(error);
			}
		});

		// Use type assertion to bypass TypeScript's type checking for this special case
		return {
			// We need to return an object that satisfies ITriggerResponse
			closeFunction: async () => {
				console.log('Close function called - cleaning up resources');
				if (webhookData.unsubscribeFn) {
					try {
						(webhookData.unsubscribeFn as Function)();
					} catch (error) {
						console.error('Error during listener cleanup:', error);
					}
					delete webhookData.unsubscribeFn;
				}
			},

			// This function doesn't actually match what the interface expects,
			// but n8n uses it this way in practice. We'll use `any` to bypass TypeScript's checking.
			manualTriggerFunction: (async () => {
				console.log('Manual trigger function called for testing');
				return [
					[
						{
							json: {
								success: true,
								message: 'Firestore trigger is active and listening for changes.',
							},
						},
					],
				];
			}) as any,
		};
	}
}
