# Testing Firebase Admin API Credentials in n8n

This document provides step-by-step instructions for manually testing the Firebase Admin API credential fields in the n8n UI.

## Prerequisites

1. A running n8n instance with the Firestore Trigger node installed
2. A Firebase project with Firestore enabled
3. A Firebase service account key (JSON file) 

## Testing Steps

### 1. Prepare Firebase Credentials

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Project Settings > Service Accounts
4. Click "Generate new private key" to download a service account JSON file
5. Note your Firebase Project ID

### 2. Test Credential Creation

1. Open n8n and create a new workflow
2. Add the "Firestore Trigger" node to your workflow
3. In the node configuration, click the "Credentials" dropdown
4. Select "+ Create new" to create new credentials

### 3. Test Service Account Authentication Method

1. Set "Authentication Method" to "Service Account JSON"
2. Paste the entire content of your service account JSON file into the "Service Account Key JSON" field
3. Enter your Firebase Project ID in the "Project ID" field
4. Leave "Database ID" as "(default)" unless you're using a custom database ID
5. Click "Save" to create the credentials
6. Verify that no errors occur during saving

### 4. Test Application Default Credentials Method (Optional)

If you have application default credentials set up:

1. Create another credential set
2. Set "Authentication Method" to "Application Default Credentials"
3. Enter your Firebase Project ID
4. Save the credentials
5. Verify that no errors occur during saving

### 5. Test Credential Validation

1. Create another credential but leave "Service Account Key JSON" empty
2. Try to save the credentials
3. Verify that you see a validation error

### 6. Test Credential Selection

1. Return to the Firestore Trigger node
2. Select your newly created credentials from the dropdown
3. Verify that the node accepts the credentials without errors

### 7. Test Credential Usage

1. Configure the Firestore Trigger node to listen to a test collection
2. Test the node by clicking the "Test" button
3. Verify that the node can connect to Firebase using the provided credentials

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
