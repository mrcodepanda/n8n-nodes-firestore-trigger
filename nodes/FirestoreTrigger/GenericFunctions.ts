import * as admin from 'firebase-admin';
import { cert, getApp, initializeApp } from 'firebase-admin/app';
import { IDataObject } from 'n8n-workflow';

// Cache for Firebase app instances to prevent duplicates
const firebaseApps: Record<string, any> = {};

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
