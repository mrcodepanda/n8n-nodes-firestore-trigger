# Building the n8n-firestore-trigger: A real-time workflow engine for database changes

## BLUF
A Firestore trigger node for n8n can be implemented as a persistent connection that listens to real-time database changes and triggers workflow executions. The implementation requires Firebase Admin SDK for authentication, Firestore listeners for detecting changes, and n8n's trigger node architecture for workflow integration. Your implementation plan should include setting up Firebase credentials, implementing document/collection listeners, and creating proper error handling for long-running connections. The node starter template you've already cloned provides the perfect foundation for development.

The Firestore trigger node fills a critical gap in n8n's integration ecosystem by enabling real-time workflow automation based on database events - essential for applications requiring immediate reactions to data changes like notification systems, data synchronization services, or automated business processes.

## Understanding the technical components

### n8n node architecture fundamentals

n8n nodes are TypeScript modules that implement the `INodeType` interface, with trigger nodes specifically marked by including `'trigger'` in their group property. Trigger nodes differ from regular nodes in several key ways:

- They don't have inputs (empty `inputs` array)
- They require a trigger mechanism (webhooks or polling)
- They use static data storage to maintain state between executions

For Firestore integration, the node will use a **persistent connection pattern** rather than webhooks, similar to how the PostgreSQL trigger node works. This involves:

- A `trigger()` method that establishes and maintains the connection
- Stateful management of the listener using workflow static data
- A `closeFunction` for proper resource cleanup when workflows are deactivated

### Firestore change listeners explained

Firebase Firestore provides real-time listeners that notify applications when data changes. These listeners work through:

1. **Subscription registration**: The client establishes a listener on specific documents or collections
2. **Change detection**: When documents change, Firestore generates events (added, modified, removed)
3. **Event propagation**: Changes are delivered to registered listeners along with metadata

**Critical implementation detail**: These listeners maintain persistent connections and provide three types of events that will be exposed in the node settings:
- `added`: Document created or matched by a query for the first time
- `modified`: Document content changed
- `removed`: Document deleted or no longer matches query criteria

## Implementation plan

### 1. Set up the project structure

Starting with your cloned template at `/home/saggarwal/projects/n8n-firestore-trigger`, organize the project files:

```
/home/saggarwal/projects/n8n-firestore-trigger/
├── credentials/
│   └── FirebaseAdminApi.credentials.ts    # Firebase authentication
├── nodes/
│   └── FirestoreTrigger/
│       ├── FirestoreTrigger.node.ts       # Main node implementation
│       ├── GenericFunctions.ts            # Shared utility functions
│       └── firestore.svg                  # Node icon
└── package.json                           # Dependencies and metadata
```

### 2. Add required dependencies

Update the `package.json` file to include necessary Firebase dependencies:

```json
{
  "name": "n8n-nodes-firestore-trigger",
  "version": "0.1.0",
  "description": "n8n node to trigger workflows from Firebase Firestore changes",
  "license": "MIT",
  "author": "YOUR NAME",
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "@google-cloud/firestore": "^7.1.0"
  },
  "main": "index.js",
  "scripts": {
    "build": "tsc && gulp build:icons",
    "dev": "tsc --watch",
    "format": "prettier --write src/"
  }
}
```

Run `npm install` to install the dependencies.

### 3. Implement Firebase credentials

Create `credentials/FirebaseAdminApi.credentials.ts`:

```typescript
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
```

### 4. Create utility functions

Add `nodes/FirestoreTrigger/GenericFunctions.ts` for shared helper functions:

