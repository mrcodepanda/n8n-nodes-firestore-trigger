module.exports = {
	...require('./jest.config.js'),
	// Additional CI-specific configuration
	testTimeout: 30000, // Increase timeout for CI
};
