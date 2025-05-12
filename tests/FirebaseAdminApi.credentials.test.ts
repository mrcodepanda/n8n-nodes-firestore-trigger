import { FirebaseAdminApi } from '../credentials/FirebaseAdminApi.credentials';

describe('FirebaseAdminApi Credentials', () => {
	let firebaseAdminApi: FirebaseAdminApi;

	beforeEach(() => {
		firebaseAdminApi = new FirebaseAdminApi();
	});

	it('should have the correct name and display name', () => {
		expect(firebaseAdminApi.name).toBe('firebaseAdminApi');
		expect(firebaseAdminApi.displayName).toBe('Firebase Admin API');
	});

	it('should have the correct documentation URL', () => {
		expect(firebaseAdminApi.documentationUrl).toBe('https://firebase.google.com/docs/admin/setup');
	});

	it('should have required credential properties', () => {
		const properties = firebaseAdminApi.properties;
		
		// Check authentication method property exists
		const authMethodProperty = properties.find((prop) => prop.name === 'authenticationMethod');
		expect(authMethodProperty).toBeDefined();
		expect(authMethodProperty?.type).toBe('options');
		
		// Check service account JSON property exists
		const serviceAccountProperty = properties.find((prop) => prop.name === 'serviceAccountJson');
		expect(serviceAccountProperty).toBeDefined();
		expect(serviceAccountProperty?.type).toBe('string');
		expect(serviceAccountProperty?.required).toBe(true);
		
		// Check project ID property exists
		const projectIdProperty = properties.find((prop) => prop.name === 'projectId');
		expect(projectIdProperty).toBeDefined();
		expect(projectIdProperty?.type).toBe('string');
		expect(projectIdProperty?.required).toBe(true);
		
		// Check database ID property exists
		const databaseIdProperty = properties.find((prop) => prop.name === 'databaseId');
		expect(databaseIdProperty).toBeDefined();
		expect(databaseIdProperty?.type).toBe('string');
		expect(databaseIdProperty?.default).toBe('(default)');
	});

	it('should show service account JSON field only when service account method is selected', () => {
		const serviceAccountProperty = firebaseAdminApi.properties.find(
			(prop) => prop.name === 'serviceAccountJson',
		);
		
		expect(serviceAccountProperty?.displayOptions).toBeDefined();
		expect(serviceAccountProperty?.displayOptions?.show).toBeDefined();
		expect(serviceAccountProperty?.displayOptions?.show?.authenticationMethod).toContain('serviceAccount');
	});
});
