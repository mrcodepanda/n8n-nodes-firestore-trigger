#!/bin/bash

# Ensure the script fails if any command fails
set -e

echo "==== Starting Firestore Subcollection Listener Test ===="

# Check if emulator is already running
if ! curl -s "http://localhost:9099/" > /dev/null; then
  echo "Starting Firebase Emulator..."
  # Start emulator in background
  cd tests/emulator
  firebase emulators:start &
  EMULATOR_PID=$!
  cd ../..

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

# Run the unit tests
echo "Running subcollection tests..."
pnpm jest tests/SubcollectionListener.test.ts
UNIT_TEST_RESULT=$?

if [ $UNIT_TEST_RESULT -ne 0 ]; then
  echo "❌ Unit tests failed!"

  # Clean up
  if [ "$STARTED_EMULATOR" = true ]; then
    echo "Stopping Firebase Emulator..."
    kill $EMULATOR_PID
  fi

  exit $UNIT_TEST_RESULT
fi

# Run the simulation
echo "Running subcollection simulation..."
node tests/emulator/simulate-subcollection-changes.js
SIMULATION_RESULT=$?

# Clean up
if [ "$STARTED_EMULATOR" = true ]; then
  echo "Stopping Firebase Emulator..."
  kill $EMULATOR_PID
fi

echo "==== Subcollection Listener Test Completed ===="
exit $SIMULATION_RESULT
