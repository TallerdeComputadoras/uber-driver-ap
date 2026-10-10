#!/usr/bin/env bash
# exit on error
set -o errexit

echo "========================================"
echo "  UBER DRIVER APP - RENDER BUILD SCRIPT "
echo "========================================"

echo ">> 1. Installing server dependencies..."
cd server
npm install --production=false
cd ..

echo ">> 2. Installing client dependencies..."
cd client
npm install
# Fix any peer dependency issues if any
echo ">> 3. Building React client bundle..."
npm run build
cd ..

echo "========================================"
echo "  BUILD COMPLETED SUCCESSFULLY!         "
echo "========================================"