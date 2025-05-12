# Firestore Trigger Node Tests

This directory contains tests for the n8n Firestore Trigger node.

## Test Status

✅ **COMPLETED (May 11, 2025)**: All automated tests passed successfully.
✅ **COMPLETED (May 12, 2025)**: Additionally validated with a real Firebase instance.

The node has been thoroughly tested using both automated tests with the Firebase emulator and manual testing with a real Firebase instance. All tests have passed successfully, confirming that the node works as expected in both environments.

## Test Structure

The tests are organized into the following files:

- `FirebaseAdminApi.credentials.test.ts` - Tests for the Firebase credentials
- `CollectionListener.test.ts` - Tests for the Firestore collection listener functionality
- `DocumentListener.test.ts` - Tests for the Firestore document listener functionality
- `SubcollectionListener.test.ts` - Tests for the subcollection path pattern functionality
- `setup.ts` - Jest setup file with Firebase mocks
- `mocks/` - Directory containing mock implementations of Firebase modules
- `emulator/` - Firebase emulator configuration and test scripts

## Running Tests

### Unit Tests

Run all Jest tests:
```bash
cd /home/saggarwal/projects/n8n-firestore-trigger
pnpm test
```

Run tests in watch mode (for development):
```bash
pnpm run test:watch
```

### Emulator-Based Tests

The project includes shell scripts to run tests with the Firebase emulator:

#### Collection Listener Tests

Test the collection listener functionality:
```bash
pnpm run test:collection
```

This script:
- Starts the Firebase emulator if not running
- Builds the project
- Runs test-collection-listener.js
- Cleans up after completion

#### Document Listener Tests

Test the document listener functionality:
```bash
pnpm run test:document
```

This script:
- Starts the Firebase emulator if not running
- Builds the project
- Runs test-document-listener.js
- Cleans up after completion

#### Subcollection Listener Tests

Test the subcollection path pattern functionality:
```bash
pnpm run test:subcollection
```

This script:
- Starts the Firebase emulator if not running
- Builds the project
- Runs the Jest tests for SubcollectionListener.test.ts
- Runs simulate-subcollection-changes.js to test with dynamic data
- Cleans up after completion

### Manual Testing with Emulator

For manual testing with the Firebase emulator:

1. Start the Firebase emulator:
   ```bash
   pnpm run emulator:start
   ```

2. Seed the emulator with test data:
   ```bash
   pnpm run emulator:seed
   ```

3. Run the manual test script:
   ```bash
   pnpm run emulator:test
   ```

4. Simulate Firestore changes in a separate terminal:
   ```bash
   pnpm run emulator:simulate
   ```

   Or for subcollection tests:
   ```bash
   pnpm run emulator:simulate:subcollection
   ```

## Test Files

### CollectionListener.test.ts

This file tests the functionality of the Firestore collection listener. It verifies:

- Node initialization with correct parameters
- Manual trigger functionality
- Event type filtering (added, modified, removed)
- Query filters
- Resource cleanup

### DocumentListener.test.ts

This file tests the functionality of the Firestore document listener. It verifies:

- Node initialization with correct parameters for document listeners
- Document change detection and proper data emission
- Handling of document deletions
- Handling of metadata changes
- Error handling within the document listener
- Resource cleanup
- Support for custom database IDs

### SubcollectionListener.test.ts

This file tests the subcollection path pattern functionality. It verifies:

- Parsing of collection paths with pattern segments (e.g., "users/:userId/orders")
- Creation of dynamic listeners for matching documents
- Proper event handling for nested collections
- Cleanup of listeners when parent documents are deleted
- Handling of deep nesting paths

### Mocks

The `mocks` directory contains mock implementations of Firebase modules to facilitate testing without requiring a real Firebase connection. Key mocks include:

- `firebase-admin.ts` - Mock for the firebase-admin module
- `firebase-admin-firestore.ts` - Mock for the firebase-admin/firestore module
- `firestore-snapshot.ts` - Mock for Firestore DocumentSnapshot and QuerySnapshot

### Emulator Test Scripts

The `emulator` directory contains scripts for testing with the Firebase emulator:

- `setup-emulator.sh` - Script to set up and start the Firebase emulator
- `seed-data.js` - Script to seed the emulator with test data
- `test-collection-listener.js` - Script to test collection listener functionality
- `test-document-listener.js` - Script to test document listener functionality
- `simulate-changes.js` - Script to simulate Firestore changes for testing
- `simulate-subcollection-changes.js` - Script to simulate changes to test subcollection support

## Adding New Tests

When adding new tests:

1. Use the existing test structure as a template
2. Update mocks if necessary to support new functionality
3. Add any new test scripts to package.json

## Integration with n8n

To test the node with your local n8n instance:

1. Build the package:
   ```bash
   cd /home/saggarwal/projects/n8n-firestore-trigger
   pnpm build
   ```

2. Link the package globally:
   ```bash
   pnpm link --global
   ```

3. Navigate to your n8n custom directory:
   ```bash
   cd ~/.n8n/custom
   ```

4. Link the global package:
   ```bash
   pnpm link --global n8n-nodes-firestore-trigger
   ```

5. For emulator testing, set the environment variable:
   ```bash
   export FIRESTORE_EMULATOR_HOST=localhost:9099
   ```

6. Start n8n:
   ```bash
   n8n start
   ```

7. Create a workflow with the "Firestore" node (Note: The node appears as "Firestore" in the n8n UI rather than "Firestore Trigger") and configure it as needed

## Real Firebase Instance Testing (May 12, 2025)

### Connection Steps

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/)
2. Generate a service account key from Project Settings > Service Accounts
3. Save the key file securely
4. Set up the Firestore Trigger node with:
   - Authentication Method: Service Account JSON
   - Paste the service account JSON
   - Project ID: Your Firebase project ID

### Test Procedure

1. Configure the node to listen to a collection or document
2. Activate the workflow
3. Make changes to your Firestore database:
   - Add new documents
   - Modify existing documents
   - Delete documents
4. Verify that workflows are triggered correctly for each change type
