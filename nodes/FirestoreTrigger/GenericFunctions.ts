import * as admin from 'firebase-admin';
import { cert, getApp, initializeApp } from 'firebase-admin/app';
import { IDataObject } from 'n8n-workflow';
import { App } from 'firebase-admin/app';
import { CollectionReference, DocumentReference, Firestore } from 'firebase-admin/firestore';

// Types for path handling
type PathSegment = {
	value: string;
	isParameter: boolean;
	paramName?: string;
};

type PathAnalysis = {
	segments: PathSegment[];
	isCollection: boolean;
	hasParameters: boolean;
	parameterNames: string[];
};

// Cache for Firebase app instances to prevent duplicates
const firebaseApps: Record<string, App> = {};

// Cache for active listeners to avoid duplicates and manage cleanup
export const activeListeners: Record<string, () => void> = {};

// Cache for path pattern listeners to track listeners created for dynamic paths
type PatternListener = {
	parentDocPath: string;
	listener: () => void;
	parentListenerKey: string;
};
export const patternListeners: Record<string, Record<string, PatternListener>> = {};

/**
 * Initializes a Firebase app based on provided credentials
 */
export function initFirebaseApp(credentials: IDataObject): App {
	if (!credentials.projectId) {
		throw new Error('Firebase project ID is required. Please check your credential configuration.');
	}
	
	const projectId = credentials.projectId as string;

	// Check if app already exists
	try {
		console.log(`Checking if Firebase app already exists for project: ${projectId}`);
		return getApp(projectId) as App;
	} catch (error) {
		console.log(`Firebase app doesn't exist yet for project: ${projectId}, initializing new app`);
		// App doesn't exist, initialize it
	}

	let serviceAccountJson: any;
	let appConfig: admin.AppOptions = { projectId };

	// Set up authentication based on method
	try {
		if (credentials.authenticationMethod === 'serviceAccount') {
			console.log('Using Service Account authentication method');
			try {
				// Parse the service account JSON if it's a string
				if (typeof credentials.serviceAccountJson === 'string') {
					console.log('Parsing service account JSON from string');
					try {
						serviceAccountJson = JSON.parse(credentials.serviceAccountJson as string);
					} catch (parseError) {
						throw new Error(`Invalid service account JSON format. Please ensure it's valid JSON: ${(parseError as Error).message}`);
					}
				} else {
					serviceAccountJson = credentials.serviceAccountJson;
				}
				
				if (!serviceAccountJson) {
					throw new Error('Service account JSON is empty. Please provide a valid service account key file.');
				}
				
				// Validate that the service account JSON has required fields
				if (!serviceAccountJson.project_id || !serviceAccountJson.private_key || !serviceAccountJson.client_email) {
					throw new Error('Service account JSON is missing required fields (project_id, private_key, or client_email). Please provide a valid service account key file.');
				}
				
				appConfig.credential = cert(serviceAccountJson);
			} catch (error) {
				console.error('Error parsing service account JSON:', error);
				throw new Error(`Invalid service account JSON: ${(error as Error).message}`);
			}
		} else {
			// Use application default credentials
			console.log('Using Application Default Credentials authentication method');
			try {
				appConfig.credential = admin.credential.applicationDefault();
			} catch (error) {
				console.error('Error using application default credentials:', error);
				throw new Error(`Could not load application default credentials. Make sure to set up ADC by running 'gcloud auth application-default login' or set the GOOGLE_APPLICATION_CREDENTIALS environment variable. Error: ${(error as Error).message}`);
			}
		}

		// Initialize the app with the given configuration
		console.log('Initializing Firebase app with config:', {
			projectId: appConfig.projectId,
			databaseURL: appConfig.databaseURL || 'default',
			hasCredential: !!appConfig.credential,
		});

		try {
			const app = initializeApp(appConfig, projectId) as App;
			
			// Verify that we can connect to Firestore as a basic authentication test
			// Simply get the app without testing connection - the connection will be tested when used
			
			// Store for later reuse
			firebaseApps[projectId] = app;
			console.log(`Firebase app initialized successfully for project: ${projectId}`);
			
			return app;
		} catch (initError) {
			console.error('Error initializing Firebase app:', initError);
			throw new Error(`Failed to initialize Firebase app: ${(initError as Error).message}`);
		}
	} catch (error) {
		console.error('Firebase authentication error:', error);
		if ((error as Error).message.includes('default credentials')) {
			throw new Error(`Authentication failed: Could not load the default credentials. Make sure you have the correct authentication method selected in your credentials configuration. For 'Service Account' method, provide a valid service account JSON. For 'Application Default Credentials' method, follow the guide at https://cloud.google.com/docs/authentication/getting-started`);
		} else if ((error as Error).message.includes('service account')) {
			throw new Error(`Authentication failed: Invalid service account configuration. Make sure your service account JSON is valid and has the required permissions. Error: ${(error as Error).message}`);
		} else {
			throw new Error(`Firebase authentication error: ${(error as Error).message}`);
		}
	}
}

