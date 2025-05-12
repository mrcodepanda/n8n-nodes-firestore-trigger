/**
 * This script specifically tests the Firestore Collection Listener functionality
 * using the Firebase emulator.
 */

const firebase = require('firebase-admin');
const { FirestoreTrigger } = require('../../dist/nodes/FirestoreTrigger/FirestoreTrigger.node');

// Configure and point to the Firebase emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:9099';

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp({
    projectId: 'n8n-nodes-firestore-trigger-test',
  });
}

// Get Firestore instance
const db = firebase.firestore();

// Record all events received from the trigger
const receivedEvents = [];

// Create a mock for the n8n hook functions specifically for collection listening
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
    const staticData = {};
    return staticData;
  },
  helpers: {
    returnJsonArray: (items) => items,
  },
  emit: (data) => {
    console.log('Event received:', JSON.stringify(data, null, 2));
    try {
      if (data && data.length > 0 && data[0].length > 0 && data[0][0] && data[0][0].json) {
        const eventData = data[0][0].json;
        receivedEvents.push({
          type: eventData.changeType,
          docId: eventData.id,
          data: eventData.data,
          timestamp: new Date()
        });
      } else {
        console.log('Received data in unexpected format:', data);
      }
    } catch (error) {
      console.error('Error processing document change:', error);
    }
    return true;
  }
};

async function simulateCollectionChanges() {
  console.log('Simulating changes to test collection...');

  try {
    // Collection to use for testing
    const testCollection = db.collection('test-collection');

    // 1. Add a new document (tests 'added' event)
    console.log('Adding new document: doc-test-add...');
    await testCollection.doc('doc-test-add').set({
      name: 'Test Add Document',
      value: 100,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Modify the document we just added (tests 'modified' event)
    console.log('Modifying document: doc-test-add...');
    await testCollection.doc('doc-test-add').update({
      value: 150,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Add another document with different data
    console.log('Adding document with different value: doc-test-high-value...');
    await testCollection.doc('doc-test-high-value').set({
      name: 'High Value Document',
      value: 500,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Delete one of the documents (tests 'removed' event)
    console.log('Deleting document: doc-test-add...');
    await testCollection.doc('doc-test-add').delete();

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    return true;
  } catch (error) {
    console.error('Error simulating collection changes:', error);
    return false;
  }
}

async function testCollectionListener() {
  console.log('Testing Firestore Collection Listener with emulator...');

  let triggerNode;
  let triggerResponse;

  try {
    // Clear the existing data before we start
    await clearTestCollection();

    // Initialize the node
    const firestoreTrigger = new FirestoreTrigger();

    // Bind the mock functions to the trigger method
    const boundTrigger = firestoreTrigger.trigger.bind(mockHookFunctions);

    console.log('Starting collection listener...');

    // Execute the trigger to start listening
    triggerResponse = await boundTrigger();
    triggerNode = firestoreTrigger;

    console.log('Collection listener started.');

    // Simulate changes to the collection
    console.log('Simulating collection changes...');
    await simulateCollectionChanges();

    // Give some time for all events to be processed
    console.log('Waiting for all events to be processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify the events received
    console.log('\n--- EVENT VERIFICATION ---');
    console.log(`Total events received: ${receivedEvents.length}`);

    // Expect at least 4 events (add, modify, add, remove)
    if (receivedEvents.length >= 4) {
      console.log('✅ Received the expected number of events');
    } else {
      console.log('❌ Did not receive the expected number of events');
    }

    // Verify we received each type of event
    const addedEvents = receivedEvents.filter(e => e.type === 'added');
    const modifiedEvents = receivedEvents.filter(e => e.type === 'modified');
    const removedEvents = receivedEvents.filter(e => e.type === 'removed');

    console.log(`Added events: ${addedEvents.length}`);
    console.log(`Modified events: ${modifiedEvents.length}`);
    console.log(`Removed events: ${removedEvents.length}`);

    if (addedEvents.length >= 2) console.log('✅ Received "added" events');
    else console.log('❌ Missing "added" events');

    if (modifiedEvents.length >= 1) console.log('✅ Received "modified" events');
    else console.log('❌ Missing "modified" events');

    if (removedEvents.length >= 1) console.log('✅ Received "removed" events');
    else console.log('❌ Missing "removed" events');

    // Verify document content on events
    console.log('\n--- DOCUMENT CONTENT VERIFICATION ---');

    // Check for specific documents we know we added
    const docTestAdd = addedEvents.find(e => e.docId === 'doc-test-add');
    const docTestHighValue = addedEvents.find(e => e.docId === 'doc-test-high-value');

    if (docTestAdd) {
      console.log('✅ Correctly received "added" event for doc-test-add');
      console.log('   with value:', docTestAdd.data.value);
    } else {
      console.log('❌ Missing "added" event for doc-test-add');
    }

    if (docTestHighValue) {
      console.log('✅ Correctly received "added" event for doc-test-high-value');
      console.log('   with value:', docTestHighValue.data.value);
    } else {
      console.log('❌ Missing "added" event for doc-test-high-value');
    }

    // Check if we got the modification event for doc-test-add
    const modifiedDoc = modifiedEvents.find(e => e.docId === 'doc-test-add');
    if (modifiedDoc && modifiedDoc.data.value === 150) {
      console.log('✅ Correctly received "modified" event with updated value 150');
    } else {
      console.log('❌ Missing or incorrect "modified" event for value update');
    }

    // Check if we got the removal event for doc-test-add
    const removedDoc = removedEvents.find(e => e.docId === 'doc-test-add');
    if (removedDoc) {
      console.log('✅ Correctly received "removed" event for doc-test-add');
    } else {
      console.log('❌ Missing "removed" event for doc-test-add');
    }

    return {
      success: receivedEvents.length >= 4,
      events: receivedEvents
    };
  } catch (error) {
    console.error('Error testing collection listener:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Clean up
    console.log('\nCleaning up...');
    if (triggerResponse && triggerResponse.closeFunction) {
      triggerResponse.closeFunction();
      console.log('Closed listener');
    }

    // Clean up test collection
    await clearTestCollection();
  }
}

async function clearTestCollection() {
  console.log('Clearing test collection...');

  try {
    const testCollection = db.collection('test-collection');
    const snapshot = await testCollection.get();

    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Cleared ${snapshot.size} documents from test collection`);
    return true;
  } catch (error) {
    console.error('Error clearing test collection:', error);
    return false;
  }
}

// Main execution
if (require.main === module) {
  testCollectionListener()
    .then(result => {
      console.log('\nTest result:', result.success ? 'SUCCESS' : 'FAILURE');

      if (!result.success && result.error) {
        console.error('Error:', result.error);
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testCollectionListener };
