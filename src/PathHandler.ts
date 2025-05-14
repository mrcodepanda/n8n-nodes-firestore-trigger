/**
 * Types for handling Firestore path segments and path analysis
 */
export type PathSegment = {
	value: string;
	isParameter: boolean;
	paramName?: string;
};

export type PathAnalysis = {
	segments: PathSegment[];
	isCollection: boolean;
	hasParameters: boolean;
	parameterNames: string[];
};

export type PathPattern = {
	rawPattern: string;
	segments: PathSegment[];
	parameterMap: Record<string, number[]>;
	isCollection: boolean;
};

/**
 * Handles Firestore path operations including parsing, validation, and parameter handling
 */
export class PathHandler {
	/**
	 * Normalizes a path string by removing leading/trailing slashes and spaces
	 */
	normalizePath(path: string): string {
		if (!path) {
			throw new Error('Cannot normalize null or undefined path');
		}
		
		return path.trim().replace(/^\/+|\/+$/g, '');
	}

	/**
	 * Checks if a path represents a collection
	 * Collections have an odd number of segments
	 */
	isCollection(path: string): boolean {
		const segments = this.normalizePath(path).split('/').filter(segment => segment.trim() !== '');
		return segments.length % 2 === 1;
	}

	/**
	 * Checks if a path represents a document
	 * Documents have an even number of segments
	 */
	isDocument(path: string): boolean {
		const segments = this.normalizePath(path).split('/').filter(segment => segment.trim() !== '');
		return segments.length % 2 === 0 && segments.length > 0;
	}

	/**
	 * Gets the parent path of a given path
	 * For collections, returns the parent document path
	 * For documents, returns the parent collection path
	 */
	getParentPath(path: string): string | null {
		const segments = this.normalizePath(path).split('/').filter(segment => segment.trim() !== '');
		
		if (segments.length <= 1) {
			return null;
		}
		
		return segments.slice(0, segments.length - 1).join('/');
	}

	/**
	 * Checks if a path segment is a parameter (starts with colon)
	 */
	isPathParameter(segment: string): boolean {
		return segment.startsWith(':');
	}

	/**
	 * Extract parameter name from a path segment
	 */
	extractParameterName(segment: string): string {
		if (!this.isPathParameter(segment)) {
			return '';
		}
		return segment.substring(1); // Remove the leading colon
	}

	/**
	 * Check if a path contains any parameters
	 */
	hasPathParameters(path: string): boolean {
		const segments = this.normalizePath(path).split('/');
		return segments.some(segment => this.isPathParameter(segment));
	}

	/**
	 * Parse a path into segments with parameter information
	 */
	parsePath(path: string): PathAnalysis {
		// Safety check - ensure we have a valid string
		if (!path) {
			throw new Error('Cannot parse null or undefined path');
		}
		
		// Normalize the path before processing
		const normalizedPath = this.normalizePath(path);
		
		if (normalizedPath === '') {
			throw new Error('Cannot parse empty path');
		}
		
		// Check for consecutive slashes in the original path
		if (normalizedPath.includes('//')) {
			throw new Error(`Path "${path}" contains empty segments (consecutive slashes)`);
		}
		
		// Split and filter empty segments
		const rawSegments = normalizedPath.split('/').filter(segment => segment !== '');
		
		if (rawSegments.length === 0) {
			throw new Error(`Path "${path}" contains no valid segments after normalization`);
		}
		
		const segments: PathSegment[] = [];
		const parameterNames: string[] = [];
		let hasParameters = false;
		
		for (const segment of rawSegments) {
			// Check if this segment is valid (not empty)
			if (segment.trim() === '') {
				throw new Error(`Path "${path}" contains empty segments after splitting`);
			}
			
			const isParam = this.isPathParameter(segment);
			
			if (isParam) {
				hasParameters = true;
				const paramName = this.extractParameterName(segment);
				
				// Ensure parameter name is not empty
				if (!paramName || paramName.trim() === '') {
					throw new Error(`Path "${path}" contains parameter with empty name (e.g., ":/")`);
				}
				
				parameterNames.push(paramName);
				
				segments.push({
					value: segment,
					isParameter: true,
					paramName,
				});
			} else {
				segments.push({
					value: segment,
					isParameter: false,
				});
			}
		}
		
		// A path with an odd number of segments represents a collection
		const isCollection = segments.length % 2 === 1;
		
		return {
			segments,
			isCollection,
			hasParameters,
			parameterNames,
		};
	}

	/**
	 * Parse a dynamic path pattern into a structured representation
	 */
	parseDynamicPath(pattern: string): PathPattern {
		const analysis = this.parsePath(pattern);
		const parameterMap: Record<string, number[]> = {};
		
		// Map parameter names to their positions in the path
		analysis.segments.forEach((segment, index) => {
			if (segment.isParameter && segment.paramName) {
				if (!parameterMap[segment.paramName]) {
					parameterMap[segment.paramName] = [];
				}
				parameterMap[segment.paramName].push(index);
			}
		});
		
		return {
			rawPattern: this.normalizePath(pattern),
			segments: analysis.segments,
			parameterMap,
			isCollection: analysis.isCollection,
		};
	}

	/**
	 * Resolve a path pattern with parameter values
	 */
	resolvePattern(pattern: PathPattern, values: Record<string, string>): string {
		const resolvedSegments = [...pattern.segments];
		
		// Replace parameters with actual values
		for (const [paramName, positions] of Object.entries(pattern.parameterMap)) {
			const paramValue = values[paramName];
			
			if (!paramValue) {
				throw new Error(`Missing value for parameter "${paramName}" in path pattern`);
			}
			
			// Replace all occurrences of this parameter
			for (const position of positions) {
				resolvedSegments[position] = {
					value: paramValue,
					isParameter: false,
				};
			}
		}
		
		// Join the segments to form the resolved path
		return resolvedSegments.map(segment => segment.value).join('/');
	}

	/**
	 * Find the path to the parent of the first parameter in a path
	 */
	findFirstParameterParentPath(path: string): string | null {
		const analysis = this.parsePath(path);
		
		if (!analysis.hasParameters) {
			return null;
		}
		
		// Find the index of the first parameter
		const firstParamIndex = analysis.segments.findIndex(segment => segment.isParameter);
		
		if (firstParamIndex <= 0) {
			return null; // If it's the first segment or not found, there's no parent
		}
		
		// Return the path up to but not including the parameter
		const parentSegments = analysis.segments.slice(0, firstParamIndex).map(segment => segment.value);
		return parentSegments.join('/');
	}
}

// Export a singleton instance for convenience
export const pathHandler = new PathHandler();