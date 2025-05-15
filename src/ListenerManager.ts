import { Firestore } from 'firebase-admin/firestore';
import { IDataObject } from 'n8n-workflow';
import { pathHandler } from './PathHandler';
import { logger } from './Logger';

// Type for pattern listeners
export type PatternListener = {
	parentDocPath: string;
	listener: () => void;
	parentListenerKey: string;
};

// Options for collection listeners
export interface CollectionOptions {
	events?: string[];
	includeMetadataChanges?: boolean;
	queryFilters?: IDataObject;
	emitFn?: (data: object[]) => void;
}

// Options for document listeners
export interface DocumentOptions {
	includeMetadataChanges?: boolean;
	emitFn?: (data: object[]) => void;
}

// Options for dynamic path listeners
// Just use CollectionOptions directly, no need for separate interface
export type DynamicOptions = CollectionOptions;

/**
 * ListenerManager handles the registration, management, and cleanup
 * of Firestore document and collection listeners.
 */
export class ListenerManager {
	// Cache for active listeners to avoid duplicates and manage cleanup
	private activeListeners: Record<string, () => void> = {};

	// Cache for path pattern listeners to track listeners created for dynamic paths
	private patternListeners: Record<string, Record<string, PatternListener>> = {};

	constructor() {}

	/**
	 * Creates a path pattern listener key
	 */
	public createPatternListenerKey(pathPattern: string): string {
		return `pattern:${pathPattern}`;
	}

	/**
	 * Creates a document listener key
	 */
	public createDocumentListenerKey(path: string): string {
		return `doc:${path}`;
	}

	/**
	 * Add or update a listener in the active listeners cache
	 */
	public registerListener(listenerKey: string, unsubscribeFn: () => void): void {
		// If there's an existing listener with this key, unsubscribe it first
		if (this.activeListeners[listenerKey]) {
			logger.debug(`Replacing existing listener for key: ${listenerKey}`);
			this.activeListeners[listenerKey]();
		}

		this.activeListeners[listenerKey] = unsubscribeFn;
		logger.debug(`Registered listener with key: ${listenerKey}`);
	}

	/**
	 * Remove a listener from the active listeners cache
	 */
	public unregisterListener(listenerKey: string): void {
		if (this.activeListeners[listenerKey]) {
			logger.debug(`Unsubscribing listener with key: ${listenerKey}`);
			this.activeListeners[listenerKey]();
			delete this.activeListeners[listenerKey];
		}
	}

	/**
	 * Register a pattern listener for a specific path pattern
	 */
	public registerPatternListener(
		patternKey: string, 
		docPath: string, 
		listener: () => void, 
		parentListenerKey: string
	): void {
		// Initialize the pattern listeners object if it doesn't exist
		if (!this.patternListeners[patternKey]) {
			this.patternListeners[patternKey] = {};
		}

		// If there's already a listener for this document path, clean it up first
		if (this.patternListeners[patternKey][docPath]) {
			this.patternListeners[patternKey][docPath].listener();
		}

		// Store the new listener
		this.patternListeners[patternKey][docPath] = {
			parentDocPath: docPath,
			listener,
			parentListenerKey,
		};

		logger.debug(`Registered pattern listener for pattern: ${patternKey}, doc: ${docPath}`);
	}

	/**
	 * Unregister a specific pattern listener
	 */
	public unregisterPatternListener(patternKey: string, docPath: string): void {
		if (this.patternListeners[patternKey] && this.patternListeners[patternKey][docPath]) {
			logger.debug(`Unregistering pattern listener for pattern: ${patternKey}, doc: ${docPath}`);
			this.patternListeners[patternKey][docPath].listener();
			delete this.patternListeners[patternKey][docPath];
		}
	}

	/**
	 * Clean up all pattern listeners for a specific pattern
	 */
	public cleanupPattern(patternKey: string): void {
		if (this.patternListeners[patternKey]) {
			logger.debug(`Cleaning up pattern listeners for: ${patternKey}`);
			
			for (const docPath in this.patternListeners[patternKey]) {
				if (Object.prototype.hasOwnProperty.call(this.patternListeners[patternKey], docPath)) {
					this.patternListeners[patternKey][docPath].listener();
				}
			}
			
			delete this.patternListeners[patternKey];
		}
	}

