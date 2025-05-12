import {
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
	ITriggerFunctions,
	IDataObject,
	NodeOperationError,
} from 'n8n-workflow';

import { getFirestore } from 'firebase-admin/firestore';
import {
	initFirebaseApp,
	cleanupFirebaseApp,
	parsePath,
	findFirstParameterParentPath,
	registerPatternListener,
	createPatternListenerKey,
	unregisterPatternListener,
	registerListener,
	createDocumentListenerKey,
	isPathParameter,
	extractParameterName,
	patternListeners,
	activeListeners,
	validateFirebaseCredentials
} from './GenericFunctions';

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

		// Start with detailed logging for debugging
		console.log('Firestore Trigger initializing');

		// Get node parameters
		const operation = this.getNodeParameter('operation') as string;
		let collectionPath = this.getNodeParameter('collection') as string;
		
		// Validate collection path - this is critical
		if (!collectionPath || collectionPath.trim() === '') {
			throw new NodeOperationError(this.getNode(), 'Collection path cannot be empty');
		}
		
		// Normalize the collection path to remove any extra spaces or slashes
		collectionPath = collectionPath.trim();
		// Remove leading and trailing slashes if present
		collectionPath = collectionPath.replace(/^\/+|\/+$/g, '');
		
		// Validate that we still have a path after normalization
		if (collectionPath === '') {
			throw new NodeOperationError(this.getNode(), 'Collection path cannot be empty');
		}
		
		// Verify each path segment is valid
		const pathSegments = collectionPath.split('/');
		for (const segment of pathSegments) {
			if (segment.trim() === '' && !segment.startsWith(':')) {
				throw new NodeOperationError(
					this.getNode(), 
					`Invalid collection path: "${collectionPath}" contains empty segments`
				);
			}
		}
		
		const documentId =
			operation === 'listenToDocument'
				? (this.getNodeParameter('documentId') as string)
				: undefined;
				
		// Validate document ID when needed
		if (operation === 'listenToDocument' && (!documentId || documentId.trim() === '')) {
			throw new NodeOperationError(this.getNode(), 'Document ID cannot be empty');
		}
		
		const events =
			operation === 'listenToCollection'
				? (this.getNodeParameter('events', []) as string[])
				: undefined;
		const options = this.getNodeParameter('options', {}) as IDataObject;

		console.log('Operation:', operation);
		console.log('Collection path:', collectionPath);
		if (documentId) console.log('Document ID:', documentId);
		console.log('Events:', events);
		console.log('Options:', JSON.stringify(options));

		// Get credentials
		const credentials = await this.getCredentials('firebaseAdminApi');
		
		// Validate credentials before proceeding
		const validationError = validateFirebaseCredentials(credentials);
		if (validationError) {
			throw new NodeOperationError(
				this.getNode(),
				`Firebase credential validation failed: ${validationError}`
			);
		}
		
		console.log('Project ID:', credentials.projectId);

		// Initialize Firebase with better error handling
		console.log('Initializing Firebase app...');
		let firebaseApp;
		try {
			firebaseApp = initFirebaseApp(credentials);
		} catch (error) {
			const message = (error as Error).message;
			console.error('Firebase initialization error:', message);
			
			throw new NodeOperationError(
				this.getNode(),
				`Firebase authentication error: ${message.includes('default credentials') ? 
					'Could not load Firebase credentials. Please verify your credential configuration in n8n.' : 
					message}`
			);
		}
		
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

		// Variable to store main unsubscribe function
		let mainUnsubscribeFn: () => void;

		// Set up snapshot options
		const snapshotOptions: any = {};
		if (options.includeMetadataChanges) {
			console.log('Including metadata changes in listener');
			snapshotOptions.includeMetadataChanges = true;
		}

		// Start the listener
		new Promise<void>((resolve, reject) => {
			try {
				// Check if we need to set up a dynamic path listener with parameters
				const pathAnalysis = parsePath(collectionPath);

				if (operation === 'listenToCollection' && pathAnalysis.hasParameters) {
					console.log(`Setting up dynamic path listener for: ${collectionPath}`);
					setupDynamicCollectionListener.call(
						this,
						db,
						collectionPath,
						events as string[],
						snapshotOptions,
						options
					).then((unsubscribeFn) => {
						mainUnsubscribeFn = unsubscribeFn;
					}).catch((error) => {
						console.error('Error setting up dynamic collection listener:', error);
						reject(error);
					});
				}
				// Static collection listener
				else if (operation === 'listenToCollection') {
					console.log(`Setting up static collection listener for: ${collectionPath}`);
					mainUnsubscribeFn = setupCollectionListener.call(
						this,
						db,
						collectionPath,
						events as string[],
						snapshotOptions,
						options
					);
				}
				// Document listener
				else if (operation === 'listenToDocument') {
					console.log(`Setting up document listener for: ${collectionPath}/${documentId}`);
					mainUnsubscribeFn = setupDocumentListener.call(
						this,
						db,
						collectionPath,
						documentId as string,
						snapshotOptions
					);
				}

				// Store cleanup function for later
				webhookData.unsubscribeFn = () => {
					console.log('Cleanup function called');

					if (mainUnsubscribeFn) {
						console.log('Unsubscribing from main Firestore listener...');
						mainUnsubscribeFn();
					}

					// Clean up Firebase app when no longer needed
					console.log('Cleaning up Firebase app...');
					cleanupFirebaseApp(credentials.projectId as string).catch((e: Error) =>
						console.error('Error cleaning up Firebase app:', e),
					);
				};
			} catch (error) {
				console.error('Error setting up Firestore listener:', error);
				reject(error);
			}
		});

		// Return the trigger response
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

