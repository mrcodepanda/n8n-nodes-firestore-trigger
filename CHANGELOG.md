# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-05-14

### Added
- Implemented configurable logging system with environment-based log levels
- Added user-configurable verbose logging option to the node settings

### Fixed
- Resolved circular reference error when saving workflows with Firebase app objects
- Fixed Path Format Guide notice not displaying correctly in the n8n UI
- Fixed TypeScript ESLint compatibility by aligning plugin versions

### Changed
- Bumped package version for workflow improvements
- Fixed duplicate content in changelog
- Consolidated and improved GitHub workflow configuration
- Fixed ESLint errors related to node directory structure and formatting
- Renamed node directory from "FirestoreTrigger" to "Firestore" to match n8n conventions
- Fixed node classification in CI environment by using NODE_ENV=production for linting
- Replaced all console logging with structured Logger calls

## [1.0.1] - 2025-05-14

### Changed
- Optimized npm package by excluding test files
- Improved documentation organization

## [1.0.0] - 2025-05-13

### Added
- Initial release of Firestore Trigger node
- Support for collection and document listeners
- Support for subcollection monitoring with dynamic paths
- Path pattern parameters using colon syntax (e.g., "users/:userId/orders")
- Event filtering (added, modified, removed)
- Query filter support for collection listeners
- Robust error handling and reconnection logic
- Comprehensive documentation in README and node UI
- Testing framework with Firebase emulator integration
- Example workflows for common use cases
- Support for both Service Account and Application Default Credentials

### Known Issues
- Delete events may not be consistently triggered during testing, especially in the emulator environment
- The node appears as "Firestore" rather than "Firestore Trigger" in the n8n UI node selection menu
