module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleFileExtensions: ['ts', 'js', 'json'],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	collectCoverageFrom: ['credentials/**/*.ts', 'nodes/**/*.ts', 'src/**/*.ts'],
	coverageReporters: ['text', 'html'],
	coverageDirectory: './coverage',
	setupFiles: ['<rootDir>/jest.setup-env.js'],
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
	moduleNameMapper: {
		'^n8n-workflow$': '<rootDir>/node_modules/n8n-workflow',
	},
	modulePathIgnorePatterns: ['<rootDir>/dist/'],
	testPathIgnorePatterns: ['/node_modules/', '/dist/', '/tests/legacy/'],
	testMatch: [
		'<rootDir>/tests/unit/**/*.test.ts',
		'<rootDir>/tests/integration/**/*.test.ts',
		'<rootDir>/tests/*.test.ts',
	],
};
