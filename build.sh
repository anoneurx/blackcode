#!/bin/bash
set -e

echo "🔨 Building Black Code Production Bundle..."

# Check prerequisites
if ! command -v cmake &> /dev/null; then
    echo "❌ ERROR: cmake is not installed. Required for building llama.cpp bindings."
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ ERROR: rust/cargo is not installed."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ ERROR: node/npm is not installed."
    exit 1
fi

# 1. Build Backend
echo "🦀 Building Rust Backend..."
cd backend
cargo build --release
cd ..

# 2. Build Extension (Frontend)
echo "📦 Building VS Code Extension..."
cd frontend
VERSION=$(node -p "require('./package.json').version")

npm install --legacy-peer-deps
npm run compile
npx @vscode/vsce package --no-dependencies --allow-missing-repository --githubBranch main

mv *.vsix ../black-code-${VERSION}.vsix
cd ..

echo "✅ BUILD COMPLETE!"
echo "--------------------------------------------------"
echo "1. Backend: ./backend/target/release/blackcode-backend"
echo "2. Extension: ./black-code-${VERSION}.vsix"
echo "--------------------------------------------------"
echo "Next Steps: Start the backend server and install the VSIX in VS Code."
