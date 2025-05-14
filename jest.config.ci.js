module.exports = {
	...require('./jest.config.js'),
	// Additional CI-specific configuration
	testTimeout: 30000, // Increase timeout for CI
	testEnvironment: 'node',
	globals: {
		'ts-jest': {
			isolatedModules: true
		},
		__CI__: true,
		__FIREBASE_MOCK__: true
	},
	// Skip certain tests that require real Firebase credentials
	testPathIgnorePatterns: [
		'/node_modules/',
		'/dist/',
		'tests/emulator/'
	],
	// Force our setup file to run first
	setupFiles: ['<rootDir>/tests/ci-setup-env.js'],
	// Use the standard ts-jest transformer
	transform: {
		'^.+\\.ts$': 'ts-jest'
	}
};
