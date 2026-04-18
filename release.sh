#!/bin/bash
# Usage: ./release.sh 2.05.0 "Added new feature X"
#
# This script:
# 1. Updates the version in tauri.conf.json
# 2. Commits the change
# 3. Tags it
# 4. Pushes to GitHub
# 5. GitHub Actions automatically builds Mac + Windows + uploads

VERSION=$1
MESSAGE=$2

if [ -z "$VERSION" ] || [ -z "$MESSAGE" ]; then
  echo "Usage: ./release.sh <version> <message>"
  echo "Example: ./release.sh 2.05.0 'Added portfolio tracker'"
  exit 1
fi

echo "► Releasing DML FX v${VERSION}..."
echo "  Message: ${MESSAGE}"
echo ""

# Update version in tauri.conf.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" src-tauri/tauri.conf.json

# Commit
git add -A
git commit -m "Release v${VERSION}: ${MESSAGE}"

# Tag
git tag -a "v${VERSION}" -m "${MESSAGE}"

# Push
git push origin main
git push origin "v${VERSION}"

echo ""
echo "✓ Pushed v${VERSION} to GitHub"
echo "► GitHub Actions is now building Mac + Windows apps..."
echo "► Check progress: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git$//')/actions"
echo ""
echo "When done, users will auto-update on next app launch."
