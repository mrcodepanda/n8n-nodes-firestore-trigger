import * as admin from 'firebase-admin';
import { cert, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';
import { IDataObject } from 'n8n-workflow';
import { App } from 'firebase-admin/app';
import { Firestore } from 'firebase-admin/firestore';

/**
 * Service class to handle Firebase application management and operations
 */
export class FirebaseService {
	// Cache for Firebase app instances to prevent duplicates
	private firebaseApps: Record<string, App> = {};

	/**
	 * Initializes a Firebase app based on provided credentials
	 * 
	 * @param credentials - The Firebase credentials object
	 * @returns Initialized Firebase App instance
	 */
	public initApp(credentials: IDataObject): App {
		if (!credentials.projectId) {
			throw new Error('Firebase project ID is required. Please check your credential configuration.');
		}
		
		const projectId = credentials.projectId as string;

		// Check if app already exists
		try {
			return getApp(projectId) as App;
		} catch {
			// App doesn't exist, initialize it
		}

		let serviceAccountJson: Record<string, unknown>;
		const appConfig: admin.AppOptions = { projectId };

		// Set up authentication based on method
		try {
			if (credentials.authenticationMethod === 'serviceAccount') {
				try {
					// Parse the service account JSON if it's a string
					if (typeof credentials.serviceAccountJson === 'string') {
						try {
							serviceAccountJson = JSON.parse(credentials.serviceAccountJson as string);
						} catch (parseError) {
							throw new Error(`Invalid service account JSON format. Please ensure it's valid JSON: ${(parseError as Error).message}`);
						}
					} else {
						serviceAccountJson = credentials.serviceAccountJson as Record<string, unknown>;
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
				try {
					appConfig.credential = admin.credential.applicationDefault();
				} catch (error) {
					console.error('Error using application default credentials:', error);
					throw new Error(`Could not load application default credentials. Make sure to set up ADC by running 'gcloud auth application-default login' or set the GOOGLE_APPLICATION_CREDENTIALS environment variable. Error: ${(error as Error).message}`);
				}
			}

			// Initialize the app with the given configuration
			try {
				const app = initializeApp(appConfig, projectId) as App;
				
				// Store for later reuse
				this.firebaseApps[projectId] = app;
				
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
	 * Gets a Firestore instance from a Firebase app
	 * 
	 * @param app - Firebase app instance
	 * @param databaseId - Optional database ID for multi-database setups
	 * @returns Firestore database instance
	 */
	public getFirestore(app: App, databaseId?: string): Firestore {
		if (!app) {
			throw new Error('Invalid Firebase app instance');
		}

		const db = adminGetFirestore(app);

		// Set database ID if specified and not default
		if (databaseId && databaseId !== '(default)') {
			// @ts-expect-error - _settings is not in the type definitions but works in practice
			db._settings = {
				// @ts-expect-error - _settings is internal API
				...db._settings,
				databaseId: databaseId,
			};
		}

		return db;
	}

	/**
	 * Cleans up a Firebase app instance
	 * 
	 * @param projectId - Firebase project ID
	 * @returns Promise that resolves when cleanup is complete
	 */
	public async cleanupApp(projectId: string): Promise<void> {
		console.log(`Cleaning up Firebase app for project: ${projectId}`);
		if (this.firebaseApps[projectId]) {
			console.log(`Found Firebase app for project: ${projectId}, deleting app`);
			// Cast to access the delete method that exists but is not in the type definition
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (this.firebaseApps[projectId] as any).delete()
				.then(() => {
					console.log(`Successfully deleted Firebase app for project: ${projectId}`);
					delete this.firebaseApps[projectId];
				})
				.catch((error: Error) => {
					console.error(`Error deleting Firebase app for project: ${projectId}:`, error);
					// Still remove from cache even if deletion fails
					delete this.firebaseApps[projectId];
					return Promise.resolve();
				});
		}
		console.log(`No Firebase app found for project: ${projectId}, nothing to clean up`);
		return Promise.resolve();
	}

	/**
	 * Validates Firebase credentials and returns helpful error messages
	 * 
	 * @param credentials - Firebase credentials object
	 * @returns Error message string or null if valid
	 */
	public validateCredentials(credentials: IDataObject): string | null {
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
}

// Export a singleton instance
export const firebaseService = new FirebaseService();