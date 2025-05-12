const firebase = require('firebase-admin');

// Initialize Firebase with emulator settings
firebase.initializeApp({
  projectId: 'n8n-nodes-firestore-trigger-test',
});

const db = firebase.firestore();
db.settings({
  host: 'localhost:9099',
  ssl: false,
});

/**
 * Simulates changes to demonstrate subcollection trigger functionality
 */
async function simulateSubcollectionChanges() {
  console.log('🔄 Starting subcollection changes simulation...');

  // Create a parent document to test static parent paths
  const staticUserId = 'static-user-123';
  console.log(`Creating static user: ${staticUserId}`);
  await db.collection('users').doc(staticUserId).set({
    name: 'Static User',
    email: 'static@example.com',
  });

  // Create some orders for the static user
  console.log(`Creating orders for static user: ${staticUserId}`);
  const orderRef1 = db.collection('users').doc(staticUserId).collection('orders').doc('order-1');
  await orderRef1.set({
    orderId: 'order-1',
    total: 100.50,
    items: 3,
    created: new Date(),
  });

  console.log('Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Modify the order
  console.log(`Modifying order: order-1`);
  await orderRef1.update({
    total: 150.75,
    items: 5,
    updated: new Date(),
  });

  console.log('Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Create another order
  console.log(`Creating another order: order-2`);
  const orderRef2 = db.collection('users').doc(staticUserId).collection('orders').doc('order-2');
  await orderRef2.set({
    orderId: 'order-2',
    total: 75.25,
    items: 2,
    created: new Date(),
  });

  console.log('Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Delete the first order
  console.log(`Deleting order: order-1`);
  await orderRef1.delete();

  console.log('Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test dynamic path pattern - Create new users
  console.log('Creating dynamic users to test path patterns...');
  for (let i = 1; i <= 3; i++) {
    const userId = `dynamic-user-${i}`;
    console.log(`Creating user: ${userId}`);
    await db.collection('users').doc(userId).set({
      name: `Dynamic User ${i}`,
      email: `dynamic${i}@example.com`,
    });

    console.log('Waiting 1 second...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Add orders to the dynamic users
  for (let i = 1; i <= 3; i++) {
    const userId = `dynamic-user-${i}`;
    console.log(`Creating orders for user: ${userId}`);

    for (let j = 1; j <= 2; j++) {
      const orderId = `dynamic-order-${j}`;
      console.log(`Creating order: ${orderId} for user: ${userId}`);
      await db.collection('users').doc(userId).collection('orders').doc(orderId).set({
        orderId,
        total: 50.0 * j,
        items: j,
        created: new Date(),
      });

      console.log('Waiting 1 second...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Delete a dynamic user (should clean up order listeners)
  console.log('Deleting dynamic-user-2...');
  await db.collection('users').doc('dynamic-user-2').delete();

  console.log('Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Add a new dynamic user after deletion
  console.log('Creating dynamic-user-4 after deletion...');
  await db.collection('users').doc('dynamic-user-4').set({
    name: 'Dynamic User 4',
    email: 'dynamic4@example.com',
  });

  console.log('Waiting 1 second...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Add orders to the new user
  console.log('Creating orders for dynamic-user-4...');
  await db.collection('users').doc('dynamic-user-4').collection('orders').doc('dynamic-order-1').set({
    orderId: 'dynamic-order-1',
    total: 200.0,
    items: 4,
    created: new Date(),
  });

  console.log('✅ Subcollection changes simulation completed!');
}

// Run the simulation
simulateSubcollectionChanges().catch(error => {
  console.error('❌ Error during simulation:', error);
  process.exit(1);
}).finally(() => {
  // Ensure the process exits after simulation
  setTimeout(() => process.exit(0), 1000);
});
