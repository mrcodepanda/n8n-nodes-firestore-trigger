/**
 * Test fixtures for Firestore trigger tests
 * Provides standardized data objects for testing
 */

/**
 * Standard document data
 */
export const documentData = {
  basic: {
    id: 'test-doc-1',
    name: 'Test Document',
    value: 100,
    created: 'timestamp-value'
  },
  withNestedData: {
    id: 'test-doc-2',
    name: 'Nested Test',
    metadata: {
      createdBy: 'user123',
      tags: ['important', 'featured']
    },
    status: 'active'
  },
  withArrays: {
    id: 'test-doc-3',
    name: 'Array Test',
    items: [
      { id: 'item-1', quantity: 5 },
      { id: 'item-2', quantity: 10 }
    ],
    tags: ['test', 'fixture']
  }
};

/**
 * Document change events
 */
export const documentChanges = {
  added: {
    type: 'added',
    doc: {
      id: 'test-doc-1',
      data: () => documentData.basic,
      ref: { path: 'test-collection/test-doc-1' },
      metadata: {
        hasPendingWrites: false,
        fromCache: false
      }
    }
  },
  modified: {
    type: 'modified',
    doc: {
      id: 'test-doc-1',
      data: () => ({
        ...documentData.basic,
        value: 200, // Value changed
        updated: 'timestamp-value'
      }),
      ref: { path: 'test-collection/test-doc-1' },
      metadata: {
        hasPendingWrites: false,
        fromCache: false
      }
    }
  },
  removed: {
    type: 'removed',
    doc: {
      id: 'test-doc-1',
      data: () => documentData.basic,
      ref: { path: 'test-collection/test-doc-1' },
      metadata: {
        hasPendingWrites: false,
        fromCache: false
      }
    }
  }
};

/**
 * Collection snapshots
 */
export const collectionSnapshots = {
  empty: {
    docChanges: () => [],
    size: 0,
    empty: true,
    docs: []
  },
  singleDocAdded: {
    docChanges: () => [documentChanges.added],
    size: 1,
    empty: false,
    docs: [documentChanges.added.doc]
  },
  multipleChanges: {
    docChanges: () => [
      documentChanges.added,
      {
        type: 'added',
        doc: {
          id: 'test-doc-2',
          data: () => documentData.withNestedData,
          ref: { path: 'test-collection/test-doc-2' },
          metadata: {
            hasPendingWrites: false,
            fromCache: false
          }
        }
      }
    ],
    size: 2,
    empty: false,
    docs: [
      documentChanges.added.doc,
      {
        id: 'test-doc-2',
        data: () => documentData.withNestedData,
        ref: { path: 'test-collection/test-doc-2' },
        metadata: {
          hasPendingWrites: false,
          fromCache: false
        }
      }
    ]
  }
};

/**
 * Document snapshots
 */
export const documentSnapshots = {
  exists: {
    exists: true,
    data: () => documentData.basic,
    id: 'test-doc-1',
    ref: { path: 'test-collection/test-doc-1' },
    metadata: { hasPendingWrites: false, fromCache: false }
  },
  notExists: {
    exists: false,
    data: () => null,
    id: 'not-found-doc',
    ref: { path: 'test-collection/not-found-doc' },
    metadata: { hasPendingWrites: false, fromCache: false }
  },
  withNestedData: {
    exists: true,
    data: () => documentData.withNestedData,
    id: 'test-doc-2',
    ref: { path: 'test-collection/test-doc-2' },
    metadata: { hasPendingWrites: false, fromCache: false }
  }
};

/**
 * Error fixtures
 */
export const errors = {
  permissionDenied: new Error('PERMISSION_DENIED: Missing or insufficient permissions'),
  notFound: new Error('NOT_FOUND: Document not found'),
  invalidPath: new Error('INVALID_ARGUMENT: Invalid document path format'),
  serviceUnavailable: new Error('UNAVAILABLE: The service is currently unavailable'),
  cancelled: new Error('CANCELLED: The operation was cancelled')
};

/**
 * Path parameter fixtures
 */
export const paths = {
  static: {
    collection: 'users',
    document: 'users/user123',
    subcollection: 'users/user123/orders'
  },
  dynamic: {
    collection: 'users/:userId',
    document: 'users/:userId/profile',
    subcollection: 'users/:userId/orders/:orderId/items'
  },
  values: {
    userId: 'user123',
    orderId: 'order456',
    itemId: 'item789'
  },
  resolved: {
    collection: 'users/user123',
    subcollection: 'users/user123/orders/order456/items'
  }
};