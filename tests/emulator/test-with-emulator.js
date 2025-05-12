/**
 * This script tests the Firestore Trigger node using the Firebase emulator.
 * It sets up a test environment that simulates the n8n execution context.
 */

const firebase = require('firebase-admin');
const { FirestoreTrigger } = require('../../dist/nodes/FirestoreTrigger/FirestoreTrigger.node');

// Configure and point to the Firebase emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:9099';

// Create a mock for the n8n hook functions
const mockHookFunctions = {
  getNodeParameter: (param, defaultValue) => {
    const parameters = {
      operation: 'listenToCollection',
      collection: 'test-collection',
      events: ['added', 'modified', 'removed'],
      options: {}
    };
    return parameters[param] || defaultValue;
  },
  getCredentials: async () => {
    return {
      projectId: 'n8n-nodes-firestore-trigger-test',
      authenticationMethod: 'applicationDefault',
    };
  },
  getWorkflowStaticData: () => {
    return {};
  },
  helpers: {
    returnJsonArray: (items) => items,
  },
  emit: (data) => {
    console.log('Emission received:', JSON.stringify(data, null, 2));
    return true;
  }
};

async function testFirestoreTrigger() {
  console.log('Testing Firestore Trigger node with emulator...');

  // Initialize the node
  const firestoreTrigger = new FirestoreTrigger();

  // Bind the mock functions to the trigger method
  const boundTrigger = firestoreTrigger.trigger.bind(mockHookFunctions);

  try {
    // Execute the trigger
    const response = await boundTrigger();

    console.log('Trigger response:', response);

    // Keep the process running to receive events
    console.log('Listening for Firestore events... (Ctrl+C to exit)');

    // If you want to test the manual trigger function
    console.log('Testing manual trigger...');
    const manualResult = await response.manualTriggerFunction();
    console.log('Manual trigger result:', manualResult);

    // Keep the process running
    process.stdin.resume();

    // Set up a clean exit handler
    process.on('SIGINT', () => {
      console.log('Closing the trigger...');
      if (response.closeFunction) {
        response.closeFunction();
      }
      process.exit(0);
    });
  } catch (error) {
    console.error('Error testing Firestore Trigger:', error);
    process.exit(1);
  }
}

// Execute the test if run directly
if (require.main === module) {
  testFirestoreTrigger();
}

module.exports = { testFirestoreTrigger };
