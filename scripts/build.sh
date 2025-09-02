#!/bin/bash

# Build script for Auto Commit Message extension

set -e

echo "🔨 Building Auto Commit Message extension..."

# Clean old files
echo "🧹 Cleaning old files..."
rm -rf out/
rm -f *.vsix

# Compile TypeScript
echo "📦 Compiling TypeScript..."
npm run compile

# Check compilation result
if [ ! -d "out" ]; then
    echo "❌ Compilation failed: out directory not found"
    exit 1
fi

echo "✅ TypeScript compilation completed"

# Package extension
echo "📦 Packaging VSCode extension..."
npx vsce package --allow-missing-repository

# Check package result
VSIX_FILE=$(ls *.vsix 2>/dev/null | head -n 1)
if [ -z "$VSIX_FILE" ]; then
    echo "❌ Packaging failed: .vsix file not found"
    exit 1
fi

echo "✅ Extension packaged successfully"
echo "📁 Generated file: $VSIX_FILE"
echo ""
echo "🎉 Build completed!"
echo "💡 Install with: code --install-extension $VSIX_FILE"