```typescript
import * as admin from 'firebase-admin';
import { cert, getApp, initializeApp } from 'firebase-admin/app';
import { IDataObject } from 'n8n-workflow';

// Cache for Firebase app instances to prevent duplicates
const firebaseApps: Record<string, admin.app.App> = {};

/**
 * Initializes a Firebase app based on provided credentials
 */
export function initFirebaseApp(credentials: IDataObject) {
  const projectId = credentials.projectId as string;

  // Check if app already exists
  try {
    return getApp(projectId);
  } catch (error) {
    // App doesn't exist, initialize it
  }

  let serviceAccountJson: any;
  let appConfig: admin.AppOptions = { projectId };

  // Set up authentication based on method
  if (credentials.authenticationMethod === 'serviceAccount') {
    try {
      // Parse the service account JSON if it's a string
      if (typeof credentials.serviceAccountJson === 'string') {
        serviceAccountJson = JSON.parse(credentials.serviceAccountJson as string);
      } else {
        serviceAccountJson = credentials.serviceAccountJson;
      }
      appConfig.credential = cert(serviceAccountJson);
    } catch (error) {
      throw new Error(`Invalid service account JSON: ${error.message}`);
    }
  } else {
    // Use application default credentials
    appConfig.credential = admin.credential.applicationDefault();
  }

  // Initialize the app with the given configuration
  const app = initializeApp(appConfig, projectId);

  // Store for later reuse
  firebaseApps[projectId] = app;

  return app;
}

/**
 * Cleans up a Firebase app instance
 */
export function cleanupFirebaseApp(projectId: string) {
  if (firebaseApps[projectId]) {
    return firebaseApps[projectId].delete()
      .then(() => {
        delete firebaseApps[projectId];
      });
  }
  return Promise.resolve();
}
```

### 5. Implement the main trigger node

Create `nodes/FirestoreTrigger/FirestoreTrigger.node.ts`:

