# GitHub Workflows for n8n-nodes-firestore-trigger

This document describes the GitHub workflows set up for the n8n-nodes-firestore-trigger project.

## Available Workflows

### 1. CI (ci.yml)

This is the primary continuous integration workflow that runs on every push to the master branch and on pull requests targeting the master branch.

**Triggers:**
- Push to master branch
- Pull requests targeting master branch

**Jobs:**
- `lint-and-build`: Runs linting, builds the package, and executes tests

**Usage:**
This workflow automatically runs on every push and pull request. You can see the status badge in the README.md file.

### 2. Build Status (build-status.yml)

A more detailed workflow that breaks down the checks into separate jobs for clearer status reporting.

**Triggers:**
- Push to master branch
- Pull requests targeting master branch
- Manual trigger (workflow_dispatch)

**Jobs:**
- `build`: Builds the project and uploads the artifacts
- `lint`: Runs linting checks
- `test`: Runs the test suite

**Usage:**
You can manually trigger this workflow from the Actions tab in the GitHub repository if needed.

### 3. Comprehensive Check (comprehensive-check.yml)

An extensive verification workflow that includes all checks for code quality, including a dry run of the publishing process.

**Triggers:**
- Pull requests targeting master branch
- Manual trigger (workflow_dispatch)

**Jobs:**
- `verify`: Runs format checks, linting, builds the package, runs tests, and verifies publishing readiness

**Usage:**
This workflow is particularly useful before merging a PR into master. It ensures the code is ready for production.

### 4. Node.js Compatibility (node-compatibility.yml)

Tests the package on different Node.js versions to ensure compatibility.

**Triggers:**
- Weekly schedule (Sundays at midnight)
- Manual trigger (workflow_dispatch)

**Jobs:**
- `test-node-versions`: Tests building and running on Node.js 18.x, 20.x, and 22.x

**Usage:**
This workflow runs automatically once a week but can also be triggered manually if needed.

### 5. CI Status Badges (badges.yml)

Updates status badges for the repository.

**Triggers:**
- Push to master branch

**Jobs:**
- `update-badges`: Generates and updates the status badges

**Usage:**
This workflow runs automatically on every push to master and updates the badges that are displayed in the README.md file.

## Using the Workflows

### Viewing Workflow Results

1. Go to the GitHub repository
2. Click on the "Actions" tab
3. Select the workflow you want to view from the left sidebar
4. Click on a specific workflow run to view details

### Manually Triggering Workflows

Some workflows support manual triggering:

1. Go to the GitHub repository
2. Click on the "Actions" tab
3. Select the workflow you want to run from the left sidebar
4. Click the "Run workflow" button
5. Select the branch and click "Run workflow"

### Adding Badges to Documentation

The CI badge is already added to the README.md file. If you want to add more badges, use the following format:

```markdown
[![Workflow Name](https://github.com/mrcodepanda/n8n-nodes-firestore-trigger/actions/workflows/workflow-filename.yml/badge.svg)](https://github.com/mrcodepanda/n8n-nodes-firestore-trigger/actions/workflows/workflow-filename.yml)
```

## Troubleshooting

If a workflow fails, check the following:

1. **Dependency Issues**: Make sure all dependencies are correctly specified in package.json
2. **Node.js Version**: Verify that the package works with the Node.js version specified in the workflow
3. **PNPM Version**: Ensure PNPM 9.1.4 (as specified in package.json) is compatible with your setup
4. **Test Failures**: Check for failing tests in the workflow logs
5. **Linting Issues**: Fix any linting errors reported in the workflow logs

## Extending Workflows

To add a new workflow:

1. Create a new YAML file in the `.github/workflows/` directory
2. Define the triggers, jobs, and steps
3. Commit and push the new workflow file to the repository

For more information on GitHub Actions, see the [GitHub Actions documentation](https://docs.github.com/en/actions).