/**
 * Cleans up a Firebase app instance
 */
export function cleanupFirebaseApp(projectId: string): Promise<void> {
	console.log(`Cleaning up Firebase app for project: ${projectId}`);
	if (firebaseApps[projectId]) {
		console.log(`Found Firebase app for project: ${projectId}, deleting app`);
		// Cast to any to access the delete method that exists but is not in the type definition
		return (firebaseApps[projectId] as any).delete()
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
 * Parse a path into segments with parameter information
 */
export function parsePath(path: string): PathAnalysis {
	// Safety check - ensure we have a valid string
	if (!path) {
		throw new Error('Cannot parse null or undefined path');
	}
	
	// Normalize the path before processing
	const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '');
	
	if (normalizedPath === '') {
		throw new Error('Cannot parse empty path');
	}
	
	// Split and filter empty segments
	const rawSegments = normalizedPath.split('/').filter(segment => segment !== '');
	
	if (rawSegments.length === 0) {
		throw new Error(`Path "${path}" contains no valid segments after normalization`);
	}
	
	const segments: PathSegment[] = [];
	const parameterNames: string[] = [];
	let hasParameters = false;
	
	for (const segment of rawSegments) {
		// Check if this segment is valid (not empty)
		if (segment.trim() === '') {
			throw new Error(`Path "${path}" contains empty segments after splitting`);
		}
		
		const isParam = isPathParameter(segment);
		
		if (isParam) {
			hasParameters = true;
			const paramName = extractParameterName(segment);
			
			// Ensure parameter name is not empty
			if (!paramName || paramName.trim() === '') {
				throw new Error(`Path "${path}" contains parameter with empty name (e.g., ":/")`);
			}
			
			parameterNames.push(paramName);
			
			segments.push({
				value: segment,
				isParameter: true,
				paramName,
			});
		} else {
			segments.push({
				value: segment,
				isParameter: false,
			});
		}
	}
	
	// A path with an odd number of segments represents a collection
	const isCollection = segments.length % 2 === 1;
	
	return {
		segments,
		isCollection,
		hasParameters,
		parameterNames,
	};
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
 * Validate a document path format
 * Must have an even number of segments for a valid document path
 */
export function validateDocumentPath(path: string): boolean {
	const segments = path.split('/').filter(segment => segment.trim() !== '');
	return segments.length % 2 === 0 && segments.length > 0;
}

/**
 * Resolve a path pattern with actual values
 * @param pathPattern Pattern with parameters (e.g., "users/:userId/orders")
 * @param paramValues Object with parameter values (e.g., { userId: "123" })
 * @returns Resolved path (e.g., "users/123/orders")
 */
export function resolvePath(pathPattern: string, paramValues: Record<string, string>): string {
	const analysis = parsePath(pathPattern);
	const resolvedSegments: string[] = [];
	
	for (const segment of analysis.segments) {
		if (segment.isParameter && segment.paramName) {
			const paramValue = paramValues[segment.paramName];
			
			if (!paramValue) {
				throw new Error(`Missing value for parameter "${segment.paramName}" in path pattern "${pathPattern}"`);
			}
			
			resolvedSegments.push(paramValue);
		} else {
			resolvedSegments.push(segment.value);
		}
	}
	
	return resolvedSegments.join('/');
}

/**
 * Extract the parent document path from a collection path
 * @param collectionPath Full path to a collection (e.g., "users/123/orders")
 * @returns Path to the parent document (e.g., "users/123")
 */
export function getParentDocumentPath(collectionPath: string): string | null {
	const segments = collectionPath.split('/').filter(segment => segment.trim() !== '');
	
	// If this is a top-level collection, it has no parent document
	if (segments.length <= 1) {
		return null;
	}
	
	// Remove the last segment (collection name) to get the parent document path
	return segments.slice(0, segments.length - 1).join('/');
}

/**
 * Finds the first parameterized segment in a path and returns its parent path
 * @param path Path to analyze (e.g., "users/:userId/orders")
 * @returns Path to the parent of the first parameter (e.g., "users")
 */
export function findFirstParameterParentPath(path: string): string | null {
	const analysis = parsePath(path);
	
	if (!analysis.hasParameters) {
		return null;
	}
	
	// Find the index of the first parameter
	const firstParamIndex = analysis.segments.findIndex(segment => segment.isParameter);
	
	if (firstParamIndex <= 0) {
		return null; // If it's the first segment or not found, there's no parent
	}
	
	// Return the path up to but not including the parameter
	const parentSegments = analysis.segments.slice(0, firstParamIndex).map(segment => segment.value);
	const parentPath = parentSegments.join('/');
	
	console.log(`Found parent path "${parentPath}" for first parameter at index ${firstParamIndex}`);
	
	// Special handling for top-level collections like "users/:userId/orders"
	if (parentSegments.length === 1) {
		console.log(`Parent path is a top-level collection`);
	}
	
	return parentPath;
}

/**
 * Creates a Firestore reference for a collection or document path
 * Works with both static paths and those containing parameters
 */
export function createFirestoreReference(db: Firestore, path: string): CollectionReference | DocumentReference {
	// Validate the db reference
	if (!db) {
		throw new Error('Invalid Firestore database reference');
	}
	
	// Validate and normalize the path
	if (!path) {
		throw new Error('Path cannot be null or undefined');
	}
	
	const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '');
	
	if (normalizedPath === '') {
		throw new Error('Path cannot be empty');
	}
	
	// Split path and ensure there are no empty segments
	const segments = normalizedPath.split('/').filter(segment => segment !== '');
	
	if (segments.length === 0) {
		throw new Error(`Path "${path}" contains no valid segments after normalization`);
	}
	
	// Check each segment to make sure none are empty
	for (const segment of segments) {
		if (segment.trim() === '') {
			throw new Error(`Path "${path}" contains empty segments after splitting`);
		}
	}
	
	console.log(`Creating Firestore reference for path: "${normalizedPath}" with ${segments.length} segments`);
	
	try {
		let ref: any = db;
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			console.log(`Processing segment[${i}]: "${segment}"`);
			
			if (i % 2 === 0) {
				// Even indices (0, 2, 4...) are collection names
				console.log(`Creating collection reference for: "${segment}"`);
				ref = ref.collection(segment);
			} else {
				// Odd indices (1, 3, 5...) are document IDs
				console.log(`Creating document reference for: "${segment}"`);
				ref = ref.doc(segment);
			}
		}
		
		console.log(`Successfully created Firestore reference for path: "${normalizedPath}"`);
		return ref;
	} catch (error) {
		console.error(`Error creating Firestore reference for path "${normalizedPath}":`, error);
		throw new Error(`Failed to create Firestore reference: ${error.message}`);
	}
}

