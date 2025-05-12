# Publishing Guide for n8n-nodes-firestore-trigger

This document outlines the steps to publish the n8n-nodes-firestore-trigger package to npm and ensure it works correctly after installation.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18.10.0 or newer)
- [pnpm](https://pnpm.io/) (v9.1.0 or newer)
- An [npm account](https://www.npmjs.com/signup) with publishing rights to the package
- Git installed and configured

## Publishing Checklist

### 1. Prepare the Package

- [ ] Update version number in package.json
- [ ] Update CHANGELOG.md with new version details
- [ ] Ensure all changes are committed to git
- [ ] Run tests to make sure everything works
  ```bash
  pnpm test
  ```
- [ ] Run linting to ensure code quality
  ```bash
  pnpm lint
  ```
- [ ] Build the package
  ```bash
  pnpm build
  ```

### 2. Test Package Locally

- [ ] Run a dry-run to see what would be published:
  ```bash
  pnpm publish-dry-run
  ```
- [ ] Verify that only necessary files are included
- [ ] If needed, update .npmignore to exclude more files

### 3. Publish to npm

- [ ] Login to npm (if not already logged in)
  ```bash
  npm login
  ```
- [ ] Publish the package
  ```bash
  npm publish
  ```
- [ ] Verify the package appears on npm: https://www.npmjs.com/package/n8n-nodes-firestore-trigger

### 4. Create a GitHub Release

- [ ] Create a new tag matching the version
  ```bash
  git tag -a v1.0.0 -m "Version 1.0.0"
  git push origin v1.0.0
  ```
- [ ] Create a new release on GitHub with:
  - Release title: v1.0.0
  - Description: Copy relevant parts from CHANGELOG.md
  - Attach the compiled package (optional)

### 5. Verify Installation

- [ ] Install the package in a clean n8n installation
  ```bash
  cd ~/.n8n/custom
  npm install n8n-nodes-firestore-trigger
  ```
- [ ] Restart n8n
- [ ] Verify that the node appears in n8n and works as expected
- [ ] Test with a simple workflow to ensure functionality

### 6. Troubleshooting Installation Issues

If users report installation issues:

1. Verify package structure:
   - Ensure dist/ folder contains all compiled JavaScript files
   - Check that package.json correctly points to main entry point
   - Verify n8n section in package.json has correct paths

2. Common issues:
   - Missing dependencies: Check if all required dependencies are specified correctly
   - Version conflicts: Check if your package works with the user's n8n version
   - File permissions: Check if files have correct permissions

## Version Management

Follow [Semantic Versioning](https://semver.org/) guidelines:

- Major version (1.0.0): Incompatible API changes
- Minor version (0.1.0): Add functionality in a backwards-compatible manner
- Patch version (0.0.1): Backwards-compatible bug fixes

## Additional Documentation

- General usage documentation: See the main README.md
- Installation guide: See docs/INSTALLATION.md
- Example workflows: See docs/EXAMPLE_WORKFLOWS.md
- Testing documentation: Consolidated in tests/docs/README.md
  - Includes comprehensive test structure, run instructions, and testing guides
  - Additional testing guides:
    - Credential testing: tests/docs/CREDENTIAL_TESTING.md
    - Emulator testing: tests/docs/EMULATOR_TESTING.md

## Example CHANGELOG Entry

```markdown
## [1.0.0] - 2025-05-12

### Added
- Initial release of Firestore Trigger node
- Support for collection and document listeners
- Support for subcollection monitoring
- Path pattern parameters using colon syntax
- Event filtering (added, modified, removed)
- Query filter support
- Error handling and reconnection logic

### Fixed
- N/A (first release)

### Changed
- N/A (first release)
```
