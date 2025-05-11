import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FirebaseAdminApi implements ICredentialType {
	name = 'firebaseAdminApi';
	displayName = 'Firebase Admin API';
	documentationUrl = 'https://firebase.google.com/docs/admin/setup';
	
	properties: INodeProperties[] = [
		{
			displayName: 'Authentication Method',
			name: 'authenticationMethod',
			type: 'options',
			options: [
				{
					name: 'Service Account JSON',
					value: 'serviceAccount',
				},
				{
					name: 'Application Default Credentials',
					value: 'applicationDefault',
				},
			],
			default: 'serviceAccount',
		},
		{
			displayName: 'Service Account Key JSON',
			name: 'serviceAccountJson',
			type: 'string',
			typeOptions: {
				rows: 10,
			},
			default: '',
			required: true,
			displayOptions: {
				show: {
					authenticationMethod: [
						'serviceAccount',
					],
				},
			},
			description: 'The service account key JSON object or file content',
		},
		{
			displayName: 'Project ID',
			name: 'projectId',
			type: 'string',
			default: '',
			required: true,
			description: 'Firebase project ID',
		},
		{
			displayName: 'Database ID',
			name: 'databaseId',
			type: 'string',
			default: '(default)',
			description: 'The Firestore database ID (default is fine for most projects)',
		},
	];
}
