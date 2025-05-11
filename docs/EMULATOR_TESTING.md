# Firestore Emulator Testing Guide

This guide explains how to use the Firebase emulator to test the n8n-firestore-trigger node without requiring a real Firebase project.

## Prerequisites

- Node.js (v18+)
- npm or pnpm
- Firebase CLI (`npm install -g firebase-tools`)

## Setting Up the Emulator

1. Navigate to the emulator directory:
   ```bash
   cd tests/emulator
   ```

2. Run the setup script to start the emulator:
   ```bash
   chmod +x setup-emulator.sh
   ./setup-emulator.sh
   ```

   This script will:
   - Check if Firebase CLI is installed
   - Create a local Firebase project configuration
   - Start the Firestore emulator on port 8001
   - Start the Emulator UI on port 4000

3. Once the emulator is running, open a new terminal window and seed it with test data:
   ```bash
   cd tests/emulator
   node seed-data.js
   ```

## Testing the Trigger Node

There are two ways to test the trigger node with the emulator:

### Method 1: Using the Test Script

1. Build the node package:
   ```bash
   cd /home/saggarwal/projects/n8n-firestore-trigger
   npm run build
   ```

2. Run the test script:
   ```bash
   cd tests/emulator
   node test-with-emulator.js
   ```

   This script:
   - Configures the node to use the emulator
   - Creates a mock n8n environment
   - Initializes the trigger node
   - Listens for events

3. In another terminal, simulate Firestore changes:
   ```bash
   cd tests/emulator
   node simulate-changes.js
   ```

4. Watch the output in the test script terminal to see events being triggered

### Method 2: Testing with n8n

1. Link your package to n8n:
   ```bash
   cd /home/saggarwal/projects/n8n-firestore-trigger
   npm link
   cd ~/.n8n/custom
   npm link n8n-nodes-firestore-trigger
   ```

2. Set the emulator environment variable for n8n:
   ```bash
   export FIRESTORE_EMULATOR_HOST=localhost:8001
   ```

3. Start n8n:
   ```bash
   n8n start
   ```

4. In n8n:
   - Create a new workflow
   - Add the Firestore Trigger node
   - Configure it to listen to the `test-collection` collection
   - Save and activate the workflow

5. Simulate changes as described above and watch the workflow executions

## Available Test Collections

The seed script creates the following test data:

1. `test-collection` with documents:
   - `doc1` - For testing modifications
   - `doc2` - For testing deletions

2. `test-listen` with document:
   - `listen-doc` - For testing document-specific triggers

## Testing Different Trigger Configurations

### Collection Listener

Configure the node with:
- Operation: Listen to Collection
- Collection: test-collection
- Events: Added, Modified, Removed

### Document Listener

Configure the node with:
- Operation: Listen to Document
- Collection: test-listen
- Document ID: listen-doc

### Query Filters

Configure the node with:
- Operation: Listen to Collection
- Collection: test-collection
- Add a filter under Options:
  - Field: active
  - Operator: ==
  - Value: true

## Troubleshooting

- **Connection Issues**: Ensure the emulator is running on port 8001
- **No Events**: Check that the `FIRESTORE_EMULATOR_HOST` environment variable is set
- **Node Not Found**: Verify that the package is built and linked correctly
- **Authentication Errors**: Use Application Default Credentials with the emulator

## Cleaning Up

1. Press Ctrl+C to stop the emulator
2. If needed, clear the emulator data:
   ```bash
   firebase emulators:start --only firestore --export-on-exit=./data
   ```

## Notes on Emulator vs. Production

The emulator provides a way to test functionality without real Firebase costs or quotas, but there are some differences:

- Timestamps may behave slightly differently
- Some advanced security rules won't be enforced
- Performance characteristics will differ from production

For final validation, always test with a real Firebase project before deploying to production.