```typescript
import {
  INodeType,
  INodeTypeDescription,
  ITriggerResponse,
  IHookFunctions,
  IDataObject,
  INodeExecutionData,
  NodeConnectionTypes,
} from 'n8n-workflow';

import * as admin from 'firebase-admin';
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
    outputs: [NodeConnectionTypes.Main],
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
        options: [
          {
            name: 'Listen to Collection',
            value: 'listenToCollection',
            description: 'Listen for changes in a collection',
          },
          {
            name: 'Listen to Document',
            value: 'listenToDocument',
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
            operation: [
              'listenToDocument',
            ],
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
            operation: [
              'listenToCollection',
            ],
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
            description: 'Listen for metadata changes',
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
                      { name: 'Equal', value: '==' },
                      { name: 'Not Equal', value: '!=' },
                      { name: 'Greater Than', value: '>' },
                      { name: 'Greater Than or Equal', value: '>=' },
                      { name: 'Less Than', value: '<' },
                      { name: 'Less Than or Equal', value: '<=' },
                      { name: 'Array Contains', value: 'array-contains' },
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

  async trigger(this: IHookFunctions): Promise<ITriggerResponse> {
    const webhookData = this.getWorkflowStaticData('node');

    // Get node parameters
    const operation = this.getNodeParameter('operation') as string;
    const collection = this.getNodeParameter('collection') as string;
    const documentId = operation === 'listenToDocument'
      ? this.getNodeParameter('documentId') as string
      : undefined;
    const events = operation === 'listenToCollection'
      ? this.getNodeParameter('events', []) as string[]
      : undefined;
    const options = this.getNodeParameter('options', {}) as IDataObject;

    // Get credentials
    const credentials = await this.getCredentials('firebaseAdminApi');

    // Initialize Firebase
    const firebaseApp = initFirebaseApp(credentials);
    const db = getFirestore(firebaseApp);

    // Set database ID if specified
    if (credentials.databaseId && credentials.databaseId !== '(default)') {
      db._settings = {
        ...db._settings,
        databaseId: credentials.databaseId as string,
      };
    }

    // Variable to store unsubscribe function
    let unsubscribeFn: () => void;

    // This promise will never resolve but will start the listener
    const establishListener = new Promise<INodeExecutionData[][]>((resolve, reject) => {
      try {
        // Store cleanup function for later
        webhookData.unsubscribeFn = () => {
          if (unsubscribeFn) {
            unsubscribeFn();
          }

          // Clean up Firebase app when no longer needed
          cleanupFirebaseApp(credentials.projectId as string)
            .catch(e => console.error('Error cleaning up Firebase app:', e));
        };

        // Set up snapshot options
        const snapshotOptions: admin.firestore.SnapshotListenOptions = {};
        if (options.includeMetadataChanges) {
          snapshotOptions.includeMetadataChanges = true;
        }

        // Create the appropriate listener based on operation
        if (operation === 'listenToCollection') {
          let query = db.collection(collection);

          // Add query filters if provided
          if (options.queryFilters && (options.queryFilters as IDataObject).filters) {
            const filters = ((options.queryFilters as IDataObject).filters as IDataObject[]);
            for (const filter of filters) {
              query = query.where(
                filter.field as string,
                filter.operator as admin.firestore.WhereFilterOp,
                filter.value,
              );
            }
          }

          // Set up collection listener
          unsubscribeFn = query.onSnapshot(snapshotOptions, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              // Skip if the event type is not in the selected events
              if (events && !events.includes(change.type)) {
                return;
              }

              // Get the document data
              const docData = change.doc.data();
              const docInfo = {
                id: change.doc.id,
                data: docData,
                changeType: change.type,
                path: change.doc.ref.path,
                metadata: {
                  hasPendingWrites: change.doc.metadata.hasPendingWrites,
                  fromCache: change.doc.metadata.fromCache,
                },
                timestamp: Date.now(),
              };

              // Execute the workflow with the document data
              this.emit([this.helpers.returnJsonArray([docInfo])]);
            });
          }, (error) => {
            console.error('Firestore listener error:', error);
            // Don't reject as this would stop the trigger
          });
        } else if (operation === 'listenToDocument') {
          const docRef = db.collection(collection).doc(documentId);

          // Set up document listener
          unsubscribeFn = docRef.onSnapshot(snapshotOptions, (doc) => {
            const docData = doc.data() || {};
            const exists = doc.exists;

            const docInfo = {
              id: doc.id,
              data: docData,
              exists: exists,
              path: doc.ref.path,
              metadata: {
                hasPendingWrites: doc.metadata.hasPendingWrites,
                fromCache: doc.metadata.fromCache,
              },
              timestamp: Date.now(),
            };

            // Execute the workflow with the document data
            this.emit([this.helpers.returnJsonArray([docInfo])]);
          }, (error) => {
            console.error('Firestore document listener error:', error);
            // Don't reject as this would stop the trigger
          });
        }
      } catch (error) {
        console.error('Error setting up Firestore listener:', error);
        reject(error);
      }
    });

    // Return trigger response
    return {
      manualTriggerFunction: async () => {
        // For manual testing - this gets executed when "Test" is clicked
        return [[{ json: { success: true, message: 'Firestore trigger is listening for changes.' } }]];
      },
      closeFunction: () => {
        // Clean up when workflow is deactivated
        if (webhookData.unsubscribeFn) {
          webhookData.unsubscribeFn();
          delete webhookData.unsubscribeFn;
        }
      }
    };
  }
}
```

## Testing your implementation

### 1. Unit testing setup

Create a `tests` directory with test files:

```
tests/
├── FirestoreTrigger.test.ts     # Node functionality tests
├── GenericFunctions.test.ts     # Utility function tests
└── mocks/                       # Test mocks
    └── firebase-admin.mock.ts   # Firebase mocks
```

Basic test file structure (`tests/FirestoreTrigger.test.ts`):

