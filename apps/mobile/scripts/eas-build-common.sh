#!/usr/bin/env bash
# Shared settings for local EAS builds: use a volume with more free space than the system disk.
# Sourced by eas-build-*.sh. Override defaults by exporting before running:
#   EAS_BUILD_ROOT=/other/volume ./eas-build-dev.sh

EAS_BUILD_ROOT="${EAS_BUILD_ROOT:-/Volumes/ExternalDisk1}"
if [[ ! -d "$EAS_BUILD_ROOT" ]]; then
  echo "Error: EAS build volume not mounted or missing: $EAS_BUILD_ROOT"
  echo "Mount the disk or set EAS_BUILD_ROOT to a writable directory with enough free space."
  exit 1
fi

export EAS_LOCAL_BUILD_WORKINGDIR="${EAS_LOCAL_BUILD_WORKINGDIR:-$EAS_BUILD_ROOT/.eas-local-build}"
# Gradle, npm, and other tools respect TMPDIR; keeps large temp off the boot volume.
export TMPDIR="${TMPDIR:-$EAS_BUILD_ROOT/.tmp}"
# Default ~/.gradle holds AGP downloads and dependency caches; local Android builds need this on a spacious volume.
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$EAS_BUILD_ROOT/.gradle}"

# npm / npx (EAS CLI, Metro, install scripts) — default ~/.npm
export npm_config_cache="${npm_config_cache:-$EAS_BUILD_ROOT/.npm-cache}"
# pnpm content-addressable store — default under ~/Library/pnpm or ~/.pnpm-store
export npm_config_store_dir="${npm_config_store_dir:-$EAS_BUILD_ROOT/.pnpm-store}"

# Many tools (and some Node tooling) honor XDG; keeps ~/.cache off the boot disk.
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$EAS_BUILD_ROOT/.cache}"

# Node.js (v21+) bytecode disk cache — default ~/.cache/node-compile-cache etc.
export NODE_COMPILE_CACHE="${NODE_COMPILE_CACHE:-$EAS_BUILD_ROOT/.node-compile-cache}"

# Ensure JVMs used by Gradle/Kotlin use the same temp root as TMPDIR.
if [[ "${JAVA_TOOL_OPTIONS:-}" != *"java.io.tmpdir="* ]]; then
  export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:+$JAVA_TOOL_OPTIONS }-Djava.io.tmpdir=$TMPDIR"
fi

mkdir -p "$EAS_LOCAL_BUILD_WORKINGDIR" "$TMPDIR" "$GRADLE_USER_HOME" \
  "$npm_config_cache" "$npm_config_store_dir" "$XDG_CACHE_HOME" "$NODE_COMPILE_CACHE" || {
  echo "Error: could not create cache directories under $EAS_BUILD_ROOT"
  exit 1
}

# Call from eas-build-*.sh before df / space checks.
eas_build_print_cache_env() {
  echo "  EAS_LOCAL_BUILD_WORKINGDIR=$EAS_LOCAL_BUILD_WORKINGDIR"
  echo "  TMPDIR=$TMPDIR"
  echo "  GRADLE_USER_HOME=$GRADLE_USER_HOME"
  echo "  npm_config_cache=$npm_config_cache"
  echo "  npm_config_store_dir=$npm_config_store_dir"
  echo "  XDG_CACHE_HOME=$XDG_CACHE_HOME"
  echo "  NODE_COMPILE_CACHE=$NODE_COMPILE_CACHE"
  [[ -n "${JAVA_TOOL_OPTIONS:-}" ]] && echo "  JAVA_TOOL_OPTIONS=$JAVA_TOOL_OPTIONS"
}
