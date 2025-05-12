const firebase = require('firebase-admin');

// Configure the Firebase app with the emulator
firebase.initializeApp({
  projectId: 'n8n-nodes-firestore-trigger-test',
});

// Point to the Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:9099';

// Get Firestore instance
const db = firebase.firestore();

async function seedData() {
  console.log('Seeding Firestore emulator with test data...');

  // Create a test collection
  const testCollection = db.collection('test-collection');

  // Add some initial documents
  await testCollection.doc('doc1').set({
    name: 'Document 1',
    value: 100,
    active: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await testCollection.doc('doc2').set({
    name: 'Document 2',
    value: 200,
    active: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Create a test document to listen to specific changes
  const listenDoc = db.collection('test-listen').doc('listen-doc');
  await listenDoc.set({
    status: 'initial',
    counter: 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  console.log('Finished seeding data.');
}

// Execute the seeding
seedData()
  .then(() => {
    console.log('Successfully seeded Firestore emulator.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error seeding Firestore emulator:', error);
    process.exit(1);
  });
