#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
required=(ROAMY_RELEASE_STORE_FILE ROAMY_RELEASE_STORE_PASSWORD ROAMY_RELEASE_KEY_ALIAS ROAMY_RELEASE_KEY_PASSWORD)
for variable in "${required[@]}"; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing release signing configuration: $variable. Supply through secure environment variables." >&2
    exit 2
  fi
done
if [[ "$ROAMY_RELEASE_STORE_FILE" != /* ]]; then
  echo 'Use an absolute path for the mounted release keystore.' >&2
  exit 2
fi
if [[ ! -f "$ROAMY_RELEASE_STORE_FILE" ]]; then
  echo 'The configured release keystore file is unavailable.' >&2
  exit 2
fi
(cd "$project_root/web" && npm ci && npm test && npm run build)
(cd "$project_root/android" && ./gradlew --no-daemon :app:assembleVehicleRelease :app:lintVehicleRelease)
python3 "$project_root/scripts/verify-apk.py" \
  "$project_root/android/app/build/outputs/apk/vehicle/release/app-vehicle-release.apk" \
  --web-dir "$project_root/web/dist" --release
echo 'Signed vehicle release built and static integrity checks passed. Pleos runtime/review gates still apply.'
