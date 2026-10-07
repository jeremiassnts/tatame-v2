#!/bin/bash

# Helper script to display Android device logs
# Usage: ./android-logs.sh [mode]
#   (no arg) / app   -> all logs from the Tatame app process (best for preview builds)
#   expo             -> all logs from the Expo Go process
#   crash            -> native/Java crash buffer (stack traces of hard crashes)
#   error            -> every tag at level E or worse
#   react            -> only the ReactNativeJS tag (dev builds / console.* only)
#   all              -> everything
#   clear            -> wipe the logcat buffers
#   <anything else>  -> case-insensitive grep over all logs

export ANDROID_HOME="${ANDROID_HOME:-/Users/jeremiassantos/Library/Android/sdk}"
ADB_PATH="$ANDROID_HOME/platform-tools/adb"
APP_ID="com.anonymous.tatame"
EXPO_ID="host.exp.exponent"

if [ ! -f "$ADB_PATH" ]; then
  echo "Error: adb not found at $ADB_PATH"
  echo "Please install Android SDK or configure ANDROID_HOME correctly"
  exit 1
fi

# Wait briefly for a device so a just-restarted adbd does not look like "no device"
"$ADB_PATH" wait-for-device >/dev/null 2>&1 &
WAIT_PID=$!
( sleep 10; kill $WAIT_PID 2>/dev/null ) >/dev/null 2>&1 &
wait $WAIT_PID 2>/dev/null

if ! "$ADB_PATH" devices | awk 'NR>1 && $2=="device" {found=1} END {exit !found}'; then
  echo "Error: no Android device in 'device' state"
  "$ADB_PATH" devices
  echo "Check the cable, and confirm the USB debugging prompt on the phone."
  exit 1
fi

echo "Connected devices:"
"$ADB_PATH" devices
echo ""

# Stream every log line produced by a package, waiting for it to start if needed.
follow_package() {
  local pkg="$1"
  local pid
  pid=$("$ADB_PATH" shell pidof -s "$pkg" 2>/dev/null | tr -d '\r')
  if [ -z "$pid" ]; then
    echo "$pkg is not running. Open it on the phone — waiting..."
    while [ -z "$pid" ]; do
      sleep 1
      pid=$("$ADB_PATH" shell pidof -s "$pkg" 2>/dev/null | tr -d '\r')
    done
  fi
  echo "Following $pkg (pid $pid). Press Ctrl+C to stop."
  echo ""
  # --pid keeps every tag from that process: JS errors, Expo modules and native crashes
  "$ADB_PATH" logcat --pid="$pid"
}

FILTER=${1:-app}

case "$FILTER" in
  app|tatame)
    follow_package "$APP_ID"
    ;;
  expo|expogo)
    follow_package "$EXPO_ID"
    ;;
  crash)
    echo "Showing crash buffer (press Ctrl+C to stop)..."
    echo ""
    "$ADB_PATH" logcat -b crash
    ;;
  all)
    echo "Showing all logs (press Ctrl+C to stop)..."
    echo ""
    "$ADB_PATH" logcat
    ;;
  react|reactnative)
    echo "Showing ReactNativeJS logs (press Ctrl+C to stop)..."
    echo "Note: release/preview builds emit almost nothing here — use 'app' instead."
    echo ""
    "$ADB_PATH" logcat ReactNativeJS:V "*:S"
    ;;
  error|errors)
    echo "Showing error logs (press Ctrl+C to stop)..."
    echo ""
    "$ADB_PATH" logcat "*:E"
    ;;
  clear)
    echo "Clearing logcat buffers..."
    "$ADB_PATH" logcat -c -b all
    echo "Logs cleared."
    ;;
  *)
    echo "Showing logs filtered by: $FILTER (press Ctrl+C to stop)..."
    echo ""
    "$ADB_PATH" logcat | grep --line-buffered -i "$FILTER"
    ;;
esac
