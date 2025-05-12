# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
