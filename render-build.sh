#!/bin/bash
set -e

# Install dependencies
echo "Installing npm dependencies..."
npm install --production

# Build if needed (for React apps, but this is a Node API)
# If you had a React app, you'd build it here
# npm run build

echo "Build complete"