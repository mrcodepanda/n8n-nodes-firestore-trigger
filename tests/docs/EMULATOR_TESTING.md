# Firestore Emulator Testing Guide

This guide explains how to use the Firebase emulator to test the n8n-nodes-firestore-trigger node without requiring a real Firebase project.

## Testing Status

✅ **COMPLETED (May 11, 2025)**: Successfully tested with the Firebase emulator.
✅ **COMPLETED (May 12, 2025)**: Additionally validated with a real Firebase instance.

The node has been thoroughly tested using both the Firebase emulator and a real Firebase instance, confirming that it works correctly in both environments. The emulator tests were completed on May 11, 2025, and real Firebase instance tests were completed on May 12, 2025.

## Prerequisites

- Node.js (v18+)
- npm or pnpm
- Firebase CLI (`npm install -g firebase-tools` or `pnpm add -g firebase-tools`)
- n8n installed for integration testing (optional)

## Setting Up the Emulator

1. Clone the repository and navigate to the project directory:
   ```bash
   cd /home/saggarwal/projects/n8n-nodes-firestore-trigger
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Navigate to the emulator directory:
   ```bash
   cd tests/emulator
   ```

4. Make the setup script executable and run it:
   ```bash
   chmod +x setup-emulator.sh
   ./setup-emulator.sh
   ```

   This script will:
   - Check if Firebase CLI is installed
   - Create a local Firebase project configuration with project ID 'n8n-nodes-firestore-trigger-test'
   - Start the Firestore emulator on port 9099
   - Start the Emulator UI on port 4000

5. Once the emulator is running, open a new terminal window and seed it with test data:
   ```bash
   cd /home/saggarwal/projects/n8n-nodes-firestore-trigger
   pnpm run emulator:seed
   ```

   This will create:
   - A 'test-collection' with documents 'doc1' and 'doc2'
   - A 'test-listen' collection with a document 'listen-doc'

## Testing the Trigger Node

There are three main ways to test the node with the emulator:

### Method 1: Running Automated Tests

The project includes several automated test scripts for different listener types:

1. Build the node package:
   ```bash
   cd /home/saggarwal/projects/n8n-nodes-firestore-trigger
   pnpm build
   ```

2. Run the collection listener test:
   ```bash
   pnpm run test:collection
   ```

   Or run the document listener test:
   ```bash
   pnpm run test:document
   ```

   Or run the subcollection listener test:
   ```bash
   pnpm run test:subcollection
   ```

   These scripts will:
   - Start the emulator automatically if not running
   - Build the project
   - Run the appropriate test script
   - Show test results in the console

### Method 2: Using the Test Script

1. Build the node package:
   ```bash
   cd /home/saggarwal/projects/n8n-nodes-firestore-trigger
   pnpm build
   ```

2. Run the test script:
   ```bash
   pnpm run emulator:test
   ```

   This script:
   - Configures the node to use the emulator
   - Creates a mock n8n environment
   - Initializes the trigger node
   - Listens for events

3. In another terminal, simulate Firestore changes:
   ```bash
   pnpm run emulator:simulate
   ```

   For testing subcollection functionality:
   ```bash
   pnpm run emulator:simulate:subcollection
   ```

4. Watch the output in the test script terminal to see events being triggered

### Method 3: Testing with n8n

1. Link your package to n8n:
   ```bash
   cd /home/saggarwal/projects/n8n-nodes-firestore-trigger
   pnpm link --global
   
   cd ~/.n8n/custom
   pnpm link --global n8n-nodes-firestore-trigger
   ```

2. Set the emulator environment variable before starting n8n:
   ```bash
   export FIRESTORE_EMULATOR_HOST=localhost:9099
   ```

3. Start n8n:
   ```bash
   n8n start
   ```

4. In n8n:
   - Create a new workflow
   - Add the "Firestore" node (Note: The node appears as "Firestore" in the UI rather than "Firestore Trigger")
   - Configure it to use Application Default Credentials (the emulator doesn't require real credentials)
   - Enter "n8n-nodes-firestore-trigger-test" as the Project ID
   - Set Operation to "Listen to Collection"
   - Enter "test-collection" as the collection path
   - Select all events (Added, Modified, Removed)
   - Save and activate the workflow

5. Simulate changes by running:
   ```bash
   pnpm run emulator:simulate
   ```

6. Check the n8n execution log to see the workflow being triggered

## Available Test Collections and Documents

The seed script creates the following test data:

1. `test-collection` with documents:
   - `doc1` - Has properties: name, value (100), active (true), createdAt
   - `doc2` - Has properties: name, value (200), active (false), createdAt

2. `test-listen` with document:
   - `listen-doc` - Has properties: status ('initial'), counter (0), updatedAt

## Testing Subcollection Support

The simulate-subcollection-changes.js script creates the following data structure for testing path patterns:

1. Static path test:
   - `users/static-user-123` - A user document
   - `users/static-user-123/orders/order-1` - An order document (will be modified then deleted)
   - `users/static-user-123/orders/order-2` - Another order document

2. Dynamic path pattern test:
   - `users/dynamic-user-1` through `users/dynamic-user-3` - Multiple user documents
   - Each user has two orders: `dynamic-order-1` and `dynamic-order-2`
   - `dynamic-user-2` will be deleted to test cleanup
   - `dynamic-user-4` will be added later to test new listener creation

## Testing Different Trigger Configurations

### Collection Listener

Configure the node with:
- Operation: Listen to Collection
- Collection: test-collection
- Events: Added, Modified, Removed

This will trigger the workflow whenever a document is added, modified, or removed in the test-collection.

### Document Listener

Configure the node with:
- Operation: Listen to Document
- Collection: test-listen
- Document ID: listen-doc

This will trigger the workflow whenever the specific document is modified.

### Query Filters

Configure the node with:
- Operation: Listen to Collection
- Collection: test-collection
- Under Options > Query Filters, add a filter:
  - Field: active
  - Operator: ==
  - Value: true

This will only trigger the workflow for documents where active=true (only doc1 in the initial seed data).

### Subcollection Path Pattern Listener

Configure the node with:
- Operation: Listen to Collection
- Collection Path: users/:userId/orders
- Events: Added, Modified, Removed

This will create dynamic listeners for the "orders" subcollection under any document in the "users" collection. The :userId parameter creates a pattern that matches any user document ID.

## Troubleshooting

- **Connection Issues**: Ensure the emulator is running on port 9099. Check if you can access http://localhost:4000 for the emulator UI.
- **No Events**: Make sure the `FIRESTORE_EMULATOR_HOST` environment variable is set to "localhost:9099".
- **Node Not Found**: Verify that the package is built (`pnpm build`) and linked correctly to your n8n instance.
- **Authentication Errors**: When using the emulator, use Application Default Credentials instead of Service Account JSON.
- **Subcollection Not Triggering**: For paths like "users/:userId/orders", ensure that the parent document exists first before creating the subcollection documents.

## Cleaning Up

1. Press Ctrl+C to stop the emulator
2. To stop all project-related processes:
   ```bash
   pkill -f "firebase emulators"
   ```

3. If needed, clear the emulator data:
   ```bash
   cd tests/emulator
   rm -rf .firebase/
   ```

## Notes on Emulator vs. Production

The emulator provides a way to test functionality without real Firebase costs or quotas, but there are some differences:

- Timestamps may behave slightly differently
- Some advanced security rules won't be enforced
- Performance characteristics will differ from production

For final validation, always test with a real Firebase project before deploying to production.

## Production Testing Results (May 12, 2025)

After completing emulator testing, the node was also tested with a real Firebase instance:

- ✅ Successfully connected to a real Firebase Firestore database
- ✅ Successfully listened to collection changes
- ✅ Successfully listened to document changes
- ✅ Correctly triggered workflows on document added events
- ✅ Correctly triggered workflows on document modified events
- ✅ Correctly triggered workflows on document removed events
- ✅ Successfully applied query filters
- ✅ Correctly handled metadata changes
- ✅ Properly implemented cleanup on workflow deactivation

All tests passed successfully, confirming that the node works correctly in both emulator and production environments. The node is now ready for release.
