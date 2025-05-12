const firebase = require('firebase-admin');

// Configure the Firebase app with the emulator
firebase.initializeApp({
  projectId: 'n8n-nodes-firestore-trigger-test',
});

// Point to the Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:9099';

// Get Firestore instance
const db = firebase.firestore();

// Simulate changes to test the trigger node
async function simulateChanges() {
  console.log('Starting to simulate Firestore changes...');

  // Collection to use for testing
  const testCollection = db.collection('test-collection');

  // 1. Add a new document (tests 'added' event)
  console.log('Adding new document...');
  await testCollection.doc('doc3').set({
    name: 'Document 3',
    value: 300,
    active: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. Modify an existing document (tests 'modified' event)
  console.log('Modifying existing document...');
  await testCollection.doc('doc1').update({
    value: 150,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. Delete a document (tests 'removed' event)
  console.log('Deleting a document...');
  await testCollection.doc('doc2').delete();

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. Test document-specific listener
  console.log('Updating the listen document...');
  const listenDoc = db.collection('test-listen').doc('listen-doc');
  await listenDoc.update({
    status: 'updated',
    counter: firebase.firestore.FieldValue.increment(1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  console.log('Finished simulating changes.');
}

// Execute the simulation
simulateChanges()
  .then(() => {
    console.log('Successfully simulated Firestore changes.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error simulating Firestore changes:', error);
    process.exit(1);
  });