/**
 * Creates a collection reference from a path
 */
export function getCollectionRef(db: Firestore, path: string): CollectionReference {
	// Validate parameters
	if (!db) {
		throw new Error('Invalid Firestore database reference');
	}
	
	if (!path || path.trim() === '') {
		throw new Error('Collection path cannot be empty');
	}
	
	// Normalize the path
	const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '');
	
	if (normalizedPath === '') {
		throw new Error('Collection path is empty after normalization');
	}
	
	// Validate path format
	if (!validateCollectionPath(normalizedPath)) {
		throw new Error(`Invalid collection path: "${normalizedPath}". Collection paths must have an odd number of segments.`);
	}
	
	try {
		console.log(`Getting collection reference for path: "${normalizedPath}"`);
		return createFirestoreReference(db, normalizedPath) as CollectionReference;
	} catch (error) {
		console.error(`Error getting collection reference for path "${normalizedPath}":`, error);
		throw new Error(`Failed to get collection reference: ${error.message}`);
	}
}

/**
 * Creates a document reference from a collection path and document ID
 */
export function getDocumentRef(db: Firestore, collectionPath: string, documentId: string): DocumentReference {
	// Validate parameters
	if (!db) {
		throw new Error('Invalid Firestore database reference');
	}
	
	if (!collectionPath || collectionPath.trim() === '') {
		throw new Error('Collection path cannot be empty');
	}
	
	if (!documentId || documentId.trim() === '') {
		throw new Error('Document ID cannot be empty');
	}
	
	// Normalize the path
	const normalizedPath = collectionPath.trim().replace(/^\/+|\/+$/g, '');
	const normalizedDocId = documentId.trim();
	
	if (normalizedPath === '') {
		throw new Error('Collection path is empty after normalization');
	}
	
	if (normalizedDocId === '') {
		throw new Error('Document ID is empty after normalization');
	}
	
	// Validate path format
	if (!validateCollectionPath(normalizedPath)) {
		throw new Error(`Invalid collection path: "${normalizedPath}". Collection paths must have an odd number of segments.`);
	}
	
	try {
		console.log(`Getting document reference for path: "${normalizedPath}/${normalizedDocId}"`);
		const collectionRef = getCollectionRef(db, normalizedPath);
		return collectionRef.doc(normalizedDocId);
	} catch (error) {
		console.error(`Error getting document reference for path "${normalizedPath}/${normalizedDocId}":`, error);
		throw new Error(`Failed to get document reference: ${error.message}`);
	}
}

