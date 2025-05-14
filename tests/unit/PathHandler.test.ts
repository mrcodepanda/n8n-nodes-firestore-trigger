import { PathHandler } from '../../src/PathHandler';

describe('PathHandler', () => {
	let pathHandler: PathHandler;

	beforeEach(() => {
		pathHandler = new PathHandler();
	});

	describe('normalizePath', () => {
		it('should remove leading and trailing slashes', () => {
			expect(pathHandler.normalizePath('/users/')).toBe('users');
			expect(pathHandler.normalizePath('//collection///')).toBe('collection');
		});

		it('should trim spaces', () => {
			expect(pathHandler.normalizePath(' users ')).toBe('users');
		});

		it('should throw error for null or undefined paths', () => {
			expect(() => pathHandler.normalizePath(null as any)).toThrow();
			expect(() => pathHandler.normalizePath(undefined as any)).toThrow();
		});
	});

	describe('isCollection and isDocument', () => {
		it('should identify collections correctly', () => {
			expect(pathHandler.isCollection('users')).toBe(true);
			expect(pathHandler.isCollection('users/123/orders')).toBe(true);
			expect(pathHandler.isCollection('users/123')).toBe(false);
		});

		it('should identify documents correctly', () => {
			expect(pathHandler.isDocument('users/123')).toBe(true);
			expect(pathHandler.isDocument('users/123/orders/456')).toBe(true);
			expect(pathHandler.isDocument('users')).toBe(false);
		});
	});

	describe('getParentPath', () => {
		it('should return parent path for valid paths', () => {
			expect(pathHandler.getParentPath('users/123/orders')).toBe('users/123');
			expect(pathHandler.getParentPath('users/123')).toBe('users');
		});

		it('should return null for top-level paths', () => {
			expect(pathHandler.getParentPath('users')).toBeNull();
		});
	});

	describe('isPathParameter and extractParameterName', () => {
		it('should identify parameter segments', () => {
			expect(pathHandler.isPathParameter(':userId')).toBe(true);
			expect(pathHandler.isPathParameter('users')).toBe(false);
		});

		it('should extract parameter names', () => {
			expect(pathHandler.extractParameterName(':userId')).toBe('userId');
			expect(pathHandler.extractParameterName('users')).toBe('');
		});
	});

	describe('hasPathParameters', () => {
		it('should detect paths with parameters', () => {
			expect(pathHandler.hasPathParameters('users/:userId/orders')).toBe(true);
			expect(pathHandler.hasPathParameters('users/123/orders')).toBe(false);
		});
	});

	describe('parsePath', () => {
		it('should parse simple paths', () => {
			const result = pathHandler.parsePath('users/123/orders');
			
			expect(result.segments.length).toBe(3);
			expect(result.isCollection).toBe(true);
			expect(result.hasParameters).toBe(false);
			expect(result.parameterNames).toEqual([]);
		});

		it('should parse paths with parameters', () => {
			const result = pathHandler.parsePath('users/:userId/orders/:orderId');
			
			expect(result.segments.length).toBe(4);
			expect(result.isCollection).toBe(false);
			expect(result.hasParameters).toBe(true);
			expect(result.parameterNames).toEqual(['userId', 'orderId']);
			
			expect(result.segments[1].isParameter).toBe(true);
			expect(result.segments[1].paramName).toBe('userId');
			
			expect(result.segments[3].isParameter).toBe(true);
			expect(result.segments[3].paramName).toBe('orderId');
		});

		it('should throw for invalid paths', () => {
			expect(() => pathHandler.parsePath('')).toThrow();
			expect(() => pathHandler.parsePath('users//orders')).toThrow();
		});
	});

	describe('parseDynamicPath', () => {
		it('should parse dynamic paths with parameters', () => {
			const result = pathHandler.parseDynamicPath('users/:userId/orders/:orderId');
			
			expect(result.rawPattern).toBe('users/:userId/orders/:orderId');
			expect(result.segments.length).toBe(4);
			expect(result.isCollection).toBe(false);
			
			expect(result.parameterMap).toEqual({
				userId: [1],
				orderId: [3]
			});
		});

		it('should handle repeated parameters', () => {
			const result = pathHandler.parseDynamicPath('users/:id/friends/:id');
			
			expect(result.parameterMap).toEqual({
				id: [1, 3]
			});
		});
	});

	describe('resolvePattern', () => {
		it('should resolve patterns with parameter values', () => {
			const pattern = pathHandler.parseDynamicPath('users/:userId/orders/:orderId');
			const resolved = pathHandler.resolvePattern(pattern, {
				userId: '123',
				orderId: '456'
			});
			
			expect(resolved).toBe('users/123/orders/456');
		});

		it('should throw if parameter values are missing', () => {
			const pattern = pathHandler.parseDynamicPath('users/:userId/orders/:orderId');
			
			expect(() => pathHandler.resolvePattern(pattern, {
				userId: '123'
				// orderId is missing
			})).toThrow();
		});
	});

	describe('findFirstParameterParentPath', () => {
		it('should find parent path of first parameter', () => {
			expect(pathHandler.findFirstParameterParentPath('users/:userId/orders')).toBe('users');
			expect(pathHandler.findFirstParameterParentPath('users/:userId/orders/:orderId')).toBe('users');
		});

		it('should return null for paths without parameters', () => {
			expect(pathHandler.findFirstParameterParentPath('users/123/orders')).toBeNull();
		});

		it('should return null if parameter is at the beginning', () => {
			expect(pathHandler.findFirstParameterParentPath(':users/123/orders')).toBeNull();
		});
	});
});