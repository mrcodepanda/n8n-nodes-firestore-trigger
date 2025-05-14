/**
 * @type {import('@types/eslint').ESLint.ConfigData}
 */
module.exports = {
	root: true,

	env: {
		browser: true,
		es6: true,
		node: true,
	},

	parser: '@typescript-eslint/parser',

	parserOptions: {
		project: ['./tsconfig.json', './tsconfig.test.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},

	ignorePatterns: ['.eslintrc.js', '**/node_modules/**', '**/dist/**', 'tests/emulator/**'],

	plugins: ['@typescript-eslint'],
	extends: [
		'plugin:@typescript-eslint/recommended',
	],
	
	overrides: [
		{
			files: ['./tests/**/*.ts', './tests/**/*.js'],
			rules: {
				// Allow any type in tests
				'@typescript-eslint/no-explicit-any': 'off',
				// Allow require statements in tests
				'@typescript-eslint/no-var-requires': 'off',
				'@typescript-eslint/no-require-imports': 'off',
				// No need for explicit return types in tests
				'@typescript-eslint/explicit-module-boundary-types': 'off',
				// Allow ts-ignore/ts-expect-error comments in tests
				'@typescript-eslint/ban-ts-comment': 'off',
				// Allow unused variables in tests (often used in setup)
				'@typescript-eslint/no-unused-vars': 'off',
				// Allow non-null assertions in tests
				'@typescript-eslint/no-non-null-assertion': 'off',
				// Allow empty functions in mocks
				'@typescript-eslint/no-empty-function': 'off',
				// More relaxed rules for test files
				'@typescript-eslint/no-use-before-define': 'off',
				// Allow testing of private methods
				'@typescript-eslint/no-unsafe-member-access': 'off',
				'@typescript-eslint/no-unsafe-assignment': 'off',
				'@typescript-eslint/no-unsafe-call': 'off',
				'@typescript-eslint/no-unsafe-return': 'off',
			},
		},
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
			rules: {
				'n8n-nodes-base/community-package-json-name-still-default': 'off',
				'@typescript-eslint/no-unused-expressions': 'off',
			},
		},
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				'n8n-nodes-base/cred-class-field-documentation-url-missing': 'off',
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
			rules: {
				'n8n-nodes-base/node-execute-block-missing-continue-on-fail': 'off',
				'n8n-nodes-base/node-resource-description-filename-against-convention': 'off',
				'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',
			},
		},
		{
			files: ['./src/ListenerManager.ts', './src/FirebaseService.ts'],
			rules: {
				'@typescript-eslint/no-explicit-any': 'off',
				'@typescript-eslint/explicit-module-boundary-types': 'off',
			},
		},
		{
			files: ['./src/**/*.ts'],
			excludedFiles: ['./src/ListenerManager.ts', './src/FirebaseService.ts'],
			rules: {
				'@typescript-eslint/no-explicit-any': 'warn',
				'@typescript-eslint/explicit-module-boundary-types': 'off',
			},
		},
	],
};