/**
 * Creates a path pattern listener key
 */
export function createPatternListenerKey(pathPattern: string): string {
	return `pattern:${pathPattern}`;
}

/**
 * Creates a document listener key
 */
export function createDocumentListenerKey(path: string): string {
	return `doc:${path}`;
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
 * Register a pattern listener for a specific path pattern
 */
export function registerPatternListener(
	patternKey: string, 
	docPath: string, 
	listener: () => void, 
	parentListenerKey: string
): void {
	// Initialize the pattern listeners object if it doesn't exist
	if (!patternListeners[patternKey]) {
		patternListeners[patternKey] = {};
	}
	
	// If there's already a listener for this document path, clean it up first
	if (patternListeners[patternKey][docPath]) {
		patternListeners[patternKey][docPath].listener();
	}
	
	// Store the new listener
	patternListeners[patternKey][docPath] = {
		parentDocPath: docPath,
		listener,
		parentListenerKey,
	};
	
	console.log(`Registered pattern listener for pattern: ${patternKey}, doc: ${docPath}`);
}

/**
 * Unregister a specific pattern listener
 */
export function unregisterPatternListener(patternKey: string, docPath: string): void {
	if (patternListeners[patternKey] && patternListeners[patternKey][docPath]) {
		console.log(`Unregistering pattern listener for pattern: ${patternKey}, doc: ${docPath}`);
		patternListeners[patternKey][docPath].listener();
		delete patternListeners[patternKey][docPath];
	}
}

/**
 * Clean up all pattern listeners for a specific pattern
 */
export function cleanupPatternListeners(patternKey: string): void {
	if (patternListeners[patternKey]) {
		console.log(`Cleaning up pattern listeners for: ${patternKey}`);
		
		for (const docPath in patternListeners[patternKey]) {
			if (Object.prototype.hasOwnProperty.call(patternListeners[patternKey], docPath)) {
				patternListeners[patternKey][docPath].listener();
			}
		}
		
		delete patternListeners[patternKey];
	}
}

/**
 * Clean up all active listeners
 */
export function cleanupAllListeners(): void {
	console.log(`Cleaning up all active listeners: ${Object.keys(activeListeners).length} listeners`);
	
	// Clean up regular listeners
	for (const key in activeListeners) {
		if (Object.prototype.hasOwnProperty.call(activeListeners, key)) {
			console.log(`Unsubscribing listener: ${key}`);
			activeListeners[key]();
			delete activeListeners[key];
		}
	}
	
	// Clean up pattern listeners
	for (const patternKey in patternListeners) {
		if (Object.prototype.hasOwnProperty.call(patternListeners, patternKey)) {
			cleanupPatternListeners(patternKey);
		}
	}
}

/**
 * Validates Firebase credentials and returns helpful error messages
 */
export function validateFirebaseCredentials(credentials: IDataObject): string | null {
	// Check for required fields
	if (!credentials) {
		return 'Firebase credentials are missing. Please check your credential configuration.';
	}
	
	if (!credentials.projectId) {
		return 'Firebase project ID is missing. Please check your credential configuration.';
	}
	
	// Check authentication method
	if (credentials.authenticationMethod === 'serviceAccount') {
		if (!credentials.serviceAccountJson) {
			return 'Service Account JSON is missing. Please provide a valid service account key file.';
		}
		
		// Basic format validation if it's a string
		if (typeof credentials.serviceAccountJson === 'string') {
			try {
				const parsed = JSON.parse(credentials.serviceAccountJson as string);
				
				// Check for required service account fields
				if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
					return 'Service Account JSON is missing required fields (project_id, client_email, or private_key). Please provide a valid service account key file.';
				}
				
				// Check if the project_id matches the provided projectId
				if (parsed.project_id !== credentials.projectId) {
					return `Project ID mismatch: The project ID in the service account JSON (${parsed.project_id}) does not match the configured project ID (${credentials.projectId}).`;
				}
			} catch (error) {
				return `Invalid Service Account JSON format: ${(error as Error).message}`;
			}
		}
	} else if (credentials.authenticationMethod === 'applicationDefault') {
		// Can't fully validate ADC without trying to use it, but we can check if the env var is set
		if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
			return 'Using Application Default Credentials but GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. You may need to run "gcloud auth application-default login" or set this environment variable to the path of your service account key file.';
		}
	} else {
		return `Unknown authentication method: ${credentials.authenticationMethod}. Please use either 'serviceAccount' or 'applicationDefault'.`;
	}
	
	// All checks passed
	return null;
}
