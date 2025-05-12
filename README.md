# n8n-nodes-firestore-trigger

![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

This package provides an n8n node that enables real-time Firebase Firestore triggers for your n8n workflows. With this node, you can listen to changes in Firestore documents and collections and automatically trigger workflows when data changes occur.

## Project Status

This project has successfully completed development and testing with a real Firebase instance. The node can now:

1. Connect to a real Firebase Firestore database
2. Listen to collections and documents for changes
3. Trigger workflows based on those changes (added, modified, removed)
4. Support path patterns and dynamic subcollection monitoring
5. Apply query filters to limit which document changes trigger the workflow

Implementation is complete and functional in a production environment. The node is ready for release after final documentation updates and code review.

## Features

- **Real-time Firestore Triggers**: Listen for changes in Firestore and automatically execute workflows
- **Document & Collection Monitoring**: Monitor specific documents or entire collections
- **Dynamic Subcollection Support**: Listen to nested subcollections using path patterns (e.g., "users/:userId/orders")
- **Path Pattern Matching**: Use colon syntax to create dynamic listeners that respond to multiple documents
- **Event Filtering**: Choose which events to listen for (added, modified, or removed)
- **Query Support**: Apply filters to listen only for specific document changes
- **Metadata Support**: Optionally include metadata changes in your triggers
- **n8n Expression Support**: Use dynamic expressions in path segments for flexible data access

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
| Collection Path | The Firestore collection path to monitor (supports path patterns like "users/:userId/orders") |
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
3. Enter "products" as the collection path
4. Under "Options" > "Query Filters", add a filter:
   - Field: "status"
   - Operator: "=="
   - Value: "published"
5. Save and activate the workflow

### Monitor a Subcollection

To listen for changes in a subcollection:

1. Add the Firestore Trigger node to your workflow
2. Select "Listen to Collection" operation
3. Enter "users/:userId/orders" as the collection path
   - This will monitor the "orders" subcollection under any document in the "users" collection
   - The `:userId` parameter creates a dynamic listener that responds to any matching document
4. Select desired events (Added, Modified, Removed)
5. Save and activate the workflow

### Use Dynamic References with Expressions

To dynamically monitor subcollections based on data from previous nodes:

1. Add the Firestore Trigger node to your workflow
2. Select "Listen to Collection" operation
3. Enter a collection path with expressions: `users/{{$node["GetUserInfo"].data["userId"]}}/orders`
   - This uses the output from a previous node named "GetUserInfo" to dynamically set the user ID
4. Select desired events
5. Save and activate the workflow

### Use Path Pattern Matching

To create dynamic listeners for multiple documents matching a pattern:

1. Add the Firestore Trigger node to your workflow
2. Select "Listen to Collection" operation
3. Enter "chats/:chatId/messages" as the collection path
   - This creates listeners for the "messages" subcollection in any document in the "chats" collection
   - If a new chat document is created, a listener for its messages is automatically created
   - If a chat document is deleted, its corresponding listener is automatically removed
4. Select desired events
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

### 6. Testing

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

3. Testing results:
   * Successfully linked the package to a local n8n instance on May 12, 2025
   * Successfully connected to a real Firebase Firestore instance
   * Successfully triggered workflows on document changes (added, modified, removed)
   * Validated all event filtering functionality
   * Tested subcollection monitoring and path pattern matching
   * Verified query filtering works correctly

4. Test procedure:
   - Created a workflow with the Firestore Trigger node
   - Configured it to listen to a test collection
   - Made changes to Firestore manually and via a test script
   - Verified the workflow executes as expected for all event types

## Known Issues

1. **Node Display Name**: When installed in n8n, the node may appear as "Firestore" rather than "Firestore Trigger" in the node selection menu. This is a known issue and doesn't affect functionality.

## Performance Considerations

For optimal performance and reliability:

1. **Reconnection Strategy**: Implement exponential backoff for reconnection attempts
2. **Throttling**: Consider throttling high-frequency change events
3. **Document Size**: Be aware of document size limitations and performance impact
4. **Query Optimization**: Use specific queries rather than broad collection listeners
5. **Connection Health**: Implement health check logic to verify listener status

## License

[MIT](LICENSE.md)