/**
 * Set up a listener for a static collection
 */
function setupCollectionListener(
	this: ITriggerFunctions,
	db: any,
	collectionPath: string,
	events: string[],
	snapshotOptions: any,
	options: IDataObject
): () => void {
	// Additional safety check to ensure collection path is valid
	if (!collectionPath || collectionPath.trim() === '') {
		throw new NodeOperationError(this.getNode(), 'Cannot set up listener: Collection path is empty');
	}
	
	console.log(`Setting up collection listener for: "${collectionPath}"`);
	
	// Using any to avoid type checking issues with Firestore types
	let query: any;
	
	try {
		// Create collection reference
		query = db.collection(collectionPath);
		if (!query) {
			throw new NodeOperationError(this.getNode(), `Failed to create collection reference for path: ${collectionPath}`);
		}
		
		// Add query filters if provided
		if (options.queryFilters && (options.queryFilters as IDataObject).filters) {
			const filters = (options.queryFilters as IDataObject).filters as IDataObject[];
			for (const filter of filters) {
				console.log(`Adding filter: ${filter.field} ${filter.operator} ${filter.value}`);
				query = query.where(filter.field as string, filter.operator as string, filter.value);
			}
		}
		
		// Set up collection listener with explicit callback functions
		const unsubscribeFn = query.onSnapshot(
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
						const docPath = change.doc.ref ? change.doc.ref.path : `${collectionPath}/unknown`;

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
			}
		);
		
		console.log('Collection listener setup complete');
		return unsubscribeFn;
		
	} catch (setupError) {
		console.error('Error setting up collection listener:', setupError);
		throw setupError;
	}
}

/**
 * Set up a listener for a specific document
 */
