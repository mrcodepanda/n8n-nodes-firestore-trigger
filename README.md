# n8n-nodes-firestore-trigger

![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

This package provides an n8n node that enables real-time Firebase Firestore triggers for your n8n workflows. With this node, you can listen to changes in Firestore documents and collections and automatically trigger workflows when data changes occur.

## Features

- **Real-time Firestore Triggers**: Listen for changes in Firestore and automatically execute workflows
- **Document & Collection Monitoring**: Monitor specific documents or entire collections
- **Event Filtering**: Choose which events to listen for (added, modified, or removed)
- **Query Support**: Apply filters to listen only for specific document changes
- **Metadata Support**: Optionally include metadata changes in your triggers

## Requirements

- n8n version 0.209.0 or later
- Firebase project with Firestore database
- Firebase Admin SDK credentials

## Installation

Follow these steps to install this node for use in your n8n instance:

```bash
# Install from npm
pnpm add n8n-nodes-firestore-trigger

# Alternatively, for local development:
cd ~/.n8n/custom/
pnpm link /path/to/n8n-nodes-firestore-trigger
```

Restart n8n after installation.

## Configuration

### Firebase Credentials

To use this node, you'll need to set up Firebase Admin SDK credentials:

1. Go to your [Firebase Console](https://console.firebase.google.com/)
2. Navigate to Project Settings > Service Accounts
3. Generate a new private key (JSON file)
4. In n8n, add these credentials when configuring the Firestore Trigger node

### Node Settings

The Firestore Trigger node provides several configuration options:

| Parameter | Description |
|-----------|-------------|
| Operation | Choose between "Listen to Collection" or "Listen to Document" |
| Collection | The Firestore collection to monitor |
| Document ID | (For document listening) The specific document ID to monitor |
| Events | (For collection listening) Events to trigger on: Added, Modified, Removed |
| Query Filters | Add filters to limit which document changes trigger the workflow |
| Include Metadata Changes | Whether to include metadata-only changes in triggers |

## Usage Examples

### Monitor Collection Changes

This example shows how to set up the node to monitor all changes to a "users" collection:

1. Add the Firestore Trigger node to your workflow
2. Select "Listen to Collection" operation
3. Enter "users" as the collection name
4. Select all events (Added, Modified, Removed)
5. Save and activate the workflow

### Watch a Specific Document

To monitor a specific document for changes:

1. Add the Firestore Trigger node to your workflow
2. Select "Listen to Document" operation
3. Enter "orders" as the collection name
4. Enter "order-123" as the document ID
5. Save and activate the workflow

### Filter by Document Properties

To only trigger on documents that match specific criteria:

1. Add the Firestore Trigger node to your workflow
2. Select "Listen to Collection" operation
3. Enter "products" as the collection name
4. Under "Options" > "Query Filters", add a filter:
   - Field: "status"
   - Operator: "=="
   - Value: "published"
5. Save and activate the workflow

## Output Data

When a trigger event occurs, the node passes the following data to the workflow:

```typescript
{
  id: string;           // Document ID
  data: object;         // Document data
  changeType: string;   // "added", "modified", or "removed"
  path: string;         // Full document path
  metadata: {           // Document metadata
    hasPendingWrites: boolean;
    fromCache: boolean;
  };
  timestamp: number;    // Timestamp of the event
}
```

## Implementation Plan

This section outlines the detailed implementation steps for developing this node.

### 1. Project Structure

```
n8n-firestore-trigger/
├── credentials/
│   └── FirebaseAdminApi.credentials.ts    # Firebase authentication
├── nodes/
│   └── FirestoreTrigger/
│       ├── FirestoreTrigger.node.ts       # Main node implementation
│       ├── GenericFunctions.ts            # Shared utility functions
│       └── firestore.svg                  # Node icon
└── package.json                           # Dependencies and metadata
```

### 2. Dependencies

Update `package.json` to include required Firebase dependencies:

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

### 3. Firebase Credentials

Implement the Firebase Admin API credentials in `credentials/FirebaseAdminApi.credentials.ts`:

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

### 4. Utility Functions

Create helper functions in `nodes/FirestoreTrigger/GenericFunctions.ts`:

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

### 5. Main Node Implementation

Create the main trigger node in `nodes/FirestoreTrigger/FirestoreTrigger.node.ts`:

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

### 6. Testing 

#### Unit Testing

Set up basic unit tests to ensure functionality:

1. Create a `tests` directory with the following structure:
   ```
   tests/
   ├── FirestoreTrigger.test.ts
   ├── GenericFunctions.test.ts
   └── mocks/
       └── firebase-admin.mock.ts
   ```

2. Add test scripts to `package.json`:
   ```json
   "scripts": {
     "test": "jest",
     "test:watch": "jest --watch"
   }
   ```

#### Integration Testing

For integration testing, use the Firebase Emulator:

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Create a test script that:
   - Starts the Firestore emulator
   - Configures the node to use the emulator
   - Performs test operations (create/update/delete documents)
   - Verifies the trigger fires correctly

#### Manual Testing

1. Build the package:
   ```bash
   pnpm run build
   ```

2. Link to n8n:
   ```bash
   cd /home/saggarwal/projects/n8n-firestore-trigger
   pnpm link --global
   
   cd ~/.n8n/custom
   pnpm link --global n8n-nodes-firestore-trigger
   ```

3. Test in n8n by:
   - Creating a workflow with the Firestore Trigger node
   - Configuring it to listen to a test collection
   - Making changes to Firestore manually or via script
   - Verifying the workflow executes as expected

## Performance Considerations

For optimal performance and reliability:

1. **Reconnection Strategy**: Implement exponential backoff for reconnection attempts
2. **Throttling**: Consider throttling high-frequency change events
3. **Document Size**: Be aware of document size limitations and performance impact
4. **Query Optimization**: Use specific queries rather than broad collection listeners
5. **Connection Health**: Implement health check logic to verify listener status

## License

[MIT](LICENSE.md)
