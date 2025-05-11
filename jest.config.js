module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testRegex: '(/__tests__/.*|\\.test)\\.(ts|js)$',
	moduleFileExtensions: ['ts', 'js', 'json'],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	collectCoverageFrom: ['credentials/**/*.ts', 'nodes/**/*.ts'],
	coverageReporters: ['text', 'html'],
	coverageDirectory: './coverage',
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
