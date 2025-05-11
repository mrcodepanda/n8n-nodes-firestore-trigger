import * as admin from 'firebase-admin';
import { cert, getApp, initializeApp } from 'firebase-admin/app';
import { IDataObject } from 'n8n-workflow';

// Cache for Firebase app instances to prevent duplicates
const firebaseApps: Record<string, any> = {};

// Cache for active listeners to avoid duplicates and manage cleanup
const activeListeners: Record<string, () => void> = {};

/**
 * Initializes a Firebase app based on provided credentials
 */
export function initFirebaseApp(credentials: IDataObject): any {
	const projectId = credentials.projectId as string;

	// Check if app already exists
	try {
		console.log(`Checking if Firebase app already exists for project: ${projectId}`);
		return getApp(projectId);
	} catch (error) {
		console.log(`Firebase app doesn't exist yet for project: ${projectId}, initializing new app`);
		// App doesn't exist, initialize it
	}

	let serviceAccountJson: any;
	let appConfig: admin.AppOptions = { projectId };

	// Set up authentication based on method
	if (credentials.authenticationMethod === 'serviceAccount') {
		console.log('Using Service Account authentication method');
		try {
			// Parse the service account JSON if it's a string
			if (typeof credentials.serviceAccountJson === 'string') {
				console.log('Parsing service account JSON from string');
				serviceAccountJson = JSON.parse(credentials.serviceAccountJson as string);
			} else {
				serviceAccountJson = credentials.serviceAccountJson;
			}
			appConfig.credential = cert(serviceAccountJson);
		} catch (error) {
			console.error('Error parsing service account JSON:', error);
			throw new Error(`Invalid service account JSON: ${(error as Error).message}`);
		}
	} else {
		// Use application default credentials
		console.log('Using Application Default Credentials authentication method');
		appConfig.credential = admin.credential.applicationDefault();
	}

	// Initialize the app with the given configuration
	console.log('Initializing Firebase app with config:', {
		projectId: appConfig.projectId,
		databaseURL: appConfig.databaseURL || 'default',
		hasCredential: !!appConfig.credential,
	});

	const app = initializeApp(appConfig, projectId);

	// Store for later reuse
	firebaseApps[projectId] = app;
	console.log(`Firebase app initialized for project: ${projectId}`);

	return app;
}

/**
 * Cleans up a Firebase app instance
 */
export function cleanupFirebaseApp(projectId: string): Promise<void> {
	console.log(`Cleaning up Firebase app for project: ${projectId}`);
	if (firebaseApps[projectId]) {
		console.log(`Found Firebase app for project: ${projectId}, deleting app`);
		return firebaseApps[projectId]
			.delete()
			.then(() => {
				console.log(`Successfully deleted Firebase app for project: ${projectId}`);
				delete firebaseApps[projectId];
			})
			.catch((error: Error) => {
				console.error(`Error deleting Firebase app for project: ${projectId}:`, error);
				// Still remove from cache even if deletion fails
				delete firebaseApps[projectId];
				return Promise.resolve();
			});
	}
	console.log(`No Firebase app found for project: ${projectId}, nothing to clean up`);
	return Promise.resolve();
}

/**
 * Check if a path segment is a parameter (starts with colon)
 */
export function isPathParameter(segment: string): boolean {
	return segment.startsWith(':');
}

/**
 * Extract parameter name from a path segment
 */
export function extractParameterName(segment: string): string {
	if (!isPathParameter(segment)) {
		return '';
	}
	return segment.substring(1); // Remove the leading colon
}

/**
 * Check if a path contains any parameters
 */
export function hasPathParameters(path: string): boolean {
	const segments = path.split('/');
	return segments.some(segment => isPathParameter(segment));
}

/**
 * Validate a collection path format
 * Must have an odd number of segments for a valid collection path
 */
export function validateCollectionPath(path: string): boolean {
	const segments = path.split('/').filter(segment => segment.trim() !== '');
	return segments.length % 2 === 1;
}

/**
 * Creates a Firestore reference for a collection or document path
 * Works with both static paths and those containing parameters
 */
export function createFirestoreReference(db: any, path: string): any {
	const segments = path.split('/').filter(segment => segment.trim() !== '');
	
	// Invalid path
	if (segments.length === 0) {
		throw new Error('Path cannot be empty');
	}
	
	let ref: any = db;
	for (let i = 0; i < segments.length; i++) {
		if (i % 2 === 0) {
			// Even indices (0, 2, 4...) are collection names
			ref = ref.collection(segments[i]);
		} else {
			// Odd indices (1, 3, 5...) are document IDs
			ref = ref.doc(segments[i]);
		}
	}
	
	return ref;
}

/**
 * Creates a collection reference from a path
 */
export function getCollectionRef(db: any, path: string): any {
	if (!validateCollectionPath(path)) {
		throw new Error('Invalid collection path. Collection paths must have an odd number of segments.');
	}
	
	return createFirestoreReference(db, path);
}

/**
 * Creates a document reference from a collection path and document ID
 */
export function getDocumentRef(db: any, collectionPath: string, documentId: string): any {
	if (!validateCollectionPath(collectionPath)) {
		throw new Error('Invalid collection path. Collection paths must have an odd number of segments.');
	}
	
	const collectionRef = getCollectionRef(db, collectionPath);
	return collectionRef.doc(documentId);
}

/**
 * Add or update a listener in the active listeners cache
 */
export function registerListener(listenerKey: string, unsubscribeFn: () => void): void {
	// If there's an existing listener with this key, unsubscribe it first
	if (activeListeners[listenerKey]) {
		console.log(`Replacing existing listener for key: ${listenerKey}`);
		activeListeners[listenerKey]();
	}
	
	activeListeners[listenerKey] = unsubscribeFn;
	console.log(`Registered listener with key: ${listenerKey}`);
}

/**
 * Remove a listener from the active listeners cache
 */
export function unregisterListener(listenerKey: string): void {
	if (activeListeners[listenerKey]) {
		console.log(`Unsubscribing listener with key: ${listenerKey}`);
		activeListeners[listenerKey]();
		delete activeListeners[listenerKey];
	}
}

/**
 * Clean up all active listeners
 */
export function cleanupAllListeners(): void {
	console.log(`Cleaning up all active listeners: ${Object.keys(activeListeners).length} listeners`);
	
	for (const key in activeListeners) {
		if (Object.prototype.hasOwnProperty.call(activeListeners, key)) {
			console.log(`Unsubscribing listener: ${key}`);
			activeListeners[key]();
			delete activeListeners[key];
		}
	}
}
