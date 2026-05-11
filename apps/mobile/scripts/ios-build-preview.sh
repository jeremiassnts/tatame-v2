#!/bin/bash

# Helper script to run local EAS builds for iOS simulator preview
# Usage: ./ios-build-preview.sh
# This will create a preview build for the iOS Simulator
# Large temp artifacts use EAS_BUILD_ROOT (default: /Volumes/ExternalDisk1); override with env if needed.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=eas-build-common.sh
source "$SCRIPT_DIR/eas-build-common.sh"

echo "🍎 iOS Simulator Preview Build"
echo "==============================="
echo ""

# Check disk space (build volume, not only the system disk)
echo "Checking disk space on build volume..."
eas_build_print_cache_env
DISK_INFO=$(df -h "$EAS_BUILD_ROOT" | tail -1)
DISK_SPACE=$(echo "$DISK_INFO" | awk '{print $4}')
DISK_USAGE=$(echo "$DISK_INFO" | awk '{print $5}' | sed 's/%//')
echo "Available space: $DISK_SPACE"
echo ""

# Check if there is enough space (at least 5GB recommended)
DISK_SPACE_NUM=$(echo "$DISK_SPACE" | grep -oE '[0-9]+\.?[0-9]*')
DISK_SPACE_UNIT=$(echo "$DISK_SPACE" | grep -oE '[A-Za-z]+')

if [[ "$DISK_SPACE_UNIT" == "Gi" ]] && (( $(echo "$DISK_SPACE_NUM < 5" | bc -l 2>/dev/null || echo "1") )); then
  echo "⚠️  WARNING: Low disk space ($DISK_SPACE available)"
  echo "   iOS builds require at least 5-10GB of free space"
  echo ""
  read -p "Do you want to continue anyway? (y/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Build cancelled. Please free up disk space first."
    exit 1
  fi
elif [[ "$DISK_SPACE_UNIT" == "Mi" ]]; then
  echo "⚠️  WARNING: Very low disk space ($DISK_SPACE available)"
  echo "   iOS builds require at least 5-10GB of free space"
  echo ""
  read -p "Do you want to continue anyway? (y/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Build cancelled. Please free up disk space first."
    exit 1
  fi
fi

# Clean EAS temporary files
echo "Cleaning EAS temporary files..."
find /private/var/folders -name "*eas-build-local*" -type d -maxdepth 3 -exec rm -rf {} + 2>/dev/null || true
echo "Cleanup completed."
echo ""

# Execute EAS build for iOS simulator preview
echo "Executing: eas build --platform ios --profile preview-simulator --local"
echo ""

eas build --platform ios --profile preview-simulator --local
