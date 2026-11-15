# ROAMY release and validation gates

ROAMY is a stationary entertainment game. Its manifest declares `android:appCategory="game"`; asking NaviHelper to hand off a route does not make ROAMY a Maps/Navigation app. See the official [categories guide](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-planning-guide/app-category) and [driving distraction review guidance](https://document.pleos.ai/en/docs/pleos-only/distribute/app-review-guide/review-driver-distraction-elements). Vehicle builds must never declare distraction optimization or expose a driving override.

## Build and signing

Version 0.2.0 uses Android version code 2. Package IDs remain stable. Debug artifacts are for development. Unconfigured `assembleVehicleRelease` produces an unsigned build for static checks; it is not distributable.

For an actual release, supply an authorized keystore through secure cloud environment configuration:

- `ROAMY_RELEASE_STORE_FILE`: path to the mounted private keystore.
- `ROAMY_RELEASE_STORE_PASSWORD`, `ROAMY_RELEASE_KEY_ALIAS`, `ROAMY_RELEASE_KEY_PASSWORD`: secure signing configuration.

Run `scripts/build-release.sh`. It checks configuration without printing values, builds and lints the vehicle release, verifies the signature, rejects debug certificates/debuggable or preview packages, and byte-compares bundled web assets against production output. Android v2/v3 signing is enabled; certificate ownership, custody and any signing-key lineage/rotation must be managed by the release owner. Do not generate a production identity for a demonstration or check a keystore into Git. No release key was provided in this task, so no official release certificate or market upload is claimed.

`scripts/verify-apk.py` also verifies debug APKs without `--release`. `--unsigned` is an explicit static-inspection mode for unsigned artifacts; it reports `signatureVerified: false` and cannot be combined with `--release`. It emits package, public artifact hash, permission inventory and static checks, never certificate identities or passwords. Static verification does not certify runtime behavior or prevent a malicious build from bypassing application policy.

## Cloud runtime gate

Use the official Pleos 2.1.0 API 34 system image with a cold boot, 4 GB AVD RAM, usable KVM and supported GPU. The current cloud host fails the hardware prerequisites; see [EMULATOR_FEASIBILITY.md](EMULATOR_FEASIBILITY.md). A generic Android emulator is not a substitute.

`python3 scripts/check-pleos-host.py --check-image-source` repeats the cloud KVM/GPU exposure and official manifest/archive availability checks without downloading an image or logging device/project identifiers. Exit code 2 means a prerequisite remains blocked. Even exit 0 requires a separate supported GPU/driver check, official AVD cold boot and runtime evidence; the script never claims that hardware exposure alone validates Pleos.

Before enabling vehicle entertainment, validate the documented UX restriction observer on official Pleos: unknown/disconnected/stale/error/background states lock, restrictions lock immediately, reconnection requires a fresh authoritative value, and the native cover still works while JavaScript is stalled or its renderer dies. No test fixture or browser safety event is authoritative vehicle state.

On the official AVD, verify startup/offline assets, process death and recreation, pause/resume, navigation grants/service failures and cleanup, all display sizes, gesture bounds, sound focus and interruption, reduced motion, save/migration/import recovery and destructive-action cancellation. Capture screenshots and only filtered non-sensitive logcat. Collect frame time, draw calls, memory and long-session behavior on Pleos; software Chromium numbers do not establish head-unit performance. Agree measured hardware budgets before accepting the performance gate.

## Privacy and release review

World memories and exports are local user data. Browser storage and text exports are not encrypted; do not describe local sandboxing as encryption or ask users to enter secrets. Export is deliberate and can contain notes/dates. Clearing application data or uninstalling removes local data; automatic Android backup/device transfer is excluded. A production deployment handling sensitive personal/vehicle data needs approved app-level encryption and key management before release, per the [official security guide](https://document.pleos.ai/en/docs/pleos-only/app-registration-guide/app-security-guide).

The [official submission guide](https://document.pleos.ai/en/docs/pleos-only/distribute/app-submission-guide) requires accurate product/privacy/permission metadata, a signed APK, reviewable functionality and appropriate market materials. Remaining owner-supplied items include release countries/languages, an accessible privacy-policy URL, support contact, age-rating evidence, authorized release signing and any necessary project/SDK approval. Do not invent account IDs, rating approvals or support details. Published browser screenshots are development evidence; market images must match the supported official runtime and prescribed dimensions. No market submission or certification is authorized by merely building an APK.

Keep unsupported vehicle control, lighting, speech and location capabilities absent or explicitly unavailable. Production routing requires verified destination provenance, granted permissions and safe lifecycle/state handling; route submission or search completion is never proof of arrival or a visit.
