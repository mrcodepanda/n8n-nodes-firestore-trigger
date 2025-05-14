import { PathHandler } from '../../src/PathHandler';

/**
 * Test suite for Subcollection Support Functions
 * These tests validate the utility functions used for handling 
 * subcollection paths and path parameters using the PathHandler class
 */
describe('Subcollection Support Functions', () => {
  let pathHandler: PathHandler;

  beforeEach(() => {
    pathHandler = new PathHandler();
  });

  /**
   * Tests for parsePath function
   * This function analyzes path structure and identifies parameters
   */
  describe('parsePath', () => {
    it('should correctly parse a simple collection path', () => {
      const result = pathHandler.parsePath('users');
      
      expect(result.segments.length).toBe(1);
      expect(result.segments[0].value).toBe('users');
      expect(result.segments[0].isParameter).toBe(false);
      expect(result.isCollection).toBe(true);
      expect(result.hasParameters).toBe(false);
      expect(result.parameterNames).toEqual([]);
    });
    
    it('should correctly parse a document path', () => {
      const result = pathHandler.parsePath('users/user123');
      
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
      const result = pathHandler.parsePath('users/:userId/orders');
      
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
      const result = pathHandler.parsePath('users/:userId/orders/:orderId/items');
      
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
  
  /**
   * Tests for findFirstParameterParentPath function
   * This function finds the parent path of the first parameter in a path
   */
  describe('findFirstParameterParentPath', () => {
    it('should return null for a path without parameters', () => {
      const result = pathHandler.findFirstParameterParentPath('users/user123/orders');
      expect(result).toBeNull();
    });
    
    it('should return the parent path for a path with parameters', () => {
      const result = pathHandler.findFirstParameterParentPath('users/:userId/orders');
      expect(result).toBe('users');
    });
    
    it('should handle parameters in the middle of the path', () => {
      const result = pathHandler.findFirstParameterParentPath('chats/:chatId/messages/:messageId');
      expect(result).toBe('chats');
    });
    
    it('should return null if the parameter is the first segment', () => {
      const result = pathHandler.findFirstParameterParentPath(':collection/documents');
      expect(result).toBeNull();
    });
  });
  
  /**
   * Tests for resolvePattern function
   * This function replaces path parameters with actual values
   */
  describe('resolvePattern', () => {
    it('should resolve a simple path with one parameter', () => {
      const pattern = pathHandler.parseDynamicPath('users/:userId/orders');
      const result = pathHandler.resolvePattern(pattern, { userId: '123' });
      expect(result).toBe('users/123/orders');
    });
    
    it('should resolve a complex path with multiple parameters', () => {
      const pattern = pathHandler.parseDynamicPath('users/:userId/orders/:orderId/items');
      const result = pathHandler.resolvePattern(pattern, { 
        userId: '123', 
        orderId: '456' 
      });
      expect(result).toBe('users/123/orders/456/items');
    });
    
    it('should throw an error if a parameter value is missing', () => {
      const pattern = pathHandler.parseDynamicPath('users/:userId/orders');
      expect(() => {
        pathHandler.resolvePattern(pattern, {});
      }).toThrow(/Missing value for parameter/);
    });
  });
  
  /**
   * Tests for getParentPath function
   * This function gets the parent document path for a subcollection
   */
  describe('getParentPath', () => {
    it('should return null for a top-level collection', () => {
      const result = pathHandler.getParentPath('users');
      expect(result).toBeNull();
    });
    
    it('should return the parent document path for a subcollection', () => {
      const result = pathHandler.getParentPath('users/123/orders');
      expect(result).toBe('users/123');
    });
    
    it('should work for deeply nested collections', () => {
      const result = pathHandler.getParentPath('users/123/orders/456/items');
      expect(result).toBe('users/123/orders/456');
    });
  });
  
  /**
   * Tests for isCollection function
   * This function verifies that a path is a valid collection path
   */
  describe('isCollection', () => {
    it('should validate a top-level collection', () => {
      expect(pathHandler.isCollection('users')).toBe(true);
    });
    
    it('should validate a subcollection', () => {
      expect(pathHandler.isCollection('users/123/orders')).toBe(true);
    });
    
    it('should validate a deeply nested collection', () => {
      expect(pathHandler.isCollection('users/123/orders/456/items')).toBe(true);
    });
    
    it('should fail for a document path', () => {
      expect(pathHandler.isCollection('users/123')).toBe(false);
    });
    
    it('should handle empty paths', () => {
      // The PathHandler now throws for empty paths, so we need to test via a try/catch
      try {
        pathHandler.isCollection('');
        fail('Should have thrown an error for empty path');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Cannot normalize null or undefined path');
      }
    });
  });
});