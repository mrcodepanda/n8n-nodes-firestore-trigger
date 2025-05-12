#!/bin/bash

# Helper script to set up and start the Firebase emulator for testing

echo "Setting up Firebase emulator for testing the n8n-nodes-firestore-trigger node..."

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null
then
    echo "Firebase CLI is not installed. Please install it with:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Navigate to the emulator directory
cd "$(dirname "$0")"

# Initialize firebase if .firebaserc doesn't exist
if [ ! -f ".firebaserc" ]; then
    echo "Initializing Firebase project for emulator..."
    echo '{
  "projects": {
    "default": "n8n-nodes-firestore-trigger-test"
  }
}' > .firebaserc
fi

# Start the emulator
echo "Starting Firebase emulator..."
firebase emulators:start --only firestore

# Note: The script will stay running with the emulator. Use Ctrl+C to stop.