	/**
	 * Clean up all active listeners
	 */
	public cleanupAll(): void {
		logger.debug(`Cleaning up all active listeners: ${Object.keys(this.activeListeners).length} listeners`);
		
		// Clean up regular listeners
		for (const key in this.activeListeners) {
			if (Object.prototype.hasOwnProperty.call(this.activeListeners, key)) {
				logger.debug(`Unsubscribing listener: ${key}`);
				this.activeListeners[key]();
				delete this.activeListeners[key];
			}
		}
		
		// Clean up pattern listeners
		for (const patternKey in this.patternListeners) {
			if (Object.prototype.hasOwnProperty.call(this.patternListeners, patternKey)) {
				this.cleanupPattern(patternKey);
			}
		}
	}

	/**
	 * Returns all active listeners
	 */
	public getActiveListeners(): Record<string, () => void> {
		return this.activeListeners;
	}

	/**
	 * Returns all pattern listeners
	 */
	public getPatternListeners(): Record<string, Record<string, PatternListener>> {
		return this.patternListeners;
	}

	/**
	 * Creates a collection listener for a given path
	 */
	public createCollectionListener(
		db: Firestore,
		collectionPath: string,
		options: CollectionOptions
	): () => void {
		// Validate collection path
		if (!collectionPath || collectionPath.trim() === '') {
			throw new Error('Cannot set up listener: Collection path is empty');
		}

		const events = options.events || ['added', 'modified', 'removed'];
		
		// Set up snapshot options
		const snapshotOptions: { includeMetadataChanges?: boolean } = {};
		if (options.includeMetadataChanges) {
			snapshotOptions.includeMetadataChanges = true;
		}

		// Create collection reference and apply filters
		// Using any for Firestore query due to complex typing
		let query: any = db.collection(collectionPath);
		
		// Add query filters if provided
		if (options.queryFilters && (options.queryFilters as IDataObject).filters) {
			const filters = (options.queryFilters as IDataObject).filters as IDataObject[];
			
			for (const filter of filters) {
				if (filter.field && filter.operator && filter.value !== undefined) {
					query = query.where(
						filter.field as string,
						filter.operator as string,
						filter.value
					);
				}
			}
		}

		// Set up collection listener
		const unsubscribeFn = query.onSnapshot(
			// Using any for Firestore snapshot
			(snapshot: any) => {
				if (!snapshot.docChanges) {
					logger.warn('Snapshot does not have docChanges method');
					return;
				}

				snapshot.docChanges().forEach((change: any) => {
					// Skip if the event type is not in the selected events
					if (events && !events.includes(change.type)) {
						return;
					}

					try {
						if (!change.doc) {
							logger.warn('Change does not have doc property');
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

						// Execute the workflow with the document data if emit function provided
						if (options.emitFn) {
							options.emitFn([{ json: docInfo }]);
						}
					} catch (docError) {
						logger.error('Error processing document change:', docError);
					}
				});
			},
			(error: Error) => {
				logger.error('Firestore listener error:', error);
			}
		);

		return unsubscribeFn;
	}

	/**
	 * Creates a document listener for a given path and document ID
	 */
	public createDocumentListener(
		db: Firestore,
		collectionPath: string,
		documentId: string,
		options: DocumentOptions
	): () => void {
		// Validate inputs
		if (!collectionPath || collectionPath.trim() === '') {
			throw new Error('Cannot set up listener: Collection path is empty');
		}

		if (!documentId || documentId.trim() === '') {
			throw new Error('Cannot set up listener: Document ID is empty');
		}

		// Set up snapshot options
		const snapshotOptions: { includeMetadataChanges?: boolean } = {};
		if (options.includeMetadataChanges) {
			snapshotOptions.includeMetadataChanges = true;
		}

		try {
			const docRef = db.collection(collectionPath).doc(documentId);

			// Set up document listener
			const unsubscribeFn = docRef.onSnapshot(
				// Using any for Firestore document
				(doc: any) => {
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

						// Execute the workflow with the document data if emit function provided
						if (options.emitFn) {
							options.emitFn([{ json: docInfo }]);
						}
					} catch (docError) {
						logger.error('Error processing document snapshot:', docError);
					}
				},
				(error: Error) => {
					logger.error('Firestore document listener error:', error);
				}
			);
			
			return unsubscribeFn;
		} catch (setupError) {
			logger.error('Error setting up document listener:', setupError);
			throw setupError;
		}
	}

