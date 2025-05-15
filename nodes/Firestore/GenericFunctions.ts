import { CollectionReference, DocumentReference, Firestore, DocumentData } from 'firebase-admin/firestore';
import { NodeOperationError } from 'n8n-workflow';
import { pathHandler } from '../../src/PathHandler';
import { logger } from '../../src/Logger';

/**
 * Creates a Firestore reference for a collection or document path
 * Works with both static paths and those containing parameters
 */
export function createFirestoreReference(db: Firestore, path: string): CollectionReference | DocumentReference {
	// Validate the db reference
	if (!db) {
		throw new NodeOperationError(null, 'Invalid Firestore database reference');
	}
	
	// Use PathHandler to validate and normalize the path
	const normalizedPath = pathHandler.normalizePath(path);
	const analysis = pathHandler.parsePath(normalizedPath);
	const segments = analysis.segments.map(segment => segment.value);
	
	logger.debug(`Creating Firestore reference for path: "${normalizedPath}" with ${segments.length} segments`);
	
	try {
		// Using a more specific type for the reference
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let ref: any = db;
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			logger.debug(`Processing segment[${i}]: "${segment}"`);
			
			if (i % 2 === 0) {
				// Even indices (0, 2, 4...) are collection names
				logger.debug(`Creating collection reference for: "${segment}"`);
				ref = ref.collection(segment);
			} else {
				// Odd indices (1, 3, 5...) are document IDs
				logger.debug(`Creating document reference for: "${segment}"`);
				ref = ref.doc(segment);
			}
		}
		
		logger.debug(`Successfully created Firestore reference for path: "${normalizedPath}"`);
		return ref as CollectionReference<DocumentData> | DocumentReference<DocumentData>;
	} catch (error) {
		logger.error(`Error creating Firestore reference for path "${normalizedPath}":`, error);
		throw new NodeOperationError(null, `Failed to create Firestore reference: ${(error as Error).message}`);
	}
}

/**
 * Creates a collection reference from a path
 */
export function getCollectionRef(db: Firestore, path: string): CollectionReference {
	// Validate parameters
	if (!db) {
		throw new NodeOperationError(null, 'Invalid Firestore database reference');
	}
	
	// Use PathHandler to validate and normalize the path
	const normalizedPath = pathHandler.normalizePath(path);
	
	// Validate path format
	if (!pathHandler.isCollection(normalizedPath)) {
		throw new NodeOperationError(null, `Invalid collection path: "${normalizedPath}". Collection paths must have an odd number of segments.`);
	}
	
	try {
		logger.debug(`Getting collection reference for path: "${normalizedPath}"`);
		return createFirestoreReference(db, normalizedPath) as CollectionReference;
	} catch (error) {
		logger.error(`Error getting collection reference for path "${normalizedPath}":`, error);
		throw new NodeOperationError(null, `Failed to get collection reference: ${(error as Error).message}`);
	}
}

/**
 * Creates a document reference from a collection path and document ID
 */
export function getDocumentRef(db: Firestore, collectionPath: string, documentId: string): DocumentReference {
	// Validate parameters
	if (!db) {
		throw new NodeOperationError(null, 'Invalid Firestore database reference');
	}
	
	// Use PathHandler to validate and normalize inputs
	const normalizedPath = pathHandler.normalizePath(collectionPath);
	const normalizedDocId = documentId.trim();
	
	if (normalizedDocId === '') {
		throw new NodeOperationError(null, 'Document ID cannot be empty');
	}
	
	// Validate path format
	if (!pathHandler.isCollection(normalizedPath)) {
		throw new NodeOperationError(null, `Invalid collection path: "${normalizedPath}". Collection paths must have an odd number of segments.`);
	}
	
	try {
		logger.debug(`Getting document reference for path: "${normalizedPath}/${normalizedDocId}"`);
		const collectionRef = getCollectionRef(db, normalizedPath);
		return collectionRef.doc(normalizedDocId);
	} catch (error) {
		logger.error(`Error getting document reference for path "${normalizedPath}/${normalizedDocId}":`, error);
		throw new NodeOperationError(null, `Failed to get document reference: ${(error as Error).message}`);
	}
}