```typescript
import { FirestoreTrigger } from '../nodes/FirestoreTrigger/FirestoreTrigger.node';

// Mock Firebase admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(() => 'mock-credential'),
    applicationDefault: jest.fn(() => 'mock-default-credential'),
  },
}));

// Mock Firestore
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        onSnapshot: jest.fn(() => jest.fn()),
      })),
      where: jest.fn(() => ({
        where: jest.fn(),
        onSnapshot: jest.fn(() => jest.fn()),
      })),
      onSnapshot: jest.fn(() => jest.fn()),
    })),
    _settings: {},
  })),
}));

describe('FirestoreTrigger', () => {
  let firestoreTrigger: FirestoreTrigger;

  beforeEach(() => {
    firestoreTrigger = new FirestoreTrigger();
  });

  test('should have correct properties', () => {
    expect(firestoreTrigger.description.name).toBe('firestoreTrigger');
    expect(firestoreTrigger.description.group).toContain('trigger');
    expect(firestoreTrigger.description.inputs).toHaveLength(0);
    expect(firestoreTrigger.description.outputs).toHaveLength(1);
  });

  // Add more tests for functionality
});
```

### 2. Integration testing with Firestore emulator

For integration testing, use the Firebase Emulator Suite:

1. Install the Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Initialize Firebase Emulator in your project:
   ```bash
   firebase init emulators
   # Select Firestore emulator during setup
   ```

3. Create an integration test script that:
   - Starts the Firestore emulator
   - Configures the node to use the emulator
   - Performs test operations (create/update/delete documents)
   - Verifies the trigger fires correctly

4. Test script example (`scripts/integration-test.js`):
   ```javascript
   const admin = require('firebase-admin');

   // Point to emulator
   process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

   async function runTest() {
     // Initialize app with test credentials
     const app = admin.initializeApp({ projectId: 'test-project' });
     const db = admin.firestore();

     // Test collection
     const collection = db.collection('test-collection');

     // Create a document
     await collection.doc('test-doc').set({ field: 'value' });
     console.log('Document created');

     // Update the document
     await collection.doc('test-doc').update({ field: 'updated' });
     console.log('Document updated');

     // Delete the document
     await collection.doc('test-doc').delete();
     console.log('Document deleted');

     // Cleanup
     await app.delete();
   }

   runTest().catch(console.error);
   ```

### 3. Manual testing within n8n

1. Build your node package:
   ```bash
   cd /home/saggarwal/projects/n8n-firestore-trigger
   npm run build
   ```

2. Link your node to n8n:
   ```bash
   cd /home/saggarwal/projects/n8n-firestore-trigger
   npm link

   # Go to your n8n installation directory
   cd ~/.n8n/custom
   npm link n8n-nodes-firestore-trigger
   ```

3. Restart n8n and test the node in the workflow editor:
   - Create a workflow with the Firestore Trigger node
   - Configure it to listen to a test collection
   - Make changes to Firestore (manually or via script)
   - Verify the workflow executes as expected

## Common challenges and solutions

### 1. Authentication issues

If you experience authentication problems:
- Verify the service account has appropriate permissions (Firestore read access at minimum)
- Ensure the service account JSON is correctly formatted
- Try both authentication methods (service account and application default) to see which works in your environment

### 2. Connection stability

For maintaining stable connections:
- Implement **exponential backoff** for reconnection attempts after errors
- Add **health check** capability to verify the listener is still active
- Include detailed **logging** to help diagnose connection issues

### 3. Performance considerations

To optimize performance:
- Use **specific queries** rather than broad collection listeners
- Implement **throttling** for high-frequency change events
- Consider **batching** multiple rapid changes rather than triggering for each one

## Conclusion

This implementation plan provides a comprehensive approach to creating a Firestore trigger node for n8n. The node leverages Firebase's real-time listener capabilities to trigger workflows when data changes, enabling powerful automation scenarios.

The architecture follows n8n's best practices for trigger nodes while addressing the specific requirements of maintaining long-running connections to Firestore. With proper testing and error handling, this node will provide a reliable way to integrate Firebase Firestore events into n8n workflows.

By following this implementation plan, you'll create a valuable addition to the n8n ecosystem that enables real-time, event-driven automation based on your Firestore database changes.
