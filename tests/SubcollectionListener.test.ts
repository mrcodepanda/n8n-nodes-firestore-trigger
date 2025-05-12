import { 
  parsePath, 
  findFirstParameterParentPath, 
  resolvePath, 
  getParentDocumentPath,
  validateCollectionPath
} from '../nodes/FirestoreTrigger/GenericFunctions';

describe('Subcollection Support Functions', () => {
  describe('parsePath', () => {
    it('should correctly parse a simple collection path', () => {
      const result = parsePath('users');
      
      expect(result.segments.length).toBe(1);
      expect(result.segments[0].value).toBe('users');
      expect(result.segments[0].isParameter).toBe(false);
      expect(result.isCollection).toBe(true);
      expect(result.hasParameters).toBe(false);
      expect(result.parameterNames).toEqual([]);
    });
    
    it('should correctly parse a document path', () => {
      const result = parsePath('users/user123');
      
      expect(result.segments.length).toBe(2);
      expect(result.segments[0].value).toBe('users');
      expect(result.segments[0].isParameter).toBe(false);
      expect(result.segments[1].value).toBe('user123');
      expect(result.segments[1].isParameter).toBe(false);
      expect(result.isCollection).toBe(false);
      expect(result.hasParameters).toBe(false);
      expect(result.parameterNames).toEqual([]);
    });
    
    it('should correctly parse a path with parameters', () => {
      const result = parsePath('users/:userId/orders');
      
      expect(result.segments.length).toBe(3);
      expect(result.segments[0].value).toBe('users');
      expect(result.segments[0].isParameter).toBe(false);
      expect(result.segments[1].value).toBe(':userId');
      expect(result.segments[1].isParameter).toBe(true);
      expect(result.segments[1].paramName).toBe('userId');
      expect(result.segments[2].value).toBe('orders');
      expect(result.segments[2].isParameter).toBe(false);
      expect(result.isCollection).toBe(true);
      expect(result.hasParameters).toBe(true);
      expect(result.parameterNames).toEqual(['userId']);
    });
    
    it('should correctly parse a complex path with multiple parameters', () => {
      const result = parsePath('users/:userId/orders/:orderId/items');
      
      expect(result.segments.length).toBe(5);
      expect(result.segments[0].value).toBe('users');
      expect(result.segments[0].isParameter).toBe(false);
      expect(result.segments[1].value).toBe(':userId');
      expect(result.segments[1].isParameter).toBe(true);
      expect(result.segments[1].paramName).toBe('userId');
      expect(result.segments[2].value).toBe('orders');
      expect(result.segments[2].isParameter).toBe(false);
      expect(result.segments[3].value).toBe(':orderId');
      expect(result.segments[3].isParameter).toBe(true);
      expect(result.segments[3].paramName).toBe('orderId');
      expect(result.segments[4].value).toBe('items');
      expect(result.segments[4].isParameter).toBe(false);
      expect(result.isCollection).toBe(true);
      expect(result.hasParameters).toBe(true);
      expect(result.parameterNames).toEqual(['userId', 'orderId']);
    });
  });
  
  describe('findFirstParameterParentPath', () => {
    it('should return null for a path without parameters', () => {
      const result = findFirstParameterParentPath('users/user123/orders');
      expect(result).toBeNull();
    });
    
    it('should return the parent path for a path with parameters', () => {
      const result = findFirstParameterParentPath('users/:userId/orders');
      expect(result).toBe('users');
    });
    
    it('should handle parameters in the middle of the path', () => {
      const result = findFirstParameterParentPath('chats/:chatId/messages/:messageId');
      expect(result).toBe('chats');
    });
    
    it('should return null if the parameter is the first segment', () => {
      const result = findFirstParameterParentPath(':collection/documents');
      expect(result).toBeNull();
    });
  });
  
  describe('resolvePath', () => {
    it('should resolve a simple path with one parameter', () => {
      const result = resolvePath('users/:userId/orders', { userId: '123' });
      expect(result).toBe('users/123/orders');
    });
    
    it('should resolve a complex path with multiple parameters', () => {
      const result = resolvePath('users/:userId/orders/:orderId/items', { 
        userId: '123', 
        orderId: '456' 
      });
      expect(result).toBe('users/123/orders/456/items');
    });
    
    it('should throw an error if a parameter value is missing', () => {
      expect(() => {
        resolvePath('users/:userId/orders', {});
      }).toThrow('Missing value for parameter "userId"');
    });
  });
  
  describe('getParentDocumentPath', () => {
    it('should return null for a top-level collection', () => {
      const result = getParentDocumentPath('users');
      expect(result).toBeNull();
    });
    
    it('should return the parent document path for a subcollection', () => {
      const result = getParentDocumentPath('users/123/orders');
      expect(result).toBe('users/123');
    });
    
    it('should work for deeply nested collections', () => {
      const result = getParentDocumentPath('users/123/orders/456/items');
      expect(result).toBe('users/123/orders/456');
    });
  });
  
  describe('validateCollectionPath', () => {
    it('should validate a top-level collection', () => {
      expect(validateCollectionPath('users')).toBe(true);
    });
    
    it('should validate a subcollection', () => {
      expect(validateCollectionPath('users/123/orders')).toBe(true);
    });
    
    it('should validate a deeply nested collection', () => {
      expect(validateCollectionPath('users/123/orders/456/items')).toBe(true);
    });
    
    it('should fail for a document path', () => {
      expect(validateCollectionPath('users/123')).toBe(false);
    });
    
    it('should handle empty paths', () => {
      expect(validateCollectionPath('')).toBe(false);
    });
  });
});
