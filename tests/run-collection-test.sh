#!/bin/bash

# Ensure the script fails if any command fails
set -e

echo "==== Starting Firestore Collection Listener Test ===="

# Check if emulator is already running
if ! curl -s "http://localhost:9099/" > /dev/null; then
  echo "Starting Firebase Emulator..."
  # Start emulator in background
  firebase emulators:start --only firestore &
  EMULATOR_PID=$!

  # Wait for emulator to start
  echo "Waiting for emulator to start..."
  sleep 5

  # Flag to know we started the emulator (to stop it later)
  STARTED_EMULATOR=true
else
  echo "Firebase Emulator already running."
  STARTED_EMULATOR=false
fi

# Build the project
echo "Building project..."
cd "$(dirname "$0")/.."
pnpm build

# Run the test
echo "Running collection listener test..."
node tests/emulator/test-collection-listener.js
TEST_RESULT=$?

# Clean up
if [ "$STARTED_EMULATOR" = true ]; then
  echo "Stopping Firebase Emulator..."
  kill $EMULATOR_PID
fi

echo "==== Collection Listener Test Completed ===="
exit $TEST_RESULT