	/**
	 * Creates a dynamic collection listener for paths with parameters
	 */
	public async createDynamicListener(
		db: Firestore,
		collectionPathPattern: string,
		options: DynamicOptions
	): Promise<() => void> {
		// Validate pattern path
		if (!collectionPathPattern || collectionPathPattern.trim() === '') {
			throw new Error('Cannot set up dynamic listener: Collection path pattern is empty');
		}

		// Normalize the pattern path using PathHandler
		try {
			collectionPathPattern = pathHandler.normalizePath(collectionPathPattern);
			
			if (collectionPathPattern === '') {
				throw new Error('Collection path pattern cannot be empty after normalization');
			}
		} catch (error) {
			throw new Error(`Invalid collection path pattern: ${(error as Error).message}`);
		}

		const patternKey = this.createPatternListenerKey(collectionPathPattern);

		// Find the parent path of the first parameter in the path
		const parentPath = pathHandler.findFirstParameterParentPath(collectionPathPattern);

		if (!parentPath) {
			throw new Error(`Could not determine parent path for pattern: ${collectionPathPattern}`);
		}

		// Validate parent path is not empty
		if (!parentPath.trim()) {
			throw new Error('Resolved parent path is empty');
		}

		// Get the segments of the pattern that follow the parent path
		const fullPattern = collectionPathPattern.split('/');
		const parentSegments = parentPath.split('/');
		const patternTail = fullPattern.slice(parentSegments.length);

		// Determine if the pattern tail's first segment is a parameter
		let paramName = '';
		const firstTailSegment = patternTail[0];
		if (patternTail.length > 0 && pathHandler.isPathParameter(firstTailSegment)) {
			paramName = pathHandler.extractParameterName(firstTailSegment);
		}
		
		// Create subcollection listener function
		const createSubcollectionListener = (
			docPath: string,
			paramValues: Record<string, string>
		): (() => void) => {
			// Validate input document path
			if (!docPath || docPath.trim() === '') {
				throw new Error('Cannot create subcollection listener with empty document path');
			}

			// Get the segments we need to add to the path from patternTail
			const pathSegmentsToAdd: string[] = [];
			
			// We start from index 1 because at index 0 we typically have the parameter that's already
			// been replaced with the document ID in docPath
			for (let i = 1; i < patternTail.length; i++) {
				const segment = patternTail[i];
				if (pathHandler.isPathParameter(segment)) {
					const paramName = pathHandler.extractParameterName(segment);
					// If we don't have a value for this parameter, use a placeholder
					if (!paramValues[paramName]) {
						pathSegmentsToAdd.push('placeholder');
					} else {
						pathSegmentsToAdd.push(paramValues[paramName]);
					}
				} else {
					pathSegmentsToAdd.push(segment);
				}
			}
			
			// Build the full path by adding the remaining segments to the document path
			let fullSubcollectionPath = docPath;
			if (pathSegmentsToAdd.length > 0) {
				fullSubcollectionPath = `${docPath}/${pathSegmentsToAdd.join('/')}`;
			}

			// Validate the constructed path
			if (!fullSubcollectionPath || fullSubcollectionPath.trim() === '') {
				throw new Error('Constructed subcollection path is empty');
			}

			// Verify each segment after parameter substitution
			const pathSegments = fullSubcollectionPath.split('/');
			for (const segment of pathSegments) {
				if (segment.trim() === '') {
					throw new Error(`Invalid constructed subcollection path: "${fullSubcollectionPath}" contains empty segments`);
				}
			}

			try {
				// Create a collection listener for this path
				return this.createCollectionListener(
					db,
					fullSubcollectionPath,
					options
				);
			} catch (error) {
				logger.error(`Error creating subcollection listener for path "${fullSubcollectionPath}":`, error);
				throw new Error(`Failed to create subcollection listener: ${(error as Error).message}`);
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
		} else {
			// Normal case - not a top-level collection
			const segments = parentPath.split('/');
			parentCollectionPath = segments.slice(0, -1).join('/');
			parentDocumentId = segments[segments.length - 1];
		}

		// This check should no longer be needed since we set __root__ directly above
		// but keeping it as a safety net
		if (!parentCollectionPath || parentCollectionPath.trim() === '') {
			parentCollectionPath = '__root__'; // Special marker to handle top-level collections
		}

		// Process for non-parameter parent document
		if (!pathHandler.isPathParameter(parentDocumentId)) {
			await this.processStaticParentDocument(
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
			await this.processParameterizedParentDocument(
				db,
				patternKey,
				parentPath,
				parentCollectionPath,
				parentDocumentId,
				createSubcollectionListener
			);
		}

		// Return a cleanup function
		return () => this.cleanupDynamicListener(patternKey, parentDocumentId, parentPath, parentCollectionPath);
	}

	/**
	 * Process a static parent document for dynamic collection listeners
	 */
	private async processStaticParentDocument(
		// Using any for Firestore db instance
		db: any,
		patternKey: string,
		parentPath: string,
		parentCollectionPath: string,
		parentDocumentId: string,
		paramName: string,
		createSubcollectionListener: (docPath: string, paramValues: Record<string, string>) => (() => void)
	): Promise<void> {
		// Handle top-level collections
		let parentDocRef;
		try {
			if (parentCollectionPath === '__root__') {
				// For a top-level collection, we don't need to query for existence - we know it exists
				// For patterns like "users/:user_id/orders", handle as a special case
				// The :user_id parameter is in patternTail, and we need to set up listeners
				// for all documents in the "users" collection

				// Create a collection snapshot to get all documents
				const snapshot = await db.collection(parentDocumentId).get();

				// For each document, create a subcollection listener
				snapshot.forEach((doc: any) => {
					// Get the full path directly from the document reference
					const docPath = doc.ref.path;

					// Create parameter values map for the parameter in the path
					const paramValues: Record<string, string> = {};
					if (paramName) {
						paramValues[paramName] = doc.id;
					}

					// IMPORTANT: Use the document path directly from Firebase, not something we construct
					// This ensures we have the correct path without duplication issues
					const subcollectionListener = createSubcollectionListener(docPath, paramValues);

					// Register this listener
					this.registerPatternListener(
						patternKey,
						docPath,
						subcollectionListener,
						this.createDocumentListenerKey(docPath)
					);
				});

				// Listen for changes to the top-level collection
				const collectionListener = db.collection(parentDocumentId).onSnapshot(
					(snapshot: any) => {
						// Process each change
						snapshot.docChanges().forEach((change: any) => {
							const doc = change.doc;
							// Get the full path directly from the document reference
							const docPath = doc.ref.path;

							// If a document was added, create a new subcollection listener
							if (change.type === 'added') {
								// Create parameter values map
								const paramValues: Record<string, string> = {};
								if (paramName) {
									paramValues[paramName] = doc.id;
								}

								// Create subcollection listener - use the Firebase-provided path directly
								const subcollectionListener = createSubcollectionListener(docPath, paramValues);

								// Register this listener
								this.registerPatternListener(
									patternKey,
									docPath,
									subcollectionListener,
									this.createDocumentListenerKey(docPath)
								);
							}
							// If a document was removed, remove the subcollection listener
							else if (change.type === 'removed') {
								this.unregisterPatternListener(patternKey, docPath);
							}
						});
					},
					(error: Error) => {
						logger.error(`Top-level collection listener error: ${parentDocumentId}`, error);
					}
				);

				// Register the collection listener
				this.registerListener(this.createDocumentListenerKey(parentDocumentId), collectionListener);

				// We've handled the top-level collection specially, so return
				return;
			} else {
				// Normal case - not a top-level collection
				parentDocRef = db.collection(parentCollectionPath).doc(parentDocumentId);
			}
		} catch (error) {
			logger.error(`Error handling parent document reference: ${(error as Error).message}`);
			throw new Error(`Error setting up listener for parent document: ${(error as Error).message}`);
		}

		try {
			// Check if the document exists
			const doc = await parentDocRef.get();
			if (doc.exists) {
				// Create parameter values map
				const paramValues: Record<string, string> = {};
				if (paramName) {
					paramValues[paramName] = doc.id;
				}

				// Create and register a subcollection listener
				const subcollectionListener = createSubcollectionListener(parentPath, paramValues);
				this.registerPatternListener(
					patternKey,
					parentPath,
					subcollectionListener,
					this.createDocumentListenerKey(parentPath)
				);
			}

			// Set up a listener for the parent document
			const parentListener = parentDocRef.onSnapshot(
				(doc: any) => {
					if (!doc.exists) {
						// Document was deleted, remove subcollection listener
						this.unregisterPatternListener(patternKey, parentPath);
					} else if (!this.patternListeners[patternKey] || !this.patternListeners[patternKey][parentPath]) {
						// Document exists but no listener, create one
						const paramValues: Record<string, string> = {};
						if (paramName) {
							paramValues[paramName] = doc.id;
						}

						const subcollectionListener = createSubcollectionListener(parentPath, paramValues);
						this.registerPatternListener(
							patternKey,
							parentPath,
							subcollectionListener,
							this.createDocumentListenerKey(parentPath)
						);
					}
				},
				(error: Error) => {
					logger.error(`Parent document listener error: ${parentPath}`, error);
				}
			);

			// Register the parent listener
			this.registerListener(this.createDocumentListenerKey(parentPath), parentListener);

		} catch (error) {
			logger.error(`Error processing static parent document: ${parentPath}`, error);
			throw new Error(`Error setting up listener for static parent document: ${(error as Error).message}`);
		}
	}

	/**
	 * Process a parameterized parent document for dynamic collection listeners
	 */
	private async processParameterizedParentDocument(
		// Using any for Firestore db instance
		db: any,
		patternKey: string,
		parentPath: string,
		parentCollectionPath: string,
		parentDocumentId: string,
		createSubcollectionListener: (docPath: string, paramValues: Record<string, string>) => (() => void)
	): Promise<void> {
		// Handle top-level collections
		let parentCollection;
		if (parentCollectionPath === '__root__') {
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

			// Create listeners for existing documents
			snapshot.forEach((doc: any) => {
				const docPath = doc.ref.path;

				// Create parameter values map
				const paramValues: Record<string, string> = {};
				paramValues[pathHandler.extractParameterName(parentDocumentId)] = doc.id;

				// Create and register a subcollection listener
				const subcollectionListener = createSubcollectionListener(docPath, paramValues);
				this.registerPatternListener(
					patternKey,
					docPath,
					subcollectionListener,
					this.createDocumentListenerKey(docPath)
				);
			});

			// Listen for changes to the parent collection
			const parentCollectionListener = parentCollection.onSnapshot(
				(snapshot: any) => {
					snapshot.docChanges().forEach((change: any) => {
						const doc = change.doc;
						const docPath = doc.ref.path;

						// If a document was added, create a new subcollection listener
						if (change.type === 'added') {
							// Create parameter values map
							const paramValues: Record<string, string> = {};
							paramValues[pathHandler.extractParameterName(parentDocumentId)] = doc.id;

							// Create and register a subcollection listener
							const subcollectionListener = createSubcollectionListener(docPath, paramValues);
							this.registerPatternListener(
								patternKey,
								docPath,
								subcollectionListener,
								this.createDocumentListenerKey(docPath)
							);
						}
						// If a document was removed, remove the subcollection listener
						else if (change.type === 'removed') {
							this.unregisterPatternListener(patternKey, docPath);
						}
					});
				},
				(error: Error) => {
					logger.error(`Parent collection listener error: ${parentCollectionPath}`, error);
				}
			);

			// Register the parent collection listener
			this.registerListener(this.createDocumentListenerKey(parentCollectionPath), parentCollectionListener);

		} catch (error) {
			logger.error(`Error processing parameterized parent document: ${parentDocumentId}`, error);
			throw new Error(`Error setting up listener for parameterized parent document: ${(error as Error).message}`);
		}
	}

	/**
	 * Clean up pattern listeners for dynamic listeners
	 */
	private cleanupDynamicListener(
		patternKey: string,
		parentDocumentId: string,
		parentPath: string,
		parentCollectionPath: string
	): void {
		// Clean up pattern listeners
		if (this.patternListeners[patternKey]) {
			for (const docPath in this.patternListeners[patternKey]) {
				if (Object.prototype.hasOwnProperty.call(this.patternListeners[patternKey], docPath)) {
					this.unregisterPatternListener(patternKey, docPath);
				}
			}
		}

		// Handle special case for top-level collections
		if (parentCollectionPath === '__root__') {
			// For top-level collections, use parentDocumentId as the collection name
			// since it contains the actual collection name (e.g., "users")
			const topLevelCollectionKey = this.createDocumentListenerKey(parentDocumentId);

			if (this.activeListeners[topLevelCollectionKey]) {
				this.activeListeners[topLevelCollectionKey]();
				delete this.activeListeners[topLevelCollectionKey];
			}

			// Also need to clean up individual document listeners for this collection
			const docKeysToCleanup = Object.keys(this.activeListeners).filter(key =>
				key.startsWith(`doc:${parentDocumentId}/`));

			docKeysToCleanup.forEach(key => {
				this.activeListeners[key]();
				delete this.activeListeners[key];
			});

			return;
		}

		// Clean up parent listener
		if (pathHandler.isPathParameter(parentDocumentId)) {
			const parentCollectionKey = this.createDocumentListenerKey(parentCollectionPath);
			if (this.activeListeners[parentCollectionKey]) {
				this.activeListeners[parentCollectionKey]();
				delete this.activeListeners[parentCollectionKey];
			}
		} else {
			const parentDocKey = this.createDocumentListenerKey(parentPath);
			if (this.activeListeners[parentDocKey]) {
				this.activeListeners[parentDocKey]();
				delete this.activeListeners[parentDocKey];
			}
		}
	}
}

// Export a singleton instance for convenience
export const listenerManager = new ListenerManager();