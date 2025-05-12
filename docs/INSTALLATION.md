# Installation Guide for n8n-nodes-firestore-trigger

This guide provides detailed instructions for installing and using the Firestore Trigger node in your n8n instance.

## Prerequisites

- n8n version 0.209.0 or later
- Firebase project with Firestore database
- Firebase Admin SDK credentials

## Installation Methods

### Method 1: Install from npm (Recommended)

1. Open a terminal and navigate to your n8n data directory
   ```bash
   cd ~/.n8n
   ```

2. If the "custom" directory doesn't exist, create it
   ```bash
   mkdir -p custom
   cd custom
   ```

3. Install the package using npm or pnpm
   ```bash
   # Using npm
   npm install n8n-nodes-firestore-trigger

   # Using pnpm
   pnpm add n8n-nodes-firestore-trigger
   ```

4. Restart n8n to load the new node
   ```bash
   # If using PM2
   pm2 restart n8n

   # If running directly
   n8n start
   ```

### Method 2: Install from Source (For Development)

1. Clone the repository
   ```bash
   git clone https://github.com/mrcodepanda/n8n-nodes-firestore-trigger.git
   cd n8n-nodes-firestore-trigger
   ```

2. Install dependencies and build the package
   ```bash
   pnpm install
   pnpm build
   ```

3. Link the package to your n8n installation
   ```bash
   # Create a global link
   pnpm link --global

   # Navigate to your n8n custom directory
   cd ~/.n8n/custom

   # Link the package from global
   pnpm link --global n8n-nodes-firestore-trigger
   ```

4. Restart n8n

## Troubleshooting Installation Issues

If you encounter problems during installation:

1. **Node not appearing in n8n**:
   - Verify that n8n is restarted after installation
   - Check your n8n version (must be 0.209.0 or later)
   - Inspect n8n logs for any errors
   - Ensure the package is installed in the correct directory

2. **Package installation errors**:
   - Check that you have appropriate permissions for the installation directory
   - Try installing with the `--force` flag if you have dependency conflicts
   ```bash
   npm install n8n-nodes-firestore-trigger --force
   ```

3. **Build or link errors (for source installation)**:
   - Ensure you have the required build tools (Node.js, pnpm/npm)
   - Try cleaning your node_modules directory and reinstalling
   ```bash
   rm -rf node_modules
   pnpm install
   ```

## Verifying Installation

After installation and restarting n8n:

1. Open your n8n instance in a web browser
2. Create a new workflow
3. Click "Add node" and search for "Firestore"
4. You should see the "Firestore" node in the search results (Note: Due to a known issue, it appears as "Firestore" rather than "Firestore Trigger" in the node selection menu)
5. Add the node to your workflow to begin configuration

## Setting Up Credentials

Before using the node, you'll need to set up Firebase Admin SDK credentials:

1. Go to your [Firebase Console](https://console.firebase.google.com/)
2. Navigate to Project Settings > Service Accounts
3. Click "Generate new private key"
4. Download the JSON file containing your service account credentials

In n8n:
1. Go to the Credentials tab
2. Click "Create New Credentials"
3. Select "Firebase Admin API"
4. Choose Authentication Method:
   - Service Account JSON: Paste the contents of your JSON credentials file
   - Application Default Credentials: For testing with emulator or environment-based auth
5. Enter your Firebase Project ID
6. Optionally specify a Database ID (leave as "(default)" for standard setup)
7. Save your credentials

## Next Steps

Once installed, refer to the [README](../README.md) for detailed usage instructions and examples.
