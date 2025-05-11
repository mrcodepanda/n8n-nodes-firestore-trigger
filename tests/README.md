# Firestore Trigger Node Tests

This directory contains tests for the n8n Firestore Trigger node.

## Test Structure

- `FirebaseAdminApi.credentials.test.ts` - Tests for the Firebase credentials
- `CollectionListener.test.ts` - Tests for the Firestore collection listener functionality
- `setup.ts` - Jest setup file with Firebase mocks
- `mocks/` - Directory containing mock implementations of Firebase modules
- `emulator/` - Firebase emulator configuration and test scripts

## Running Tests

### Unit Tests

Run all tests:
```
npm test
```

Run tests in watch mode:
```
npm run test:watch
```

### Collection Listener Tests

To test the collection listener functionality specifically:

1. Start the Firebase emulator:
   ```
   npm run emulator:start
   ```

2. In a separate terminal, run the collection listener test:
   ```
   npm run test:collection
   ```

### Document Listener Tests

To test the document listener functionality specifically:

1. Start the Firebase emulator:
   ```
   npm run emulator:start
   ```

2. In a separate terminal, run the document listener test:
   ```
   npm run test:document
   ```

### Manual Testing with Emulator

For manual testing with the Firebase emulator:

1. Start the Firebase emulator:
   ```
   npm run emulator:start
   ```

2. Seed the emulator with test data:
   ```
   npm run emulator:seed
   ```

3. Run the test script that uses the node:
   ```
   npm run emulator:test
   ```

4. Simulate Firestore changes:
   ```
   npm run emulator:simulate
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

### Mocks

The `mocks` directory contains mock implementations of Firebase modules to facilitate testing without requiring a real Firebase connection. Key mocks include:

- `firebase-admin.ts` - Mock for the firebase-admin module
- `firebase-admin-firestore.ts` - Mock for the firebase-admin/firestore module

## Adding New Tests

When adding new tests:

1. Use the existing test structure as a template
2. Update mocks if necessary to support new functionality
3. Add any new test scripts to package.json
