#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
case "${1:-preview}" in
  preview) build_flavor=Preview ;;
  vehicle) build_flavor=Vehicle ;;
  *) echo 'Usage: scripts/build-apk.sh [preview|vehicle]' >&2; exit 2 ;;
esac
(cd "$project_root/web" && npm ci && npm test)
(cd "$project_root/android" && ./gradlew ":app:assemble${build_flavor}Debug" ":app:test${build_flavor}DebugUnitTest")
