#!/bin/bash

# This script runs the collection listener tests

echo "Running Firestore Collection Listener tests..."

# Make sure firebase emulator is running
if ! curl -s http://localhost:8001 > /dev/null; then
  echo "Firebase emulator doesn't appear to be running."
  echo "Please start it with: npm run emulator:start"
  exit 1
fi

# Run the Jest test for CollectionListener
npx jest tests/CollectionListener.test.ts --runInBand --detectOpenHandles

# Show completion status
if [ $? -eq 0 ]; then
  echo "✅ Collection listener tests passed successfully!"
else
  echo "❌ Collection listener tests failed."
  exit 1
fi
