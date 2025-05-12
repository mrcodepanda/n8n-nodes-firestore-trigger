# Testing Firebase Admin API Credentials in n8n

This document provides step-by-step instructions for manually testing the Firebase Admin API credential fields in the n8n UI.

## Prerequisites

1. A running n8n instance with the Firestore Trigger node installed
2. A Firebase project with Firestore enabled
3. A Firebase service account key (JSON file) 

## Testing Status

✅ **PASSED (May 12, 2025)**: Successfully tested all credential methods with a real Firebase instance.

All credential configurations have been successfully validated with a real Firebase Firestore instance. The node can properly authenticate and establish connections for both collection and document listeners.

## Testing Steps

### 1. Prepare Firebase Credentials

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Navigate to Project Settings > Service Accounts
4. Click "Generate new private key" to download a service account JSON file
5. Save the downloaded JSON file for use with the node
6. Note your Firebase Project ID from the project settings page

### 2. Install and Link the Package

1. Build the package:
   ```bash
   cd /home/saggarwal/projects/n8n-firestore-trigger
   pnpm build
   ```

2. Link the package to your local n8n instance:
   ```bash
   cd /home/saggarwal/projects/n8n-firestore-trigger
   pnpm link --global
   
   cd ~/.n8n/custom
   pnpm link --global n8n-nodes-firestore-trigger
   ```

3. Restart your n8n instance:
   ```bash
   n8n start
   ```

### 3. Test Credential Creation

1. Open your n8n instance in a web browser
2. Create a new workflow
3. Add the "Firestore Trigger" node to your workflow
4. In the node configuration, click the "Credentials" dropdown
5. Select "+ Create new" to create new credentials

### 4. Test Service Account Authentication Method

1. Set "Authentication Method" to "Service Account JSON"
2. Open the downloaded service account JSON file in a text editor
3. Copy the entire content of the file
4. Paste the JSON content into the "Service Account Key JSON" field
5. Enter your Firebase Project ID in the "Project ID" field
6. Leave "Database ID" as "(default)" unless you're using a custom database ID
7. Click "Save" to create the credentials
8. Verify that no errors occur during saving

### 5. Test Application Default Credentials Method (Optional)

If you have application default credentials set up:

1. Create another credential set
2. Set "Authentication Method" to "Application Default Credentials"
3. Enter your Firebase Project ID
4. Save the credentials
5. Verify that no errors occur during saving

### 6. Test Credential Validation

1. Create another credential but intentionally leave "Service Account Key JSON" empty
2. Try to save the credentials
3. Verify that you see a validation error for the required field

### 7. Test Credential Usage

1. Return to the Firestore Trigger node (Note: The node appears as "Firestore" in the n8n UI rather than "Firestore Trigger")
2. Select your newly created credentials from the dropdown
3. Configure the node:
   - Operation: "Listen to Collection"
   - Collection: Enter a collection name from your Firestore database (e.g., "users")
   - Events: Select "Added", "Modified", and "Removed"
4. Click "Done" to save the node configuration
5. Save the workflow and toggle the "Active" switch to activate it
6. Verify that the node shows as connected with no errors

## Reporting Issues

If you encounter any issues with the credential fields:

1. Check that your Firebase service account has appropriate permissions
2. Verify that your service account JSON is properly formatted
3. Check if there are any error messages in the n8n console
4. Take screenshots of any error messages
5. Document the steps to reproduce the issue

## Expected Behavior

- All credential fields should appear properly formatted
- Required fields should be marked with an asterisk
- Service Account JSON field should only appear when "Service Account JSON" authentication method is selected
- Validation should prevent saving credentials with empty required fields
- The node should successfully connect to Firebase when valid credentials are provided

## Test Results (May 12, 2025)

- ✅ Successfully tested Service Account authentication
- ✅ Successfully tested Application Default Credentials
- ✅ Verified proper validation of required fields
- ✅ Confirmed UI correctly shows/hides fields based on authentication method
- ✅ Successfully connected to Firebase with both authentication methods
- ✅ Triggered workflows using the credentials with a real Firebase instance

All credential tests passed successfully, confirming that the credential implementation is working correctly with real Firebase instances.
