import { ListenerManager } from '../../src/ListenerManager';
import { pathHandler } from '../../src/PathHandler';

// Mock the firebase-admin modules
jest.mock('firebase-admin/app');
jest.mock('firebase-admin/firestore');
jest.mock('firebase-admin');

describe('ListenerManager', () => {
  let listenerManager: ListenerManager;
  const mockFirebaseFirestore = require('firebase-admin/firestore');
  let firestoreMock: any;
  let onSnapshotMock: any;
  let mockUnsubscribe: any;
  let mockDoc: any;

  // Mock console methods to avoid cluttering test output
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    // Silence console during tests
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Reset all mocks
    jest.clearAllMocks();
    mockFirebaseFirestore.__resetMocks();
    
    // Get mock references
    firestoreMock = mockFirebaseFirestore.__getFirestoreMock();
    onSnapshotMock = mockFirebaseFirestore.__getOnSnapshotMock();
    mockUnsubscribe = mockFirebaseFirestore.__getMockUnsubscribe();
    mockDoc = mockFirebaseFirestore.__getMockDoc();
    
    // Create a new instance for each test
    listenerManager = new ListenerManager();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe('listener registration methods', () => {
    it('should create pattern listener key correctly', () => {
      const key = listenerManager.createPatternListenerKey('users/:userId/orders');
      expect(key).toBe('pattern:users/:userId/orders');
    });

    it('should create document listener key correctly', () => {
      const key = listenerManager.createDocumentListenerKey('users/123');
      expect(key).toBe('doc:users/123');
    });

    it('should register listeners and replace existing ones', () => {
      const unsubscribe1 = jest.fn();
      const unsubscribe2 = jest.fn();
      const key = 'doc:users/123';

      // Register first listener
      listenerManager.registerListener(key, unsubscribe1);
      
      // Get active listeners and verify
      const activeListeners = listenerManager.getActiveListeners();
      expect(activeListeners[key]).toBe(unsubscribe1);
      
      // Register second listener with same key - should replace first
      listenerManager.registerListener(key, unsubscribe2);
      
      // First unsubscribe should have been called
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      
      // Active listener should be updated
      expect(listenerManager.getActiveListeners()[key]).toBe(unsubscribe2);
    });

    it('should unregister listeners correctly', () => {
      const unsubscribe = jest.fn();
      const key = 'doc:users/123';
      
      // Register and then unregister
      listenerManager.registerListener(key, unsubscribe);
      listenerManager.unregisterListener(key);
      
      // Unsubscribe should have been called
      expect(unsubscribe).toHaveBeenCalledTimes(1);
      
      // Active listeners should not contain the key
      expect(listenerManager.getActiveListeners()[key]).toBeUndefined();
    });

    it('should register pattern listeners correctly', () => {
      const listener = jest.fn();
      const patternKey = 'pattern:users/:userId/orders';
      const docPath = 'users/123/orders';
      const parentKey = 'doc:users/123';
      
      listenerManager.registerPatternListener(patternKey, docPath, listener, parentKey);
      
      // Verify pattern listener was registered
      const patternListeners = listenerManager.getPatternListeners();
      expect(patternListeners[patternKey]).toBeDefined();
      expect(patternListeners[patternKey][docPath]).toBeDefined();
      expect(patternListeners[patternKey][docPath].listener).toBe(listener);
      expect(patternListeners[patternKey][docPath].parentListenerKey).toBe(parentKey);
    });

    it('should replace existing pattern listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const patternKey = 'pattern:users/:userId/orders';
      const docPath = 'users/123/orders';
      const parentKey = 'doc:users/123';
      
      // Register first listener
      listenerManager.registerPatternListener(patternKey, docPath, listener1, parentKey);
      
      // Register second listener with same key - should replace first
      listenerManager.registerPatternListener(patternKey, docPath, listener2, parentKey);
      
      // First listener should have been called
      expect(listener1).toHaveBeenCalledTimes(1);
      
      // Pattern listener should be updated
      expect(listenerManager.getPatternListeners()[patternKey][docPath].listener).toBe(listener2);
    });

    it('should unregister pattern listeners correctly', () => {
      const listener = jest.fn();
      const patternKey = 'pattern:users/:userId/orders';
      const docPath = 'users/123/orders';
      const parentKey = 'doc:users/123';
      
      // Register and then unregister
      listenerManager.registerPatternListener(patternKey, docPath, listener, parentKey);
      listenerManager.unregisterPatternListener(patternKey, docPath);
      
      // Listener should have been called
      expect(listener).toHaveBeenCalledTimes(1);
      
      // Pattern listener should be removed
      expect(listenerManager.getPatternListeners()[patternKey][docPath]).toBeUndefined();
    });
  });

  describe('cleanup methods', () => {
    it('should clean up all listeners correctly', () => {
      const unsubscribe1 = jest.fn();
      const unsubscribe2 = jest.fn();
      const listener = jest.fn();
      
      // Register regular listeners
      listenerManager.registerListener('doc:users/123', unsubscribe1);
      listenerManager.registerListener('doc:users/456', unsubscribe2);
      
      // Register pattern listener
      listenerManager.registerPatternListener(
        'pattern:users/:userId/orders',
        'users/123/orders',
        listener,
        'doc:users/123'
      );
      
      // Clean up all
      listenerManager.cleanupAll();
      
      // All unsubscribe functions should have been called
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(1);
      
      // All listeners should be removed
      expect(Object.keys(listenerManager.getActiveListeners()).length).toBe(0);
      expect(Object.keys(listenerManager.getPatternListeners()).length).toBe(0);
    });

    it('should clean up pattern listeners correctly', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const patternKey = 'pattern:users/:userId/orders';
      
      // Register pattern listeners
      listenerManager.registerPatternListener(
        patternKey,
        'users/123/orders',
        listener1,
        'doc:users/123'
      );
      
      listenerManager.registerPatternListener(
        patternKey,
        'users/456/orders',
        listener2,
        'doc:users/456'
      );
      
      // Clean up pattern
      listenerManager.cleanupPattern(patternKey);
      
      // All listeners should have been called
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      
      // Pattern should be removed
      expect(listenerManager.getPatternListeners()[patternKey]).toBeUndefined();
    });
  });

  describe('collection and document listeners', () => {
    it('should create collection listener correctly', () => {
      // Set up mock for testing
      const emitFn = jest.fn();
      const options = {
        events: ['added', 'modified'],
        includeMetadataChanges: true,
        emitFn
      };
      
      // Create collection listener
      const unsubscribeFn = listenerManager.createCollectionListener(
        firestoreMock,
        'users',
        options
      );
      
      // Verify Firestore method calls
      expect(firestoreMock.collection).toHaveBeenCalledWith('users');
      expect(onSnapshotMock).toHaveBeenCalled();
      // Check that the unsubscribe function is returned
      expect(unsubscribeFn).toBe(mockUnsubscribe);
      
      // Test event handling - simulate a snapshot
      const mockSnapshot = {
        docChanges: () => [
          {
            type: 'added',
            doc: {
              id: 'user1',
              data: () => ({ name: 'Test User' }),
              ref: { path: 'users/user1' },
              metadata: { hasPendingWrites: false, fromCache: false }
            }
          }
        ]
      };
      
      // Trigger the snapshot
      onSnapshotMock.simulateSnapshot(mockSnapshot);
      
      // Verify emit function was called
      expect(emitFn).toHaveBeenCalledTimes(1);
      expect(emitFn).toHaveBeenCalledWith([
        {
          json: expect.objectContaining({
            id: 'user1',
            data: { name: 'Test User' },
            changeType: 'added',
            path: 'users/user1'
          })
        }
      ]);
    });

    it('should create document listener correctly', () => {
      // Set up mock for testing
      const emitFn = jest.fn();
      const options = {
        includeMetadataChanges: true,
        emitFn
      };
      
      // Create document listener
      const unsubscribeFn = listenerManager.createDocumentListener(
        firestoreMock,
        'users',
        'user1',
        options
      );
      
      // Verify Firestore method calls
      expect(firestoreMock.collection).toHaveBeenCalledWith('users');
      expect(mockDoc).toHaveBeenCalledWith('user1');
      expect(onSnapshotMock).toHaveBeenCalled();
      expect(unsubscribeFn).toBe(mockUnsubscribe);
      
      // Test event handling - simulate a document snapshot
      const mockDocSnapshot = {
        id: 'user1',
        exists: true,
        data: () => ({ name: 'Test User' }),
        ref: { path: 'users/user1' },
        metadata: { hasPendingWrites: false, fromCache: false }
      };
      
      // Trigger the snapshot
      onSnapshotMock.simulateSnapshot(mockDocSnapshot);
      
      // Verify emit function was called
      expect(emitFn).toHaveBeenCalledTimes(1);
      expect(emitFn).toHaveBeenCalledWith([
        {
          json: expect.objectContaining({
            id: 'user1',
            data: { name: 'Test User' },
            exists: true,
            path: 'users/user1'
          })
        }
      ]);
    });

    it('should throw error for invalid collection path', () => {
      expect(() => {
        listenerManager.createCollectionListener(
          firestoreMock,
          '',
          {}
        );
      }).toThrow('Cannot set up listener: Collection path is empty');
    });

    it('should throw error for invalid document path or ID', () => {
      expect(() => {
        listenerManager.createDocumentListener(
          firestoreMock,
          '',
          'user1',
          {}
        );
      }).toThrow('Cannot set up listener: Collection path is empty');

      expect(() => {
        listenerManager.createDocumentListener(
          firestoreMock,
          'users',
          '',
          {}
        );
      }).toThrow('Cannot set up listener: Document ID is empty');
    });
  });

  describe('dynamic collection listeners', () => {
    // These tests are more complex and involve simulating Firebase interactions
    // We'll implement some basic tests here
    
    beforeEach(() => {
      // Mock necessary FirebaseService and PathHandler methods
      jest.spyOn(pathHandler, 'findFirstParameterParentPath').mockImplementation(
        (path) => {
          if (path === 'users/:userId/orders') return 'users';
          if (path === 'users/:userId') return 'users';
          return null;
        }
      );
      
      // Mock collection snapshot for testing
      firestoreMock.collection().get = jest.fn().mockResolvedValue({
        forEach: (callback: any) => {
          // Simulate 2 documents
          callback({
            id: 'user1',
            ref: { path: 'users/user1' },
            exists: true,
            data: () => ({ name: 'User 1' })
          });
          callback({
            id: 'user2',
            ref: { path: 'users/user2' },
            exists: true,
            data: () => ({ name: 'User 2' })
          });
        }
      });
    });
    
    it('should create dynamic listener for top-level collection pattern', async () => {
      // Create a dynamic listener for a pattern with a top-level collection
      await listenerManager.createDynamicListener(
        firestoreMock,
        'users/:userId/orders',
        { events: ['added', 'modified'] }
      );
      
      // Should have called collection once for the top-level 'users' collection
      expect(firestoreMock.collection).toHaveBeenCalledWith('users');
      
      // Should have registered pattern listeners for each document
      const patternListeners = listenerManager.getPatternListeners();
      const patternKey = 'pattern:users/:userId/orders';
      
      expect(patternListeners[patternKey]).toBeDefined();
      
      // Should have registered an onSnapshot listener for the collection
      expect(onSnapshotMock).toHaveBeenCalled();
      
      // Should have registered the collection listener
      const activeListeners = listenerManager.getActiveListeners();
      expect(activeListeners['doc:users']).toBeDefined();
    });
    
    it('should clean up dynamic listener correctly', async () => {
      // Set up the dynamic listener
      const cleanupFn = await listenerManager.createDynamicListener(
        firestoreMock,
        'users/:userId/orders',
        { events: ['added', 'modified'] }
      );
      
      // Call the cleanup function
      cleanupFn();
      
      // Should have cleaned up the pattern listeners effectively
      // Note: In our implementation, the pattern might still exist as an empty object
      const patternListeners = listenerManager.getPatternListeners();
      // Just check that no listeners remain within the pattern
      if (patternListeners['pattern:users/:userId/orders']) {
        expect(Object.keys(patternListeners['pattern:users/:userId/orders']).length).toBe(0);
      }
      
      // Should have cleaned up the collection listener
      const activeListeners = listenerManager.getActiveListeners();
      expect(activeListeners['doc:users']).toBeUndefined();
    });
  });
});