function setupDocumentListener(
	this: ITriggerFunctions,
	db: any,
	collectionPath: string,
	documentId: string,
	snapshotOptions: any
): () => void {
	try {
		const docRef = db.collection(collectionPath).doc(documentId);

		console.log(`Setting up document listener for: ${collectionPath}/${documentId}`);

		// Set up document listener with explicit callback functions
		const unsubscribeFn = docRef.onSnapshot(
			(doc: any) => {
				console.log(`Received document snapshot for: ${doc ? doc.id : 'unknown'}`);

				try {
					// Safely access document properties
					const docData = doc && doc.data ? doc.data() : {};
					const exists = doc ? !!doc.exists : false;
					const docPath = doc && doc.ref ? doc.ref.path : `${collectionPath}/${documentId}`;

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
						id: doc ? doc.id : documentId,
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
			}
		);
		console.log('Document listener setup complete');
		return unsubscribeFn;
	} catch (setupError) {
		console.error('Error setting up document listener:', setupError);
		throw setupError;
	}
}

/**
 * Set up a dynamic collection listener for paths with parameters
 */
async function setupDynamicCollectionListener(
	this: ITriggerFunctions,
	db: any,
	collectionPathPattern: string,
	events: string[],
	snapshotOptions: any,
	options: IDataObject
): Promise<() => void> {
	// Validate pattern path
	if (!collectionPathPattern || collectionPathPattern.trim() === '') {
		throw new NodeOperationError(this.getNode(), 'Cannot set up dynamic listener: Collection path pattern is empty');
	}
	
	// Normalize the pattern path
	collectionPathPattern = collectionPathPattern.trim().replace(/^\/+|\/+$/g, '');
	
	if (collectionPathPattern === '') {
		throw new NodeOperationError(this.getNode(), 'Collection path pattern cannot be empty');
	}
	
	const patternKey = createPatternListenerKey(collectionPathPattern);
	console.log(`Setting up dynamic collection listener for pattern: "${collectionPathPattern}"`);

	// Find the parent path of the first parameter in the path
	const parentPath = findFirstParameterParentPath(collectionPathPattern);
	
	if (!parentPath) {
		throw new NodeOperationError(this.getNode(), `Could not determine parent path for pattern: ${collectionPathPattern}`);
	}
	
	console.log(`Determined parent path: "${parentPath}" for pattern: "${collectionPathPattern}"`);
	
	// Validate parent path is not empty
	if (!parentPath.trim()) {
		throw new NodeOperationError(this.getNode(), 'Resolved parent path is empty');
	}

	console.log(`Found parent path: ${parentPath}`);

	// Get the segments of the pattern that follow the parent path
	const fullPattern = collectionPathPattern.split('/');
	const parentSegments = parentPath.split('/');
	const patternTail = fullPattern.slice(parentSegments.length);

	console.log(`Pattern tail: ${patternTail.join('/')}`);
	
	// Determine if the pattern tail's first segment is a parameter
	let paramName = '';
	const firstTailSegment = patternTail[0];
	if (patternTail.length > 0 && isPathParameter(firstTailSegment)) {
		paramName = extractParameterName(firstTailSegment);
		console.log(`First parameter name: ${paramName}`);
	} else if (patternTail.length > 0) {
		console.log(`First segment is not a parameter: ${firstTailSegment}`);
	} else {
		console.log(`No pattern tail segments found`);
	}
	const createSubcollectionListener = (
		docPath: string,
		paramValues: Record<string, string>
	): (() => void) => {
		// Validate input document path
		if (!docPath || docPath.trim() === '') {
			throw new NodeOperationError(this.getNode(), 'Cannot create subcollection listener with empty document path');
		}
		
		// Build the full subcollection path based on the pattern
		let fullSubcollectionPath = docPath;

		// Add remaining segments from the pattern, replacing parameters with values
		for (let i = 0; i < patternTail.length; i++) {
			const segment = patternTail[i];
			if (isPathParameter(segment)) {
				const paramName = extractParameterName(segment);
				// If we don't have a value for this parameter, we can't create a listener
				if (!paramValues[paramName]) {
					console.log(`Missing parameter value for ${paramName}, using 'placeholder'`);
					fullSubcollectionPath += '/placeholder';
				} else {
					fullSubcollectionPath += `/${paramValues[paramName]}`;
				}
			} else {
				fullSubcollectionPath += `/${segment}`;
			}
		}

		// Validate the constructed path
		if (!fullSubcollectionPath || fullSubcollectionPath.trim() === '') {
			throw new NodeOperationError(this.getNode(), 'Constructed subcollection path is empty');
		}
		
		// Verify each segment after parameter substitution
		const pathSegments = fullSubcollectionPath.split('/');
		for (const segment of pathSegments) {
			if (segment.trim() === '') {
				throw new NodeOperationError(
					this.getNode(), 
					`Invalid constructed subcollection path: "${fullSubcollectionPath}" contains empty segments`
				);
			}
		}

		console.log(`Creating subcollection listener for: "${fullSubcollectionPath}"`);
		
		try {
			// Create a collection listener for this path
			return setupCollectionListener.call(
				this,
				db,
				fullSubcollectionPath,
				events,
				snapshotOptions,
				options
			);
		} catch (error) {
			console.error(`Error creating subcollection listener for path "${fullSubcollectionPath}":`, error);
			throw new NodeOperationError(
				this.getNode(), 
				`Failed to create subcollection listener: ${(error as Error).message}`
			);
		}
	};

	// Set up a parent collection listener to watch for document changes
	let parentCollectionPath: string;
	let parentDocumentId: string;
	
	// Handle top-level collections like "users" specially
	if (!parentPath.includes('/')) {
		// For a path like "users/:userId/orders", the parentPath might just be "users"
		// In this case, we need special handling for the top-level collection
		parentCollectionPath = '__root__'; // Special marker for root-level access
		parentDocumentId = parentPath; // The entire parentPath is the collection name
		console.log(`Parent path "${parentPath}" is a top-level collection - special handling enabled`);
		console.log(`Using special marker '__root__' for parentCollectionPath, parentDocumentId: "${parentDocumentId}"`);
	} else {
		// Normal case - not a top-level collection
		const segments = parentPath.split('/');
		parentCollectionPath = segments.slice(0, -1).join('/');
		parentDocumentId = segments[segments.length - 1];
		console.log(`Regular path with segments: parentCollectionPath: "${parentCollectionPath}", parentDocumentId: "${parentDocumentId}"`);
	}

	// This check should no longer be needed since we set __root__ directly above
	// but keeping it as a safety net
	if (!parentCollectionPath || parentCollectionPath.trim() === '') {
		parentCollectionPath = '__root__'; // Special marker to handle top-level collections
		console.log(`Empty parent collection path detected, using __root__ marker`);
	}
	
	// Process for non-parameter parent document
	if (!isPathParameter(parentDocumentId)) {
		await processStaticParentDocument.call(
			this, 
			db, 
			patternKey, 
			parentPath, 
			parentCollectionPath, 
			parentDocumentId, 
			paramName, 
			createSubcollectionListener
		);
	} 
	// Process for parameter parent document
	else {
		await processParameterizedParentDocument.call(
			this,
			db,
			patternKey,
			parentPath,
			parentCollectionPath,
			parentDocumentId,
			createSubcollectionListener
		);
	}

	// Return a cleanup function
	return () => cleanupPatternListeners.call(this, patternKey, parentDocumentId, parentPath, parentCollectionPath);
}

/**
 * Process a static parent document for dynamic collection listeners
 */
async function processStaticParentDocument(
	this: ITriggerFunctions,
	db: any,
	patternKey: string,
	parentPath: string,
	parentCollectionPath: string,
	parentDocumentId: string,
	paramName: string,
	createSubcollectionListener: (docPath: string, paramValues: Record<string, string>) => (() => void)
): Promise<void> {
	console.log(`Processing static parent document: ${parentDocumentId}`);
	
	// Handle top-level collections
	let parentDocRef;
	try {
		if (parentCollectionPath === '__root__') {
			console.log(`Getting top-level collection: ${parentDocumentId}`);
			
			// For a top-level collection, we don't need to query for existence - we know it exists
			console.log(`Top-level collection exists by default: ${parentDocumentId}`);
			
			// For patterns like "users/:user_id/orders", handle as a special case
			// The :user_id parameter is in patternTail, and we need to set up listeners
			// for all documents in the "users" collection
			
			// Create a collection snapshot to get all documents
			const snapshot = await db.collection(parentDocumentId).get();
			console.log(`Found ${snapshot.size} documents in top-level collection: ${parentDocumentId}`);
			
			// For each document, create a subcollection listener
			snapshot.forEach((doc: any) => {
				const docPath = doc.ref.path;
				console.log(`Setting up listener for document in top-level collection: ${docPath}`);
				
				// Create parameter values map for the parameter in the path
				const paramValues: Record<string, string> = {};
				if (paramName) {
					paramValues[paramName] = doc.id;
				}
				
				// Create subcollection listener with the document path and parameter values
				const subPath = `${parentDocumentId}/${doc.id}`;
				const subcollectionListener = createSubcollectionListener(subPath, paramValues);
				
				// Register this listener
				registerPatternListener(
					patternKey,
					subPath,
					subcollectionListener,
					createDocumentListenerKey(subPath)
				);
			});
			
			// Listen for changes to the top-level collection
			const collectionListener = db.collection(parentDocumentId).onSnapshot(
				(snapshot: any) => {
					console.log(`Top-level collection changed: ${parentDocumentId}`);
					
					// Process each change
					snapshot.docChanges().forEach((change: any) => {
						const doc = change.doc;
						const docPath = doc.ref.path;
						
						console.log(`Document ${change.type} in top-level collection: ${docPath}`);
						
						// If a document was added, create a new subcollection listener
						if (change.type === 'added') {
							// Create parameter values map
							const paramValues: Record<string, string> = {};
							if (paramName) {
								paramValues[paramName] = doc.id;
							}
							
							// Create subcollection listener
							const subPath = `${parentDocumentId}/${doc.id}`;
							const subcollectionListener = createSubcollectionListener(subPath, paramValues);
							
							// Register this listener
							registerPatternListener(
								patternKey,
								subPath,
								subcollectionListener,
								createDocumentListenerKey(subPath)
							);
						}
						// If a document was removed, remove the subcollection listener
						else if (change.type === 'removed') {
							const subPath = `${parentDocumentId}/${doc.id}`;
							unregisterPatternListener(patternKey, subPath);
						}
					});
				},
				(error: Error) => {
					console.error(`Top-level collection listener error: ${parentDocumentId}`, error);
				}
			);
			
			// Register the collection listener
			registerListener(createDocumentListenerKey(parentDocumentId), collectionListener);
			
			// We've handled the top-level collection specially, so return
			return;
		} else {
			// Normal case - not a top-level collection
			parentDocRef = db.collection(parentCollectionPath).doc(parentDocumentId);
		}
	} catch (error) {
		console.error(`Error handling parent document reference: ${error.message}`);
		throw new NodeOperationError(
			this.getNode(),
			`Error setting up listener for parent document: ${error.message}`
		);
	}

	try {
		// Check if the document exists
		const doc = await parentDocRef.get();
		if (doc.exists) {
			console.log(`Parent document exists: ${parentPath}`);

			// Create parameter values map
			const paramValues: Record<string, string> = {};
			if (paramName) {
				paramValues[paramName] = doc.id;
			}

			// Create and register a subcollection listener
			const subcollectionListener = createSubcollectionListener(parentPath, paramValues);
			registerPatternListener(
				patternKey,
				parentPath,
				subcollectionListener,
				createDocumentListenerKey(parentPath)
			);
		} else {
			console.log(`Parent document does not exist: ${parentPath}`);
		}

		// Set up a listener for the parent document
		const parentListener = parentDocRef.onSnapshot(
			(doc: any) => {
				console.log(`Parent document change: ${parentPath}`);

				if (!doc.exists) {
					// Document was deleted, remove subcollection listener
					console.log(`Parent document deleted: ${parentPath}`);
					unregisterPatternListener(patternKey, parentPath);
				} else if (!patternListeners[patternKey] || !patternListeners[patternKey][parentPath]) {
					// Document exists but no listener, create one
					console.log(`Parent document exists but no listener: ${parentPath}`);

					const paramValues: Record<string, string> = {};
					if (paramName) {
						paramValues[paramName] = doc.id;
					}

					const subcollectionListener = createSubcollectionListener(parentPath, paramValues);
					registerPatternListener(
						patternKey,
						parentPath,
						subcollectionListener,
						createDocumentListenerKey(parentPath)
					);
				}
			},
			(error: Error) => {
				console.error(`Parent document listener error: ${parentPath}`, error);
			}
		);

		// Register the parent listener
		registerListener(createDocumentListenerKey(parentPath), parentListener);
		
	} catch (error) {
		console.error(`Error processing static parent document: ${parentPath}`, error);
		throw new NodeOperationError(
			this.getNode(),
			`Error setting up listener for static parent document: ${(error as Error).message}`
		);
	}
}

/**
 * Process a parameterized parent document for dynamic collection listeners
 */
async function processParameterizedParentDocument(
	this: ITriggerFunctions,
	db: any,
	patternKey: string,
	parentPath: string,
	parentCollectionPath: string,
	parentDocumentId: string,
	createSubcollectionListener: (docPath: string, paramValues: Record<string, string>) => (() => void)
): Promise<void> {
	console.log(`Processing parameterized parent document: ${parentDocumentId}`);
	
	// Handle top-level collections
	let parentCollection;
	if (parentCollectionPath === '__root__') {
		console.log(`Using special handling for top-level collection`);
		// For a pattern like "users/:user_id/orders", parentPath would be "users"
		// We need to set up a collection listener for the "users" collection
		parentCollection = db.collection(parentPath);
	} else {
		// Normal case - not a top-level collection
		parentCollection = db.collection(parentCollectionPath);
	}

	try {
		// Query for existing documents in the parent collection
		const snapshot = await parentCollection.get();
		console.log(`Found ${snapshot.size} documents in parent collection: ${parentCollectionPath}`);

		// Create listeners for existing documents
		snapshot.forEach((doc: any) => {
			const docPath = doc.ref.path;
			console.log(`Setting up listener for existing document: ${docPath}`);

			// Create parameter values map
			const paramValues: Record<string, string> = {};
			paramValues[extractParameterName(parentDocumentId)] = doc.id;

			// Create and register a subcollection listener
			const subcollectionListener = createSubcollectionListener(docPath, paramValues);
			registerPatternListener(
				patternKey,
				docPath,
				subcollectionListener,
				createDocumentListenerKey(docPath)
			);
		});

		// Listen for changes to the parent collection
		const parentCollectionListener = parentCollection.onSnapshot(
			(snapshot: any) => {
				console.log(`Parent collection changed: ${parentCollectionPath}`);

				snapshot.docChanges().forEach((change: any) => {
					const doc = change.doc;
					const docPath = doc.ref.path;

					console.log(`Document ${change.type}: ${docPath}`);

					// If a document was added, create a new subcollection listener
					if (change.type === 'added') {
						// Create parameter values map
						const paramValues: Record<string, string> = {};
						paramValues[extractParameterName(parentDocumentId)] = doc.id;

						// Create and register a subcollection listener
						const subcollectionListener = createSubcollectionListener(docPath, paramValues);
						registerPatternListener(
							patternKey,
							docPath,
							subcollectionListener,
							createDocumentListenerKey(docPath)
						);
					}
					// If a document was removed, remove the subcollection listener
					else if (change.type === 'removed') {
						unregisterPatternListener(patternKey, docPath);
					}
				});
			},
			(error: Error) => {
				console.error(`Parent collection listener error: ${parentCollectionPath}`, error);
			}
		);

		// Register the parent collection listener
		registerListener(createDocumentListenerKey(parentCollectionPath), parentCollectionListener);
		
	} catch (error) {
		console.error(`Error processing parameterized parent document: ${parentDocumentId}`, error);
		throw new NodeOperationError(
			this.getNode(),
			`Error setting up listener for parameterized parent document: ${(error as Error).message}`
		);
	}
}

/**
 * Clean up pattern listeners
 */
function cleanupPatternListeners(
	this: ITriggerFunctions,
	patternKey: string,
	parentDocumentId: string,
	parentPath: string,
	parentCollectionPath: string
): void {
	console.log(`Cleaning up pattern listeners for: ${patternKey}`);

	// Clean up pattern listeners
	if (patternListeners[patternKey]) {
		for (const docPath in patternListeners[patternKey]) {
			if (Object.prototype.hasOwnProperty.call(patternListeners[patternKey], docPath)) {
				unregisterPatternListener(patternKey, docPath);
			}
		}
	}

	// Handle special case for top-level collections
	if (parentCollectionPath === '__root__') {
		// For top-level collections, use parentDocumentId as the collection name
		// since it contains the actual collection name (e.g., "users")
		const topLevelCollectionKey = createDocumentListenerKey(parentDocumentId);
		console.log(`Cleaning up top-level collection listener: ${topLevelCollectionKey}`);
		
		if (activeListeners[topLevelCollectionKey]) {
			console.log(`Found active listener for top-level collection, unsubscribing: ${topLevelCollectionKey}`);
			activeListeners[topLevelCollectionKey]();
			delete activeListeners[topLevelCollectionKey];
		} else {
			console.log(`No active listener found for top-level collection: ${topLevelCollectionKey}`);
		}
		
		// Also need to clean up individual document listeners for this collection
		const docKeysToCleanup = Object.keys(activeListeners).filter(key => 
			key.startsWith(`doc:${parentDocumentId}/`));
		
		console.log(`Found ${docKeysToCleanup.length} document listeners to clean up for top-level collection`);
		
		docKeysToCleanup.forEach(key => {
			console.log(`Cleaning up document listener: ${key}`);
			activeListeners[key]();
			delete activeListeners[key];
		});
		
		return;
	}

	// Clean up parent listener
	if (isPathParameter(parentDocumentId)) {
		const parentCollectionKey = createDocumentListenerKey(parentCollectionPath);
		if (activeListeners[parentCollectionKey]) {
			activeListeners[parentCollectionKey]();
			delete activeListeners[parentCollectionKey];
		}
	} else {
		const parentDocKey = createDocumentListenerKey(parentPath);
		if (activeListeners[parentDocKey]) {
			activeListeners[parentDocKey]();
			delete activeListeners[parentDocKey];
		}
	}
}
